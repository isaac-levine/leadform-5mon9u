import { z } from 'zod'; // v3.22.0
import validator from 'validator'; // v13.11.0
import xss from 'xss'; // v1.0.14
import { createError } from './error-handler';
import type { ValidationRule } from '../types/form.types';
import type { Message } from '../types/sms.types';

// Constants for validation constraints
export const MAX_MESSAGE_LENGTH = 1600;
export const MIN_MESSAGE_LENGTH = 1;
export const MAX_FIELD_LENGTH = 10000;
export const VALIDATION_ERROR_CODE = 'VALIDATION_ERROR';
export const VALIDATION_TIMEOUT_MS = 5000;

// XSS Sanitization options
const SANITIZATION_OPTIONS = {
  whiteList: {}, // Restrict all HTML tags by default
  stripIgnoreTag: true,
  stripIgnoreTagBody: ['script', 'style'],
  css: false,
  escapeHtml: true
};

/**
 * Validates a single form field value against its validation rules
 * @param value - The field value to validate
 * @param rules - Array of validation rules to apply
 * @returns Promise resolving to validation result
 */
export async function validateFormField(
  value: any,
  rules: ValidationRule[]
): Promise<{ isValid: boolean; errors: string[] }> {
  const errors: string[] = [];
  
  try {
    // Handle required field validation first
    const isRequired = rules.some(rule => rule.type === 'REQUIRED');
    if (isRequired && (value === undefined || value === null || value === '')) {
      errors.push('This field is required');
      return { isValid: false, errors };
    }

    // Skip other validations if field is empty and not required
    if (!value && !isRequired) {
      return { isValid: true, errors: [] };
    }

    // Apply each validation rule
    for (const rule of rules) {
      switch (rule.type) {
        case 'MIN_LENGTH':
          if (typeof value === 'string' && value.length < Number(rule.value)) {
            errors.push(rule.message || `Minimum length is ${rule.value} characters`);
          }
          break;

        case 'MAX_LENGTH':
          if (typeof value === 'string' && value.length > Number(rule.value)) {
            errors.push(rule.message || `Maximum length is ${rule.value} characters`);
          }
          break;

        case 'PATTERN':
          if (typeof value === 'string' && !new RegExp(String(rule.value)).test(value)) {
            errors.push(rule.message || 'Invalid format');
          }
          break;

        case 'EMAIL':
          if (typeof value === 'string' && !validator.isEmail(value)) {
            errors.push(rule.message || 'Invalid email address');
          }
          break;

        case 'PHONE':
          if (typeof value === 'string' && !validator.isMobilePhone(value, 'any')) {
            errors.push(rule.message || 'Invalid phone number');
          }
          break;

        case 'CUSTOM':
          if (rule.validatorFn) {
            const customValidator = new Function('value', rule.validatorFn);
            const isValid = await Promise.race([
              customValidator(value),
              new Promise((_, reject) => 
                setTimeout(() => reject(new Error('Validation timeout')), VALIDATION_TIMEOUT_MS)
              )
            ]);
            if (!isValid) {
              errors.push(rule.message || 'Custom validation failed');
            }
          }
          break;
      }
    }

    return {
      isValid: errors.length === 0,
      errors
    };

  } catch (error) {
    throw createError(
      'Field validation failed',
      400,
      VALIDATION_ERROR_CODE,
      'error',
      { field: value, rules }
    );
  }
}

/**
 * Validates an entire form submission against its schema
 * @param data - Form submission data
 * @param schema - Form schema definition
 * @returns Promise resolving to validation results
 */
export async function validateFormSubmission(
  data: Record<string, any>,
  schema: z.ZodSchema
): Promise<{ isValid: boolean; errors: Record<string, string[]> }> {
  const errors: Record<string, string[]> = {};
  
  try {
    // Validate against Zod schema
    const result = await schema.safeParseAsync(data);
    
    if (!result.success) {
      result.error.issues.forEach(issue => {
        const path = issue.path.join('.');
        if (!errors[path]) {
          errors[path] = [];
        }
        errors[path].push(issue.message);
      });
    }

    // Additional security validations
    for (const [key, value] of Object.entries(data)) {
      // Prevent oversized inputs
      if (typeof value === 'string' && value.length > MAX_FIELD_LENGTH) {
        if (!errors[key]) errors[key] = [];
        errors[key].push(`Field exceeds maximum length of ${MAX_FIELD_LENGTH} characters`);
      }

      // Sanitize string inputs
      if (typeof value === 'string') {
        data[key] = sanitizeInput(value);
      }
    }

    return {
      isValid: Object.keys(errors).length === 0,
      errors
    };

  } catch (error) {
    throw createError(
      'Form validation failed',
      400,
      VALIDATION_ERROR_CODE,
      'error',
      { data }
    );
  }
}

/**
 * Validates SMS message content and metadata with enhanced security
 * @param message - Partial message object to validate
 * @returns Promise resolving to message validation result
 */
export async function validateMessage(
  message: Partial<Message>
): Promise<{ isValid: boolean; errors: string[] }> {
  const errors: string[] = [];

  try {
    // Validate message content
    if (!message.content) {
      errors.push('Message content is required');
    } else {
      // Length validation
      if (message.content.length < MIN_MESSAGE_LENGTH) {
        errors.push(`Message content must be at least ${MIN_MESSAGE_LENGTH} character`);
      }
      if (message.content.length > MAX_MESSAGE_LENGTH) {
        errors.push(`Message content cannot exceed ${MAX_MESSAGE_LENGTH} characters`);
      }

      // Content security validation
      const sanitizedContent = sanitizeInput(message.content);
      if (sanitizedContent !== message.content) {
        errors.push('Message contains potentially unsafe content');
      }

      // Check for malicious patterns
      if (validator.contains(message.content, 'javascript:') ||
          validator.contains(message.content, 'data:') ||
          /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi.test(message.content)) {
        errors.push('Message contains potentially malicious content');
      }
    }

    // Validate message direction
    if (message.direction && !['INBOUND', 'OUTBOUND'].includes(message.direction)) {
      errors.push('Invalid message direction');
    }

    return {
      isValid: errors.length === 0,
      errors
    };

  } catch (error) {
    throw createError(
      'Message validation failed',
      400,
      VALIDATION_ERROR_CODE,
      'error',
      { message }
    );
  }
}

/**
 * Advanced input sanitization with multiple security layers
 * @param input - String input to sanitize
 * @param options - Optional sanitization options
 * @returns Sanitized string
 */
export function sanitizeInput(
  input: string,
  options: Partial<typeof SANITIZATION_OPTIONS> = {}
): string {
  if (!input) return input;

  try {
    // Trim and normalize whitespace
    let sanitized = validator.trim(input);
    
    // Apply XSS sanitization
    sanitized = xss(sanitized, {
      ...SANITIZATION_OPTIONS,
      ...options
    });

    // Escape HTML entities
    sanitized = validator.escape(sanitized);

    // Remove potential SQL injection patterns
    sanitized = validator.blacklist(sanitized, '\'";\\');

    // Normalize Unicode characters
    sanitized = validator.normalizeEmail(sanitized) || sanitized;

    return sanitized;

  } catch (error) {
    throw createError(
      'Input sanitization failed',
      400,
      VALIDATION_ERROR_CODE,
      'error',
      { input }
    );
  }
}