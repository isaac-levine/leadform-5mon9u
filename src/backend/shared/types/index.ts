/**
 * @fileoverview Central type definitions index file for the AI-SMS Lead Platform
 * @version 1.0.0
 * 
 * This file aggregates and re-exports all shared types used across the platform including:
 * - Analytics and metrics types
 * - Form builder and submission types
 * - SMS and conversation management types
 * - Type validation utilities
 */

// Re-export all analytics types
export {
  BaseEntity,
  MetricType,
  TimeRange,
  MetricValue,
  MetricAggregations,
  MetricData,
  AnalyticsOverview,
  MetricFilter
} from './analytics.types';

// Re-export all form types
export {
  FieldType,
  ValidationRuleType,
  SubmissionStatus,
  type ValidationRule,
  type ValidationResult,
  type FormField,
  type FormSchema,
  type FormSubmission,
  formFieldSchema,
  formSchemaSchema,
  formSubmissionSchema,
  isFormField,
  isFormSchema,
  isFormSubmission
} from './form.types';

// Re-export all SMS and conversation types
export {
  MessageDirection,
  MessageStatus,
  ConversationStatus,
  SMSProvider,
  type Message,
  type Conversation
} from './sms.types';

/**
 * Interface for type validation error details
 */
export interface TypeValidationError {
  message: string;
  field: string;
  value: unknown;
}

/**
 * Type for validation function results
 */
export type ValidationResult = {
  isValid: boolean;
  errors?: TypeValidationError[];
};

/**
 * Type guard to validate MetricType enum values at runtime
 * @param value - Value to validate
 * @returns boolean indicating if value is a valid MetricType
 */
export function isValidMetricType(value: unknown): value is MetricType {
  if (typeof value !== 'string') return false;
  return Object.values(MetricType).includes(value as MetricType);
}

/**
 * Type guard to validate FormField interface structure at runtime
 * @param value - Value to validate
 * @returns boolean indicating if value matches FormField interface
 */
export function isValidFormField(value: unknown): value is FormField {
  if (!value || typeof value !== 'object') return false;
  
  const field = value as Partial<FormField>;
  
  // Check required properties
  if (!field.label || !field.type || typeof field.required !== 'boolean') {
    return false;
  }
  
  // Validate field type
  if (!Object.values(FieldType).includes(field.type)) {
    return false;
  }
  
  // Validate validation rules if present
  if (field.validation && !Array.isArray(field.validation)) {
    return false;
  }
  
  return true;
}

/**
 * Type guard to validate Message interface structure at runtime
 * @param value - Value to validate
 * @returns boolean indicating if value matches Message interface
 */
export function isValidMessage(value: unknown): value is Message {
  if (!value || typeof value !== 'object') return false;
  
  const message = value as Partial<Message>;
  
  // Check required properties
  if (!message.id || !message.content || !message.direction || !message.status) {
    return false;
  }
  
  // Validate direction and status
  if (!Object.values(MessageDirection).includes(message.direction)) {
    return false;
  }
  if (!Object.values(MessageStatus).includes(message.status)) {
    return false;
  }
  
  // Validate AI confidence score
  if (typeof message.aiConfidence !== 'number' || 
      message.aiConfidence < 0 || 
      message.aiConfidence > 1) {
    return false;
  }
  
  return true;
}