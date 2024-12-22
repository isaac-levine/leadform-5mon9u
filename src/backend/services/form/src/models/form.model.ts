import mongoose from 'mongoose'; // v7.5.0
import { z } from 'zod'; // v3.22.0
import type { FormSchema, FormField } from '../../../shared/types/form.types';
import { validateFormField } from '../../../shared/utils/validation';
import { Logger } from '../../../shared/utils/logger';
import { FORM_CONFIG } from '../../../shared/constants';

// Constants for form model
const FORM_COLLECTION = 'forms';
const MAX_FIELDS = FORM_CONFIG.MAX_FIELDS;
const MAX_NAME_LENGTH = 100;
const MAX_DESCRIPTION_LENGTH = 500;
const FIELD_NAME_PATTERN = '^[a-zA-Z0-9_-]+$';

// Index options for optimized queries
const INDEX_OPTIONS = {
  background: true,
  unique: true,
  sparse: true
} as const;

/**
 * Interface extending mongoose.Document for form documents
 */
export interface IFormDocument extends mongoose.Document, Omit<FormSchema, 'id'> {
  version: string;
  validateFields(): Promise<void>;
}

/**
 * Enhanced form schema with comprehensive validation and security measures
 */
const formSchema = new mongoose.Schema<IFormDocument>(
  {
    name: {
      type: String,
      required: [true, 'Form name is required'],
      trim: true,
      minlength: [3, 'Form name must be at least 3 characters'],
      maxlength: [MAX_NAME_LENGTH, `Form name cannot exceed ${MAX_NAME_LENGTH} characters`],
      index: true
    },
    description: {
      type: String,
      required: [true, 'Form description is required'],
      trim: true,
      maxlength: [MAX_DESCRIPTION_LENGTH, `Description cannot exceed ${MAX_DESCRIPTION_LENGTH} characters`]
    },
    fields: {
      type: [{
        label: {
          type: String,
          required: [true, 'Field label is required'],
          trim: true
        },
        type: {
          type: String,
          required: [true, 'Field type is required'],
          enum: ['TEXT', 'EMAIL', 'PHONE', 'NUMBER', 'DATE', 'SELECT', 'CHECKBOX', 'RADIO', 'FILE', 'SIGNATURE', 'LOCATION', 'RICH_TEXT']
        },
        placeholder: String,
        defaultValue: String,
        validation: [{
          type: {
            type: String,
            required: true,
            enum: ['REQUIRED', 'MIN_LENGTH', 'MAX_LENGTH', 'PATTERN', 'EMAIL', 'PHONE', 'FILE_SIZE', 'FILE_TYPE', 'CUSTOM', 'ASYNC', 'DEPENDENT']
          },
          value: mongoose.Schema.Types.Mixed,
          message: String,
          isAsync: Boolean,
          validatorFn: String
        }],
        required: {
          type: Boolean,
          default: false
        },
        visible: {
          type: Boolean,
          default: true
        },
        dependsOn: String,
        options: mongoose.Schema.Types.Mixed,
        metadata: mongoose.Schema.Types.Mixed
      }],
      validate: [
        {
          validator: (fields: FormField[]) => fields.length <= MAX_FIELDS,
          message: `Form cannot have more than ${MAX_FIELDS} fields`
        }
      ]
    },
    styling: {
      type: mongoose.Schema.Types.Mixed,
      default: {}
    },
    settings: {
      type: mongoose.Schema.Types.Mixed,
      default: {}
    },
    organizationId: {
      type: String,
      required: [true, 'Organization ID is required'],
      index: true
    },
    active: {
      type: Boolean,
      default: true,
      index: true
    },
    version: {
      type: String,
      required: true,
      default: '1.0.0'
    },
    integrations: {
      type: mongoose.Schema.Types.Mixed,
      default: {}
    },
    analytics: {
      type: mongoose.Schema.Types.Mixed,
      default: {}
    }
  },
  {
    timestamps: true,
    collection: FORM_COLLECTION,
    optimisticConcurrency: true,
    strict: true
  }
);

// Configure indexes for performance optimization
formSchema.index({ organizationId: 1, name: 1 }, { ...INDEX_OPTIONS });
formSchema.index({ createdAt: -1 });
formSchema.index({ updatedAt: -1 });
formSchema.index({ 'fields.type': 1 });

// Initialize logger
const logger = new Logger('FormModel', 'form-service');

/**
 * Middleware to validate form fields before save
 */
formSchema.pre('save', async function(next) {
  try {
    if (this.isModified('fields')) {
      await this.validateFields();
    }
    next();
  } catch (error) {
    logger.error('Form validation failed', error as Error, { formId: this._id });
    next(error);
  }
});

/**
 * Method to validate form fields with enhanced security
 */
formSchema.methods.validateFields = async function(): Promise<void> {
  const fieldNames = new Set<string>();
  
  for (const field of this.fields) {
    // Validate field name pattern
    if (!new RegExp(FIELD_NAME_PATTERN).test(field.label)) {
      throw new Error(`Invalid field name pattern: ${field.label}`);
    }

    // Check for duplicate field names
    if (fieldNames.has(field.label)) {
      throw new Error(`Duplicate field name: ${field.label}`);
    }
    fieldNames.add(field.label);

    // Sanitize and validate field
    const sanitizedField = FormModel.sanitizeField(field);
    
    // Validate field using shared validation utility
    if (sanitizedField.validation?.length) {
      for (const rule of sanitizedField.validation) {
        const validationResult = await validateFormField(
          sanitizedField.defaultValue,
          [rule]
        );
        
        if (!validationResult.isValid) {
          throw new Error(`Field validation failed: ${validationResult.errors.join(', ')}`);
        }
      }
    }

    // Validate field dependencies
    if (sanitizedField.dependsOn) {
      const dependentField = this.fields.find(f => f.label === sanitizedField.dependsOn);
      if (!dependentField) {
        throw new Error(`Dependent field not found: ${sanitizedField.dependsOn}`);
      }
    }
  }
};

/**
 * Static method to sanitize form field data
 */
formSchema.statics.sanitizeField = function(field: FormField): FormField {
  const sanitized = { ...field };
  
  // Sanitize string fields
  if (sanitized.label) {
    sanitized.label = sanitized.label.trim();
  }
  if (sanitized.placeholder) {
    sanitized.placeholder = sanitized.placeholder.trim();
  }
  
  // Remove potential XSS content
  if (sanitized.defaultValue && typeof sanitized.defaultValue === 'string') {
    sanitized.defaultValue = sanitized.defaultValue
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      .replace(/javascript:/gi, '')
      .replace(/on\w+=/gi, '');
  }
  
  return sanitized;
};

// Create and export the model
export const FormModel = mongoose.model<IFormDocument>('Form', formSchema);