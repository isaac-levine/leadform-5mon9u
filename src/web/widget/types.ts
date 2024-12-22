// @ts-check
import { z } from 'zod'; // v3.22.0 - Runtime schema validation
import type { ValidationRule, ValidationRuleType, FieldType } from '../../backend/shared/types/form.types';

/**
 * Available predefined themes for widget styling
 * @enum {string}
 */
export enum WidgetTheme {
  LIGHT = 'LIGHT',
  DARK = 'DARK',
  CUSTOM = 'CUSTOM'
}

/**
 * Widget event types for callback handling
 * @enum {string}
 */
export enum WidgetEvent {
  LOAD = 'LOAD',
  SUBMIT = 'SUBMIT',
  ERROR = 'ERROR',
  VALIDATION = 'VALIDATION',
  FIELD_CHANGE = 'FIELD_CHANGE',
  FORM_READY = 'FORM_READY'
}

/**
 * Source of validation execution for tracking
 * @enum {string}
 */
export enum ValidationSource {
  USER_INPUT = 'USER_INPUT',
  BLUR = 'BLUR',
  SUBMIT = 'SUBMIT',
  PROGRAMMATIC = 'PROGRAMMATIC'
}

/**
 * Widget styling configuration interface
 * @interface WidgetStyle
 */
export interface WidgetStyle {
  theme: WidgetTheme;
  customStyles?: {
    fontFamily?: string;
    primaryColor?: string;
    backgroundColor?: string;
    textColor?: string;
    borderRadius?: string;
    spacing?: string;
    errorColor?: string;
    successColor?: string;
  };
  className?: string;
  responsiveBreakpoints?: {
    mobile: number;
    tablet: number;
    desktop: number;
  };
}

/**
 * Security configuration for cross-origin communication
 * @interface WidgetSecurity
 */
export interface WidgetSecurity {
  allowedOrigins: string[];
  apiKey: string;
  csrfToken?: string;
  enableSandbox?: boolean;
  contentSecurityPolicy?: string;
}

/**
 * Event callback functions interface
 * @interface WidgetCallbacks
 */
export interface WidgetCallbacks {
  onLoad?: (formId: string) => void | Promise<void>;
  onSubmit?: (data: FormData) => void | Promise<void>;
  onError?: (error: Error) => void;
  onValidation?: (result: ValidationResult) => void;
  onFieldChange?: (fieldName: string, value: FormFieldValue) => void;
  onFormReady?: () => void;
}

/**
 * Configuration interface for secure form widget initialization
 * @interface WidgetConfig
 */
export interface WidgetConfig {
  formId: string;
  containerId: string;
  styling?: WidgetStyle;
  callbacks?: WidgetCallbacks;
  security?: WidgetSecurity;
}

/**
 * Widget metadata for tracking and analytics
 * @interface WidgetMetadata
 */
export interface WidgetMetadata {
  instanceId: string;
  version: string;
  loadTime: number;
  userAgent: string;
  screenSize: {
    width: number;
    height: number;
  };
  performance: {
    loadDuration: number;
    renderDuration: number;
    interactionDelay: number;
  };
}

/**
 * Enhanced validation state for form fields
 * @interface ValidationState
 */
export interface ValidationState {
  isValid: boolean;
  errors: string[];
  isValidating: boolean;
  lastValidated: number;
  source: ValidationSource;
}

/**
 * Enhanced internal state interface for widget
 * @interface WidgetState
 */
export interface WidgetState {
  isLoading: boolean;
  isSubmitting: boolean;
  isValid: boolean;
  formData: FormData;
  fieldStates: Record<string, ValidationState>;
  errors: Record<string, string>;
  metadata: WidgetMetadata;
}

/**
 * Union type for supported form field values
 * @type {FormFieldValue}
 */
export type FormFieldValue = string | number | boolean | Array<string | number> | null;

/**
 * Enhanced type for form field values with validation
 * @type {FormData}
 */
export type FormData = Record<string, FormFieldValue>;

/**
 * Enhanced type for field validation result
 * @type {ValidationResult}
 */
export type ValidationResult = {
  isValid: boolean;
  error?: string;
  timestamp: number;
  source: ValidationSource;
};

/**
 * Zod schema for runtime validation of widget configuration
 */
export const widgetConfigSchema = z.object({
  formId: z.string().uuid(),
  containerId: z.string().min(1),
  styling: z.object({
    theme: z.nativeEnum(WidgetTheme),
    customStyles: z.object({
      fontFamily: z.string().optional(),
      primaryColor: z.string().optional(),
      backgroundColor: z.string().optional(),
      textColor: z.string().optional(),
      borderRadius: z.string().optional(),
      spacing: z.string().optional(),
      errorColor: z.string().optional(),
      successColor: z.string().optional()
    }).optional(),
    className: z.string().optional(),
    responsiveBreakpoints: z.object({
      mobile: z.number(),
      tablet: z.number(),
      desktop: z.number()
    }).optional()
  }).optional(),
  callbacks: z.object({
    onLoad: z.function().optional(),
    onSubmit: z.function().optional(),
    onError: z.function().optional(),
    onValidation: z.function().optional(),
    onFieldChange: z.function().optional(),
    onFormReady: z.function().optional()
  }).optional(),
  security: z.object({
    allowedOrigins: z.array(z.string().url()),
    apiKey: z.string().min(32),
    csrfToken: z.string().optional(),
    enableSandbox: z.boolean().optional(),
    contentSecurityPolicy: z.string().optional()
  }).optional()
});

// Type guard for runtime type checking
export const isValidWidgetConfig = (config: unknown): config is WidgetConfig => {
  return widgetConfigSchema.safeParse(config).success;
};