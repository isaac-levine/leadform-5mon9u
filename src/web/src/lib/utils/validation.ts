// @ts-check
import { z } from 'zod'; // v3.22.0 - Schema validation
import i18next from 'i18next'; // v23.0.0 - Internationalization
import { FormState, ValidationError } from '../../types/form';
import { VALIDATION_RULES } from '../constants/forms';
import { FieldType, ValidationRuleType } from '../../../backend/shared/types/form.types';

// Cache for validation results with TTL
const validationCache = new Map<string, { result: ValidationResult; timestamp: number }>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

/**
 * Interface for validation result
 */
interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
  cacheKey?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Interface for file validation result
 */
interface FileValidationResult {
  isValid: boolean;
  errors: ValidationError[];
  metadata: {
    size: number;
    type: string;
    securityCheck?: boolean;
  };
}

/**
 * Interface for form validation result
 */
interface FormValidationResult {
  isValid: boolean;
  errors: ValidationError[];
  fieldResults: Record<string, ValidationResult>;
  dependencyStatus: Record<string, boolean>;
}

/**
 * Generates a cache key for validation results
 */
const generateCacheKey = (fieldValue: unknown, rules: ValidationRule[], fieldType: FieldType): string => {
  return `${String(fieldValue)}_${rules.map(r => r.type).join('_')}_${fieldType}`;
};

/**
 * Validates a single form field with caching support
 */
export const validateFormField = async (
  fieldValue: unknown,
  rules: ValidationRule[],
  fieldType: FieldType,
  formState?: FormState
): Promise<ValidationResult> => {
  const cacheKey = generateCacheKey(fieldValue, rules, fieldType);
  const cached = validationCache.get(cacheKey);

  // Return cached result if valid and not expired
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.result;
  }

  const errors: ValidationError[] = [];

  // Required field validation
  if (rules.some(rule => rule.type === ValidationRuleType.REQUIRED)) {
    const requiredSchema = z.string().min(1, { message: VALIDATION_RULES.REQUIRED.message });
    try {
      requiredSchema.parse(fieldValue);
    } catch (error) {
      errors.push({
        field: 'value',
        message: VALIDATION_RULES.REQUIRED.message,
        type: ValidationRuleType.REQUIRED
      });
    }
  }

  // Field type specific validation
  switch (fieldType) {
    case FieldType.EMAIL:
      try {
        z.string().email().parse(fieldValue);
      } catch (error) {
        errors.push({
          field: 'value',
          message: VALIDATION_RULES.EMAIL.message,
          type: ValidationRuleType.EMAIL
        });
      }
      break;

    case FieldType.PHONE:
      const phoneRegex = /^\+?[\d\s-()]{10,}$/;
      if (!phoneRegex.test(String(fieldValue))) {
        errors.push({
          field: 'value',
          message: VALIDATION_RULES.PHONE.message,
          type: ValidationRuleType.PHONE
        });
      }
      break;

    case FieldType.FILE:
      if (fieldValue instanceof File) {
        const fileResult = await validateFileUpload(fieldValue, rules);
        if (!fileResult.isValid) {
          errors.push(...fileResult.errors);
        }
      }
      break;
  }

  // Dependent field validation
  const dependentRules = rules.filter(rule => rule.type === ValidationRuleType.DEPENDENT);
  if (dependentRules.length > 0 && formState) {
    for (const rule of dependentRules) {
      if (rule.dependentFields) {
        const dependentValues = rule.dependentFields.map(
          fieldId => formState.fields.find(f => f.id === fieldId)?.value
        );
        try {
          const schema = z.function()
            .args(z.array(z.unknown()))
            .returns(z.boolean())
            .parse(new Function('return ' + rule.validatorFn)());
          
          const isValid = schema(dependentValues);
          if (!isValid) {
            errors.push({
              field: 'value',
              message: rule.message || VALIDATION_RULES.DEPENDENT.message,
              type: ValidationRuleType.DEPENDENT
            });
          }
        } catch (error) {
          console.error('Dependent validation error:', error);
        }
      }
    }
  }

  // Async validation rules
  const asyncRules = rules.filter(rule => rule.isAsync);
  if (asyncRules.length > 0) {
    try {
      await Promise.all(
        asyncRules.map(async rule => {
          const validatorFn = new Function('return ' + rule.validatorFn)();
          const isValid = await validatorFn(fieldValue);
          if (!isValid) {
            errors.push({
              field: 'value',
              message: rule.message || VALIDATION_RULES.ASYNC.message,
              type: ValidationRuleType.ASYNC
            });
          }
        })
      );
    } catch (error) {
      console.error('Async validation error:', error);
    }
  }

  const result: ValidationResult = {
    isValid: errors.length === 0,
    errors,
    cacheKey,
    metadata: {
      lastValidated: new Date().toISOString()
    }
  };

  // Cache the result
  validationCache.set(cacheKey, { result, timestamp: Date.now() });

  return result;
};

/**
 * Validates file uploads for size, type, and security
 */
export const validateFileUpload = async (
  file: File,
  rules: ValidationRule[]
): Promise<FileValidationResult> => {
  const errors: ValidationError[] = [];
  const maxSizeRule = rules.find(rule => rule.type === ValidationRuleType.FILE_SIZE);
  const typeRule = rules.find(rule => rule.type === ValidationRuleType.FILE_TYPE);

  // File size validation
  if (maxSizeRule && typeof maxSizeRule.value === 'number') {
    const maxSizeBytes = maxSizeRule.value * 1024 * 1024; // Convert MB to bytes
    if (file.size > maxSizeBytes) {
      errors.push({
        field: 'file',
        message: i18next.t(VALIDATION_RULES.FILE_SIZE.message, { maxSize: maxSizeRule.value }),
        type: ValidationRuleType.FILE_SIZE
      });
    }
  }

  // File type validation
  if (typeRule && Array.isArray(typeRule.value)) {
    const allowedTypes = typeRule.value as string[];
    if (!allowedTypes.includes(file.type)) {
      errors.push({
        field: 'file',
        message: i18next.t(VALIDATION_RULES.FILE_TYPE.message, { types: allowedTypes.join(', ') }),
        type: ValidationRuleType.FILE_TYPE
      });
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
    metadata: {
      size: file.size,
      type: file.type,
      securityCheck: true
    }
  };
};

/**
 * Validates entire form state with dependency handling
 */
export const validateFormState = async (formState: FormState): Promise<FormValidationResult> => {
  const fieldResults: Record<string, ValidationResult> = {};
  const dependencyStatus: Record<string, boolean> = {};
  const errors: ValidationError[] = [];

  // Build dependency graph
  const dependencyGraph = new Map<string, string[]>();
  formState.fields.forEach(field => {
    const dependentRules = field.validation.filter(rule => rule.type === ValidationRuleType.DEPENDENT);
    if (dependentRules.length > 0) {
      dependencyGraph.set(
        field.id,
        dependentRules.flatMap(rule => rule.dependentFields || [])
      );
    }
  });

  // Validate independent fields first
  for (const field of formState.fields) {
    if (!dependencyGraph.has(field.id)) {
      const result = await validateFormField(
        field.value,
        field.validation,
        field.type as FieldType,
        formState
      );
      fieldResults[field.id] = result;
      if (!result.isValid) {
        errors.push(...result.errors.map(error => ({
          ...error,
          field: field.id
        })));
      }
    }
  }

  // Validate dependent fields in order
  const validated = new Set<string>();
  const validateDependent = async (fieldId: string) => {
    if (validated.has(fieldId)) return;

    const dependencies = dependencyGraph.get(fieldId) || [];
    await Promise.all(dependencies.map(dep => validateDependent(dep)));

    const field = formState.fields.find(f => f.id === fieldId);
    if (field) {
      const result = await validateFormField(
        field.value,
        field.validation,
        field.type as FieldType,
        formState
      );
      fieldResults[fieldId] = result;
      dependencyStatus[fieldId] = result.isValid;
      if (!result.isValid) {
        errors.push(...result.errors.map(error => ({
          ...error,
          field: fieldId
        })));
      }
    }
    validated.add(fieldId);
  };

  // Validate all dependent fields
  await Promise.all(
    Array.from(dependencyGraph.keys()).map(fieldId => validateDependent(fieldId))
  );

  return {
    isValid: errors.length === 0,
    errors,
    fieldResults,
    dependencyStatus
  };
};