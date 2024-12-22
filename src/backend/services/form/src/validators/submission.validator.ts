import { z } from 'zod'; // v3.22.0
import xss from 'xss'; // v1.0.14
import { StatusCodes } from 'http-status-codes'; // v2.2.0
import validator from 'validator'; // v13.11.0

import type { FormSubmission } from '../../../shared/types/form.types';
import { validateFormSubmission } from '../../../shared/utils/validation';
import { createError } from '../../../shared/utils/error-handler';
import type { IFormDocument } from '../models/form.model';
import { FORM_CONFIG } from '../../../shared/constants';

// Constants for validation constraints
const MAX_FIELD_LENGTH = FORM_CONFIG.MAX_FIELD_LENGTH;
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const ALLOWED_FILE_TYPES = ['.pdf', '.doc', '.docx', '.txt', '.jpg', '.jpeg', '.png'];
const VALIDATION_ERROR_CODE = 'SUBMISSION_VALIDATION_ERROR';
const MAX_VALIDATION_ATTEMPTS = 3;
const VALIDATION_TIMEOUT = 5000;

// XSS sanitization options with strict security
const XSS_OPTIONS = {
  whiteList: {}, // No HTML tags allowed
  stripIgnoreTag: true,
  stripIgnoreTagBody: ['script', 'style', 'xml'],
  css: false,
  escapeHtml: true
};

/**
 * Validates submission data against form schema with enhanced security checks
 * @param data - Form submission data
 * @param form - Form document containing validation rules
 * @returns Validation result with detailed error information
 */
export async function validateSubmissionData(
  data: Record<string, any>,
  form: IFormDocument
): Promise<{
  isValid: boolean;
  errors: Record<string, string[]>;
  securityFlags: string[];
}> {
  const errors: Record<string, string[]> = {};
  const securityFlags: string[] = [];
  
  try {
    // Create dynamic Zod schema based on form fields
    const formSchema = z.object(
      form.fields.reduce((acc, field) => {
        const fieldValidation = z.any();
        let schema = fieldValidation;

        // Apply field-specific validation rules
        if (field.validation) {
          field.validation.forEach(rule => {
            switch (rule.type) {
              case 'REQUIRED':
                schema = schema.nonempty(rule.message);
                break;
              case 'MIN_LENGTH':
                schema = schema.min(Number(rule.value), rule.message);
                break;
              case 'MAX_LENGTH':
                schema = schema.max(Number(rule.value), rule.message);
                break;
              case 'PATTERN':
                schema = schema.regex(new RegExp(String(rule.value)), rule.message);
                break;
              case 'EMAIL':
                schema = z.string().email(rule.message);
                break;
              case 'PHONE':
                schema = z.string().regex(/^\+?[1-9]\d{1,14}$/, rule.message);
                break;
            }
          });
        }

        acc[field.label] = field.required ? schema : schema.optional();
        return acc;
      }, {} as Record<string, z.ZodType>)
    );

    // Validate against schema
    const validationResult = await validateFormSubmission(data, formSchema);
    if (!validationResult.isValid) {
      Object.assign(errors, validationResult.errors);
    }

    // Perform field-specific validations
    for (const field of form.fields) {
      const value = data[field.label];
      
      if (value !== undefined) {
        // Check field length
        if (typeof value === 'string' && value.length > MAX_FIELD_LENGTH) {
          if (!errors[field.label]) errors[field.label] = [];
          errors[field.label].push(`Field exceeds maximum length of ${MAX_FIELD_LENGTH} characters`);
        }

        // File upload validation
        if (field.type === 'FILE' && value) {
          const fileValidation = await validateFileUpload(value);
          if (!fileValidation.isValid) {
            if (!errors[field.label]) errors[field.label] = [];
            errors[field.label].push(...fileValidation.errors);
          }
          if (fileValidation.securityReport.threats > 0) {
            securityFlags.push(`Security threat detected in file upload: ${field.label}`);
          }
        }

        // XSS checks for text inputs
        if (typeof value === 'string') {
          const sanitized = sanitizeSubmissionData({ [field.label]: value });
          if (sanitized[field.label] !== value) {
            securityFlags.push(`Potentially malicious content detected in field: ${field.label}`);
          }
        }
      }
    }

    return {
      isValid: Object.keys(errors).length === 0,
      errors,
      securityFlags
    };

  } catch (error) {
    throw createError(
      'Submission validation failed',
      StatusCodes.BAD_REQUEST,
      VALIDATION_ERROR_CODE,
      'error',
      { data, errors }
    );
  }
}

/**
 * Enhanced file upload validation with content inspection
 * @param file - File data to validate
 * @returns Validation result with security analysis
 */
export async function validateFileUpload(
  file: any
): Promise<{
  isValid: boolean;
  errors: string[];
  securityReport: { threats: number; details: string[] };
}> {
  const errors: string[] = [];
  const securityReport = { threats: 0, details: [] };

  try {
    // Basic file validation
    if (!file) {
      errors.push('File is required');
      return { isValid: false, errors, securityReport };
    }

    // Size validation
    if (file.size > MAX_FILE_SIZE) {
      errors.push(`File size exceeds maximum limit of ${MAX_FILE_SIZE / 1024 / 1024}MB`);
    }

    // File type validation
    const fileExtension = file.name.toLowerCase().split('.').pop();
    if (!ALLOWED_FILE_TYPES.includes(`.${fileExtension}`)) {
      errors.push('File type not allowed');
    }

    // Content type verification
    if (!file.type.match(/^(image\/|application\/)/)) {
      errors.push('Invalid file content type');
      securityReport.threats++;
      securityReport.details.push('Suspicious content type detected');
    }

    // Additional security checks
    if (file.name.match(/\.(php|exe|sh|bat)$/i)) {
      errors.push('Potentially dangerous file type');
      securityReport.threats++;
      securityReport.details.push('Executable file detected');
    }

    return {
      isValid: errors.length === 0,
      errors,
      securityReport
    };

  } catch (error) {
    throw createError(
      'File validation failed',
      StatusCodes.BAD_REQUEST,
      VALIDATION_ERROR_CODE,
      'error',
      { file }
    );
  }
}

/**
 * Advanced data sanitization with comprehensive XSS protection
 * @param data - Data to sanitize
 * @returns Sanitized data
 */
export function sanitizeSubmissionData(
  data: Record<string, any>
): Record<string, any> {
  const sanitized: Record<string, any> = {};

  try {
    for (const [key, value] of Object.entries(data)) {
      if (typeof value === 'string') {
        // Apply multiple layers of sanitization
        let sanitizedValue = value.trim();
        
        // XSS sanitization
        sanitizedValue = xss(sanitizedValue, XSS_OPTIONS);
        
        // HTML entity encoding
        sanitizedValue = validator.escape(sanitizedValue);
        
        // Remove potential SQL injection patterns
        sanitizedValue = validator.blacklist(sanitizedValue, '\'";\\');
        
        // Remove potential script tags and events
        sanitizedValue = sanitizedValue
          .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
          .replace(/javascript:/gi, '')
          .replace(/on\w+=/gi, '');

        sanitized[key] = sanitizedValue;
      } else if (Array.isArray(value)) {
        sanitized[key] = value.map(item => 
          typeof item === 'string' ? sanitizeSubmissionData({ item }).item : item
        );
      } else if (value && typeof value === 'object') {
        sanitized[key] = sanitizeSubmissionData(value);
      } else {
        sanitized[key] = value;
      }
    }

    return sanitized;

  } catch (error) {
    throw createError(
      'Data sanitization failed',
      StatusCodes.BAD_REQUEST,
      VALIDATION_ERROR_CODE,
      'error',
      { data }
    );
  }
}