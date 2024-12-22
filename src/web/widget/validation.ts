// @ts-check
import { z } from 'zod'; // v3.22.0 - Schema validation
import type { 
  ValidationRule, 
  ValidationRuleType 
} from '../../backend/shared/types/form.types';
import type { 
  ValidationResult, 
  ValidationSource, 
  FormFieldValue 
} from './types';

/**
 * Regular expressions for common validation patterns
 */
const VALIDATION_PATTERNS = {
  EMAIL: /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i,
  PHONE: /^\+?[1-9]\d{1,14}$/,
  URL: /^https?:\/\/(?:www\.)?[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b(?:[-a-zA-Z0-9()@:%_\+.~#?&\/=]*)$/
} as const;

/**
 * Constants for validation configuration
 */
const VALIDATION_CONFIG = {
  CACHE_TTL: 5000, // 5 seconds cache TTL
  MAX_ASYNC_TIMEOUT: 3000, // 3 seconds max async validation time
  MAX_DEPENDENT_DEPTH: 5, // Maximum depth for dependent field validation
  BATCH_SIZE: 10 // Number of validations to process in parallel
} as const;

/**
 * Interface for validation cache entries
 */
interface ValidationCacheEntry {
  result: ValidationResult;
  timestamp: number;
}

/**
 * Type for validation cache
 */
type ValidationCache = Map<string, ValidationCacheEntry>;

/**
 * Validates a single field value against provided rules
 * @param value - Field value to validate
 * @param rules - Array of validation rules to apply
 * @param formData - Complete form data for dependent validation
 * @param cache - Validation cache instance
 * @returns Promise<ValidationResult> - Validation result with enhanced error details
 */
export async function validateField(
  value: FormFieldValue,
  rules: ValidationRule[],
  formData: Record<string, FormFieldValue>,
  cache: ValidationCache = new Map()
): Promise<ValidationResult> {
  // Check cache first
  const cacheKey = getCacheKey(value, rules);
  const cachedResult = checkCache(cacheKey, cache);
  if (cachedResult) return cachedResult;

  const result: ValidationResult = {
    isValid: true,
    timestamp: Date.now(),
    source: ValidationSource.PROGRAMMATIC
  };

  try {
    // Process synchronous rules first
    const syncRules = rules.filter(rule => !rule.isAsync);
    for (const rule of syncRules) {
      const syncResult = await validateSingleRule(value, rule, formData);
      if (!syncResult.isValid) {
        result.isValid = false;
        result.error = syncResult.error;
        break;
      }
    }

    // If sync validation passed, process async rules
    if (result.isValid && rules.some(rule => rule.isAsync)) {
      const asyncRules = rules.filter(rule => rule.isAsync);
      const asyncResults = await Promise.race([
        Promise.all(asyncRules.map(rule => validateSingleRule(value, rule, formData))),
        new Promise<ValidationResult[]>((_, reject) => 
          setTimeout(() => reject(new Error('Async validation timeout')), 
          VALIDATION_CONFIG.MAX_ASYNC_TIMEOUT)
        )
      ]);

      const failedAsync = asyncResults.find(r => !r.isValid);
      if (failedAsync) {
        result.isValid = false;
        result.error = failedAsync.error;
      }
    }

    // Cache successful result
    if (result.isValid) {
      cache.set(cacheKey, {
        result,
        timestamp: Date.now()
      });
    }

    return result;
  } catch (error) {
    return {
      isValid: false,
      error: error instanceof Error ? error.message : 'Validation failed',
      timestamp: Date.now(),
      source: ValidationSource.PROGRAMMATIC
    };
  }
}

/**
 * Validates entire form data against provided validation rules
 * @param formData - Form data to validate
 * @param validationRules - Map of field names to validation rules
 * @returns Promise<Record<string, ValidationResult>> - Map of field names to validation results
 */
export async function validateForm(
  formData: Record<string, FormFieldValue>,
  validationRules: Record<string, ValidationRule[]>
): Promise<Record<string, ValidationResult>> {
  const results: Record<string, ValidationResult> = {};
  const cache: ValidationCache = new Map();

  try {
    // Build dependency graph
    const dependencyGraph = buildDependencyGraph(validationRules);
    const validationGroups = topologicalSort(dependencyGraph);

    // Validate fields in dependency order
    for (const group of validationGroups) {
      const groupPromises = group.map(async fieldName => {
        const rules = validationRules[fieldName];
        const value = formData[fieldName];
        
        results[fieldName] = await validateField(value, rules, formData, cache);
        return results[fieldName];
      });

      // Process each group in parallel
      await Promise.all(groupPromises);

      // Stop if any validation in the group failed
      if (group.some(fieldName => !results[fieldName].isValid)) {
        break;
      }
    }

    return results;
  } catch (error) {
    // Handle validation errors gracefully
    const errorResult: ValidationResult = {
      isValid: false,
      error: error instanceof Error ? error.message : 'Form validation failed',
      timestamp: Date.now(),
      source: ValidationSource.PROGRAMMATIC
    };

    return Object.keys(validationRules).reduce((acc, fieldName) => {
      acc[fieldName] = errorResult;
      return acc;
    }, {} as Record<string, ValidationResult>);
  }
}

/**
 * Validates a custom validation rule
 * @param value - Value to validate
 * @param rule - Custom validation rule
 * @param formData - Complete form data
 * @returns Promise<ValidationResult> - Validation result
 */
export async function validateCustomRule(
  value: FormFieldValue,
  rule: ValidationRule,
  formData: Record<string, FormFieldValue>
): Promise<ValidationResult> {
  try {
    // Validate rule configuration
    const ruleSchema = z.object({
      type: z.literal(ValidationRuleType.CUSTOM),
      value: z.union([z.string(), z.number(), z.boolean()]),
      message: z.string(),
      validatorFn: z.string()
    });

    const validRule = ruleSchema.parse(rule);

    // Execute custom validation function
    const validatorFn = new Function('value', 'formData', 'rule', validRule.validatorFn);
    const isValid = await validatorFn(value, formData, rule);

    return {
      isValid: Boolean(isValid),
      error: isValid ? undefined : rule.message,
      timestamp: Date.now(),
      source: ValidationSource.PROGRAMMATIC
    };
  } catch (error) {
    return {
      isValid: false,
      error: error instanceof Error ? error.message : 'Custom validation failed',
      timestamp: Date.now(),
      source: ValidationSource.PROGRAMMATIC
    };
  }
}

/**
 * Validates a single rule against a value
 * @private
 */
async function validateSingleRule(
  value: FormFieldValue,
  rule: ValidationRule,
  formData: Record<string, FormFieldValue>
): Promise<ValidationResult> {
  try {
    let isValid = true;
    
    switch (rule.type) {
      case ValidationRuleType.REQUIRED:
        isValid = value !== null && value !== undefined && value !== '';
        break;

      case ValidationRuleType.MIN_LENGTH:
        isValid = String(value).length >= Number(rule.value);
        break;

      case ValidationRuleType.MAX_LENGTH:
        isValid = String(value).length <= Number(rule.value);
        break;

      case ValidationRuleType.PATTERN:
        isValid = new RegExp(String(rule.value)).test(String(value));
        break;

      case ValidationRuleType.EMAIL:
        isValid = VALIDATION_PATTERNS.EMAIL.test(String(value));
        break;

      case ValidationRuleType.PHONE:
        isValid = VALIDATION_PATTERNS.PHONE.test(String(value));
        break;

      case ValidationRuleType.CUSTOM:
        return validateCustomRule(value, rule, formData);

      default:
        throw new Error(`Unsupported validation rule type: ${rule.type}`);
    }

    return {
      isValid,
      error: isValid ? undefined : rule.message,
      timestamp: Date.now(),
      source: ValidationSource.PROGRAMMATIC
    };
  } catch (error) {
    return {
      isValid: false,
      error: error instanceof Error ? error.message : 'Validation failed',
      timestamp: Date.now(),
      source: ValidationSource.PROGRAMMATIC
    };
  }
}

/**
 * Generates a cache key for validation results
 * @private
 */
function getCacheKey(value: FormFieldValue, rules: ValidationRule[]): string {
  return `${JSON.stringify(value)}-${JSON.stringify(rules)}`;
}

/**
 * Checks validation cache for existing result
 * @private
 */
function checkCache(key: string, cache: ValidationCache): ValidationResult | null {
  const cached = cache.get(key);
  if (cached && Date.now() - cached.timestamp < VALIDATION_CONFIG.CACHE_TTL) {
    return cached.result;
  }
  return null;
}

/**
 * Builds a dependency graph for validation rules
 * @private
 */
function buildDependencyGraph(
  validationRules: Record<string, ValidationRule[]>
): Map<string, Set<string>> {
  const graph = new Map<string, Set<string>>();

  for (const [field, rules] of Object.entries(validationRules)) {
    graph.set(field, new Set());
    
    for (const rule of rules) {
      if (rule.dependsOn) {
        for (const dependency of rule.dependsOn) {
          graph.get(field)?.add(dependency);
        }
      }
    }
  }

  return graph;
}

/**
 * Performs topological sort on validation dependency graph
 * @private
 */
function topologicalSort(graph: Map<string, Set<string>>): string[][] {
  const visited = new Set<string>();
  const temp = new Set<string>();
  const order: string[][] = [];
  let currentGroup: string[] = [];

  function visit(node: string, depth: number = 0) {
    if (temp.has(node)) {
      throw new Error('Circular dependency detected in validation rules');
    }
    if (visited.has(node)) return;
    if (depth > VALIDATION_CONFIG.MAX_DEPENDENT_DEPTH) {
      throw new Error('Maximum dependency depth exceeded');
    }

    temp.add(node);
    const dependencies = graph.get(node) || new Set();

    for (const dependency of dependencies) {
      visit(dependency, depth + 1);
    }

    temp.delete(node);
    visited.add(node);
    currentGroup.push(node);
  }

  for (const node of graph.keys()) {
    if (!visited.has(node)) {
      currentGroup = [];
      visit(node);
      if (currentGroup.length > 0) {
        order.push(currentGroup);
      }
    }
  }

  return order.reverse();
}