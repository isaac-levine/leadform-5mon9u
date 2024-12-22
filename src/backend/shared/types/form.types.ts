// @ts-check
import { z } from 'zod'; // v3.22.0 - Schema validation
import type { UUID } from 'crypto';

/**
 * Base interface for all entities with versioning support
 * @interface BaseEntity
 */
export interface BaseEntity {
  id: UUID;
  createdAt: Date;
  updatedAt: Date;
  version: number;
  isDeleted: boolean;
}

/**
 * Enum defining all supported form field types
 * @enum {string}
 */
export enum FieldType {
  TEXT = 'TEXT',
  EMAIL = 'EMAIL',
  PHONE = 'PHONE',
  NUMBER = 'NUMBER',
  DATE = 'DATE',
  SELECT = 'SELECT',
  CHECKBOX = 'CHECKBOX',
  RADIO = 'RADIO',
  FILE = 'FILE',
  SIGNATURE = 'SIGNATURE',
  LOCATION = 'LOCATION',
  RICH_TEXT = 'RICH_TEXT'
}

/**
 * Enum defining available validation rule types
 * @enum {string}
 */
export enum ValidationRuleType {
  REQUIRED = 'REQUIRED',
  MIN_LENGTH = 'MIN_LENGTH',
  MAX_LENGTH = 'MAX_LENGTH',
  PATTERN = 'PATTERN',
  EMAIL = 'EMAIL',
  PHONE = 'PHONE',
  FILE_SIZE = 'FILE_SIZE',
  FILE_TYPE = 'FILE_TYPE',
  CUSTOM = 'CUSTOM',
  ASYNC = 'ASYNC',
  DEPENDENT = 'DEPENDENT'
}

/**
 * Enum for tracking form submission status
 * @enum {string}
 */
export enum SubmissionStatus {
  PENDING = 'PENDING',
  VALIDATED = 'VALIDATED',
  FAILED = 'FAILED',
  PROCESSED = 'PROCESSED',
  ARCHIVED = 'ARCHIVED'
}

/**
 * Interface for field validation rules with strict typing
 * @interface ValidationRule
 */
export interface ValidationRule {
  type: ValidationRuleType;
  value: string | number | boolean | RegExp;
  message: string;
  isAsync: boolean;
  validatorFn: string;
}

/**
 * Interface for validation results
 * @interface ValidationResult
 */
export interface ValidationResult {
  field: string;
  valid: boolean;
  errors: string[];
  metadata?: Record<string, any>;
}

/**
 * Extended interface for form field structure with enhanced validation
 * @interface FormField
 * @extends BaseEntity
 */
export interface FormField extends BaseEntity {
  label: string;
  type: FieldType;
  placeholder?: string;
  defaultValue?: string;
  validation: ValidationRule[];
  required: boolean;
  visible: boolean;
  dependsOn?: string;
  options?: Record<string, any>;
  metadata?: Record<string, any>;
}

/**
 * Enhanced interface for complete form structure with versioning
 * @interface FormSchema
 * @extends BaseEntity
 */
export interface FormSchema extends BaseEntity {
  name: string;
  description: string;
  fields: FormField[];
  styling: Record<string, any>;
  settings: Record<string, any>;
  organizationId: UUID;
  active: boolean;
  version: string;
  integrations: Record<string, any>;
  analytics: Record<string, any>;
}

/**
 * Extended interface for form submission data with tracking
 * @interface FormSubmission
 * @extends BaseEntity
 */
export interface FormSubmission extends BaseEntity {
  formId: UUID;
  data: Record<string, any>;
  source: string;
  ipAddress: string;
  userAgent: string;
  metadata: Record<string, any>;
  validationResults: ValidationResult[];
  status: SubmissionStatus;
}

/**
 * Zod schema for runtime validation of form field
 */
export const formFieldSchema = z.object({
  id: z.string().uuid(),
  label: z.string().min(1),
  type: z.nativeEnum(FieldType),
  placeholder: z.string().optional(),
  defaultValue: z.string().optional(),
  validation: z.array(z.object({
    type: z.nativeEnum(ValidationRuleType),
    value: z.union([z.string(), z.number(), z.boolean(), z.instanceof(RegExp)]),
    message: z.string(),
    isAsync: z.boolean(),
    validatorFn: z.string()
  })),
  required: z.boolean(),
  visible: z.boolean(),
  dependsOn: z.string().optional(),
  options: z.record(z.any()).optional(),
  metadata: z.record(z.any()).optional(),
  createdAt: z.date(),
  updatedAt: z.date(),
  version: z.number(),
  isDeleted: z.boolean()
});

/**
 * Zod schema for runtime validation of form schema
 */
export const formSchemaSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1),
  description: z.string(),
  fields: z.array(formFieldSchema),
  styling: z.record(z.any()),
  settings: z.record(z.any()),
  organizationId: z.string().uuid(),
  active: z.boolean(),
  version: z.string(),
  integrations: z.record(z.any()),
  analytics: z.record(z.any()),
  createdAt: z.date(),
  updatedAt: z.date(),
  version: z.number(),
  isDeleted: z.boolean()
});

/**
 * Zod schema for runtime validation of form submission
 */
export const formSubmissionSchema = z.object({
  id: z.string().uuid(),
  formId: z.string().uuid(),
  data: z.record(z.any()),
  source: z.string(),
  ipAddress: z.string(),
  userAgent: z.string(),
  metadata: z.record(z.any()),
  validationResults: z.array(z.object({
    field: z.string(),
    valid: z.boolean(),
    errors: z.array(z.string()),
    metadata: z.record(z.any()).optional()
  })),
  status: z.nativeEnum(SubmissionStatus),
  createdAt: z.date(),
  updatedAt: z.date(),
  version: z.number(),
  isDeleted: z.boolean()
});

// Type guards for runtime type checking
export const isFormField = (field: any): field is FormField => {
  return formFieldSchema.safeParse(field).success;
};

export const isFormSchema = (schema: any): schema is FormSchema => {
  return formSchemaSchema.safeParse(schema).success;
};

export const isFormSubmission = (submission: any): submission is FormSubmission => {
  return formSubmissionSchema.safeParse(submission).success;
};