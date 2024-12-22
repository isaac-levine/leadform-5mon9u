// @ts-check
import { z } from 'zod'; // v3.22.0 - Schema validation
import { BaseEntity, FieldType, ValidationRuleType } from '../../../backend/shared/types/form.types';

/**
 * Enum for responsive breakpoints aligned with design system specifications
 * @enum {string}
 */
export enum Breakpoint {
  MOBILE = '320px',
  TABLET = '768px',
  DESKTOP = '1024px',
  WIDE = '1280px'
}

/**
 * Interface for theme configuration overrides
 * @interface ThemeOverrides
 */
interface ThemeOverrides {
  primary?: string;
  secondary?: string;
  success?: string;
  error?: string;
  neutral?: string;
  typography?: {
    fontFamily?: string;
    headingSizes?: Record<string, string>;
    bodyText?: Record<string, string>;
  };
}

/**
 * Interface for theme configuration
 * @interface ThemeConfig
 */
interface ThemeConfig {
  mode: 'light' | 'dark';
  colors: {
    primary: string;
    secondary: string;
    success: string;
    error: string;
    neutral: string;
  };
  typography: {
    fontFamily: string;
    headingSizes: {
      h1: string;
      h2: string;
      h3: string;
      h4: string;
      h5: string;
    };
    bodyText: {
      large: string;
      regular: string;
      small: string;
    };
  };
  spacing: {
    base: number;
    scale: number[];
  };
}

/**
 * Interface for form field styling properties with theme integration
 * @interface FormFieldStyle
 */
export interface FormFieldStyle {
  backgroundColor: string;
  textColor: string;
  borderColor: string;
  borderRadius: string;
  fontSize: string;
  padding: string;
  margin?: string;
  fontFamily?: string;
  fontWeight?: string;
  boxShadow?: string;
  transition?: string;
  responsive: ResponsiveStyle;
  themeOverrides?: ThemeOverrides;
  hover?: Partial<FormFieldStyle>;
  focus?: Partial<FormFieldStyle>;
  disabled?: Partial<FormFieldStyle>;
}

/**
 * Type for responsive style configurations
 * @type ResponsiveStyle
 */
export type ResponsiveStyle = {
  [key in Breakpoint]?: Partial<FormFieldStyle>;
};

/**
 * Type for validation rule with Zod schema
 * @type ValidationRule
 */
export type ValidationRule = {
  schema: z.ZodSchema;
  message: string;
  type: ValidationRuleType;
  params?: Record<string, unknown>;
  isAsync?: boolean;
  dependentFields?: string[];
};

/**
 * Type for form submission states
 * @type FormSubmissionState
 */
export type FormSubmissionState = 'idle' | 'submitting' | 'submitted' | 'error';

/**
 * Type for validation error details
 * @type ValidationError
 */
export type ValidationError = {
  field: string;
  message: string;
  type: ValidationRuleType;
  metadata?: Record<string, unknown>;
};

/**
 * Enhanced interface for form builder state management with validation
 * @interface FormState
 * @extends BaseEntity
 */
export interface FormState extends BaseEntity {
  fields: Array<{
    id: string;
    type: FieldType;
    label: string;
    value: unknown;
    validation: ValidationRule[];
    isValid: boolean;
    isTouched: boolean;
    errors: ValidationError[];
  }>;
  style: FormFieldStyle;
  validation: ValidationRule[];
  isDirty: boolean;
  isValid: boolean;
  submissionState: FormSubmissionState;
  errors: ValidationError[];
  theme: ThemeConfig;
  metadata: {
    lastSaved?: Date;
    version: string;
    analytics?: {
      impressions: number;
      submissions: number;
      conversionRate: number;
    };
  };
}

/**
 * Type guard for FormState validation
 * @param state - State to validate
 */
export const isValidFormState = (state: unknown): state is FormState => {
  const formStateSchema = z.object({
    fields: z.array(z.object({
      id: z.string(),
      type: z.nativeEnum(FieldType),
      label: z.string(),
      value: z.unknown(),
      validation: z.array(z.object({
        schema: z.instanceof(z.ZodSchema),
        message: z.string(),
        type: z.nativeEnum(ValidationRuleType)
      })),
      isValid: z.boolean(),
      isTouched: z.boolean(),
      errors: z.array(z.object({
        field: z.string(),
        message: z.string(),
        type: z.nativeEnum(ValidationRuleType)
      }))
    })),
    style: z.object({
      backgroundColor: z.string(),
      textColor: z.string(),
      borderColor: z.string(),
      borderRadius: z.string(),
      fontSize: z.string(),
      padding: z.string(),
      responsive: z.record(z.nativeEnum(Breakpoint), z.any())
    }),
    validation: z.array(z.any()),
    isDirty: z.boolean(),
    isValid: z.boolean(),
    submissionState: z.enum(['idle', 'submitting', 'submitted', 'error']),
    errors: z.array(z.object({
      field: z.string(),
      message: z.string(),
      type: z.nativeEnum(ValidationRuleType)
    })),
    theme: z.object({
      mode: z.enum(['light', 'dark']),
      colors: z.object({
        primary: z.string(),
        secondary: z.string(),
        success: z.string(),
        error: z.string(),
        neutral: z.string()
      }),
      typography: z.object({
        fontFamily: z.string(),
        headingSizes: z.record(z.string()),
        bodyText: z.record(z.string())
      }),
      spacing: z.object({
        base: z.number(),
        scale: z.array(z.number())
      })
    })
  });

  return formStateSchema.safeParse(state).success;
};

// Export additional utility types for form builder components
export type FormFieldProps = Pick<FormState['fields'][0], 'id' | 'type' | 'label' | 'validation'>;
export type FormStyleProps = Pick<FormFieldStyle, 'backgroundColor' | 'textColor' | 'borderColor' | 'borderRadius'>;
export type FormThemeProps = Pick<ThemeConfig, 'mode' | 'colors' | 'typography'>;