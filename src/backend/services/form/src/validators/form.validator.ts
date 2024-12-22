import { z } from 'zod'; // v3.22.0
import { StatusCodes } from 'http-status-codes'; // v2.2.0
import { FormSchema, ValidationRule } from '../../../shared/types/form.types';
import { validateFormField } from '../../../shared/utils/validation';
import { createError } from '../../../shared/utils/error-handler';

// Constants for validation constraints
const VALIDATION_ERROR_CODE = 'FORM_VALIDATION_ERROR';
const MAX_FIELD_LENGTH = 1000;
const MIN_FIELD_LENGTH = 1;
const MAX_FORM_FIELDS = 50;
const VALIDATION_TIMEOUT = 5000;
const MAX_VALIDATION_RULES = 10;

/**
 * Security context for tracking validation state and potential threats
 */
interface SecurityContext {
  hasScriptContent: boolean;
  hasSqlInjection: boolean;
  hasXssAttempt: boolean;
  oversizedFields: string[];
  maliciousPatterns: string[];
}

/**
 * Validates the complete form schema structure with enhanced security checks
 * @param schema - Form schema to validate
 * @returns Validation result with security context
 */
export async function validateFormSchema(
  schema: FormSchema
): Promise<{ isValid: boolean; errors: string[]; securityContext: SecurityContext }> {
  const errors: string[] = [];
  const securityContext: SecurityContext = {
    hasScriptContent: false,
    hasSqlInjection: false,
    hasXssAttempt: false,
    oversizedFields: [],
    maliciousPatterns: []
  };

  try {
    // Validate basic form structure
    if (!schema.name || schema.name.length < MIN_FIELD_LENGTH) {
      errors.push('Form name is required and must not be empty');
    }

    if (!schema.fields || !Array.isArray(schema.fields)) {
      errors.push('Form must contain a valid fields array');
      return { isValid: false, errors, securityContext };
    }

    // Validate field count
    if (schema.fields.length > MAX_FORM_FIELDS) {
      errors.push(`Form cannot contain more than ${MAX_FORM_FIELDS} fields`);
      return { isValid: false, errors, securityContext };
    }

    // Validate each field with security checks
    const fieldValidations = await Promise.all(
      schema.fields.map(async (field) => {
        // Check field name length
        if (field.label && field.label.length > MAX_FIELD_LENGTH) {
          securityContext.oversizedFields.push(field.label);
          return `Field "${field.label}" exceeds maximum length`;
        }

        // Check for malicious patterns
        const maliciousPatterns = [
          /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
          /javascript:/gi,
          /onclick/gi,
          /onerror/gi,
          /SELECT.*FROM/gi,
          /INSERT.*INTO/gi,
          /UPDATE.*SET/gi,
          /DELETE.*FROM/gi
        ];

        const fieldString = JSON.stringify(field);
        maliciousPatterns.forEach((pattern, index) => {
          if (pattern.test(fieldString)) {
            securityContext.maliciousPatterns.push(`pattern_${index}`);
            if (index < 4) securityContext.hasXssAttempt = true;
            if (index >= 4) securityContext.hasSqlInjection = true;
          }
        });

        // Validate field validation rules
        if (field.validation) {
          const ruleValidation = await validateFieldRules(field.validation);
          if (!ruleValidation.isValid) {
            return ruleValidation.errors;
          }
        }

        return null;
      })
    );

    // Add field validation errors
    fieldValidations
      .filter(Boolean)
      .forEach(error => errors.push(...(Array.isArray(error) ? error : [error])));

    // Validate form settings
    if (schema.settings) {
      const settingsString = JSON.stringify(schema.settings);
      if (settingsString.length > MAX_FIELD_LENGTH) {
        errors.push('Form settings object exceeds maximum allowed size');
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      securityContext
    };

  } catch (error) {
    throw createError(
      'Form schema validation failed',
      StatusCodes.BAD_REQUEST,
      VALIDATION_ERROR_CODE,
      'error',
      { schema }
    );
  }
}

/**
 * Validates individual form fields with enhanced security checks
 * @param fields - Array of form fields to validate
 * @returns Field-level validation results with security flags
 */
export async function validateFormFields(
  fields: FormSchema['fields']
): Promise<{ isValid: boolean; errors: Record<string, string[]>; securityFlags: Record<string, boolean> }> {
  const errors: Record<string, string[]> = {};
  const securityFlags: Record<string, boolean> = {};

  try {
    await Promise.all(
      fields.map(async (field) => {
        const fieldErrors: string[] = [];
        
        // Basic field validation
        if (!field.label) {
          fieldErrors.push('Field label is required');
        }

        if (!field.type) {
          fieldErrors.push('Field type is required');
        }

        // Validate field dependencies
        if (field.dependsOn) {
          const dependentField = fields.find(f => f.id === field.dependsOn);
          if (!dependentField) {
            fieldErrors.push(`Dependent field ${field.dependsOn} not found`);
          }
        }

        // Security checks for field content
        const fieldString = JSON.stringify(field);
        securityFlags[field.id] = {
          hasScript: /<script/gi.test(fieldString),
          hasInjection: /['";]/gi.test(fieldString),
          oversized: fieldString.length > MAX_FIELD_LENGTH
        };

        // Validate field validation rules
        if (field.validation) {
          const ruleValidation = await validateFieldRules(field.validation);
          if (!ruleValidation.isValid) {
            fieldErrors.push(...ruleValidation.errors);
          }
        }

        if (fieldErrors.length > 0) {
          errors[field.id] = fieldErrors;
        }
      })
    );

    return {
      isValid: Object.keys(errors).length === 0,
      errors,
      securityFlags
    };

  } catch (error) {
    throw createError(
      'Field validation failed',
      StatusCodes.BAD_REQUEST,
      VALIDATION_ERROR_CODE,
      'error',
      { fields }
    );
  }
}

/**
 * Validates field validation rules configuration
 * @param rules - Array of validation rules to validate
 * @returns Validation results for rules
 */
export async function validateFieldRules(
  rules: ValidationRule[]
): Promise<{ isValid: boolean; errors: string[]; ruleContext: Record<string, any> }> {
  const errors: string[] = [];
  const ruleContext: Record<string, any> = {};

  try {
    // Check rules count
    if (rules.length > MAX_VALIDATION_RULES) {
      errors.push(`Cannot have more than ${MAX_VALIDATION_RULES} validation rules`);
      return { isValid: false, errors, ruleContext };
    }

    // Track rule types to prevent duplicates
    const ruleTypes = new Set<string>();

    for (const rule of rules) {
      // Check for duplicate rules
      if (ruleTypes.has(rule.type)) {
        errors.push(`Duplicate validation rule type: ${rule.type}`);
        continue;
      }
      ruleTypes.add(rule.type);

      // Validate rule message
      if (!rule.message || rule.message.length > MAX_FIELD_LENGTH) {
        errors.push('Invalid validation rule message');
      }

      // Validate rule value based on type
      switch (rule.type) {
        case 'MIN_LENGTH':
        case 'MAX_LENGTH':
          if (typeof rule.value !== 'number' || rule.value < 0) {
            errors.push(`Invalid ${rule.type} value`);
          }
          break;

        case 'PATTERN':
          try {
            new RegExp(String(rule.value));
          } catch {
            errors.push('Invalid regular expression pattern');
          }
          break;

        case 'CUSTOM':
          if (typeof rule.validatorFn !== 'string') {
            errors.push('Custom validator must be a string function');
          }
          // Track custom validation for security context
          ruleContext.hasCustomValidation = true;
          break;
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      ruleContext
    };

  } catch (error) {
    throw createError(
      'Validation rule validation failed',
      StatusCodes.BAD_REQUEST,
      VALIDATION_ERROR_CODE,
      'error',
      { rules }
    );
  }
}