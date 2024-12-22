import { FieldType, ValidationRuleType } from '../../../backend/shared/types/form.types';
import { FormFieldStyle, Breakpoint } from '../../types/form';

/**
 * Available field types for form builder
 * @constant
 */
export const FIELD_TYPES: Record<string, FieldType> = {
  TEXT: FieldType.TEXT,
  EMAIL: FieldType.EMAIL,
  PHONE: FieldType.PHONE,
  SELECT: FieldType.SELECT,
  CHECKBOX: FieldType.CHECKBOX,
  RADIO: FieldType.RADIO,
  DATE: FieldType.DATE,
  FILE: FieldType.FILE,
  SIGNATURE: FieldType.SIGNATURE,
  LOCATION: FieldType.LOCATION,
  RICH_TEXT: FieldType.RICH_TEXT,
  NUMBER: FieldType.NUMBER
};

/**
 * Default styling values for form fields aligned with design system
 * @constant
 */
export const DEFAULT_FIELD_STYLES: FormFieldStyle = {
  backgroundColor: '#FFFFFF',
  textColor: '#1F2937',
  borderColor: '#E5E7EB',
  borderRadius: '0.375rem',
  fontSize: '1rem',
  padding: '0.75rem',
  fontFamily: 'Inter, sans-serif',
  boxShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
  transition: 'all 0.2s ease-in-out',
  responsive: {
    [Breakpoint.MOBILE]: {
      fontSize: '0.875rem',
      padding: '0.5rem'
    },
    [Breakpoint.TABLET]: {
      fontSize: '0.9375rem',
      padding: '0.625rem'
    }
  },
  hover: {
    borderColor: '#2563EB',
    boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1)'
  },
  focus: {
    borderColor: '#2563EB',
    boxShadow: '0 0 0 3px rgba(37, 99, 235, 0.2)'
  },
  disabled: {
    backgroundColor: '#F3F4F6',
    cursor: 'not-allowed'
  }
};

/**
 * Enhanced validation rules for form fields
 * @constant
 */
export const VALIDATION_RULES = {
  REQUIRED: {
    type: ValidationRuleType.REQUIRED,
    message: 'This field is required',
    isAsync: false
  },
  EMAIL: {
    type: ValidationRuleType.EMAIL,
    message: 'Please enter a valid email address',
    isAsync: false
  },
  PHONE: {
    type: ValidationRuleType.PHONE,
    message: 'Please enter a valid phone number',
    isAsync: false
  },
  MIN_LENGTH: {
    type: ValidationRuleType.MIN_LENGTH,
    message: 'Minimum length not met',
    isAsync: false
  },
  MAX_LENGTH: {
    type: ValidationRuleType.MAX_LENGTH,
    message: 'Maximum length exceeded',
    isAsync: false
  },
  FILE_SIZE: {
    type: ValidationRuleType.FILE_SIZE,
    message: 'File size exceeds limit',
    isAsync: false
  },
  FILE_TYPE: {
    type: ValidationRuleType.FILE_TYPE,
    message: 'File type not supported',
    isAsync: false
  },
  CUSTOM: {
    type: ValidationRuleType.CUSTOM,
    message: 'Validation failed',
    isAsync: false
  },
  ASYNC: {
    type: ValidationRuleType.ASYNC,
    message: 'Validation pending',
    isAsync: true
  },
  DEPENDENT: {
    type: ValidationRuleType.DEPENDENT,
    message: 'Dependent field validation failed',
    isAsync: false
  }
};

/**
 * Form builder configuration constants
 * @constant
 */
export const FORM_BUILDER_CONFIG = {
  MAX_FIELDS: 50,
  MIN_FIELDS: 1,
  DRAG_HANDLE_ID: 'form-field-drag-handle',
  FIELD_LIST_ID: 'form-field-list',
  AUTOSAVE_DELAY: 1000,
  MAX_FILE_SIZE: 5 * 1024 * 1024, // 5MB
  SUPPORTED_FILE_TYPES: ['image/jpeg', 'image/png', 'application/pdf'],
  GRID_COLUMNS: 12
};

/**
 * Default values and configurations for each field type
 * @constant
 */
export const FIELD_DEFAULTS: Record<FieldType, any> = {
  [FieldType.TEXT]: {
    defaultValue: '',
    placeholder: 'Enter text',
    ariaLabel: 'Text input field'
  },
  [FieldType.EMAIL]: {
    defaultValue: '',
    placeholder: 'Enter email address',
    ariaLabel: 'Email input field'
  },
  [FieldType.PHONE]: {
    defaultValue: '',
    placeholder: '(555) 555-5555',
    ariaLabel: 'Phone number input field'
  },
  [FieldType.NUMBER]: {
    defaultValue: null,
    placeholder: 'Enter number',
    ariaLabel: 'Numeric input field'
  },
  [FieldType.DATE]: {
    defaultValue: null,
    placeholder: 'Select date',
    ariaLabel: 'Date picker field'
  },
  [FieldType.SELECT]: {
    defaultValue: '',
    placeholder: 'Select an option',
    ariaLabel: 'Dropdown selection field'
  },
  [FieldType.CHECKBOX]: {
    defaultValue: false,
    ariaLabel: 'Checkbox field'
  },
  [FieldType.RADIO]: {
    defaultValue: '',
    ariaLabel: 'Radio button field'
  },
  [FieldType.FILE]: {
    defaultValue: null,
    ariaLabel: 'File upload field'
  },
  [FieldType.SIGNATURE]: {
    defaultValue: null,
    ariaLabel: 'Signature field'
  },
  [FieldType.LOCATION]: {
    defaultValue: null,
    placeholder: 'Select location',
    ariaLabel: 'Location picker field'
  },
  [FieldType.RICH_TEXT]: {
    defaultValue: '',
    placeholder: 'Enter formatted text',
    ariaLabel: 'Rich text editor field'
  }
};

/**
 * Validation message templates with parameter support
 * @constant
 */
export const VALIDATION_MESSAGES = {
  messages: {
    [ValidationRuleType.REQUIRED]: 'This field is required',
    [ValidationRuleType.EMAIL]: 'Please enter a valid email address',
    [ValidationRuleType.PHONE]: 'Please enter a valid phone number',
    [ValidationRuleType.FILE_SIZE]: 'File size must not exceed ${maxSize}MB',
    [ValidationRuleType.FILE_TYPE]: 'Supported file types: ${types}',
    [ValidationRuleType.CUSTOM]: '${message}'
  },
  templates: {
    minLength: (min: number) => `Minimum ${min} characters required`,
    maxLength: (max: number) => `Maximum ${max} characters allowed`,
    fileSize: (size: number) => `File size must not exceed ${size}MB`,
    fileType: (types: string[]) => `Supported file types: ${types.join(', ')}`
  }
};

/**
 * Responsive design breakpoints from design system
 * @constant
 */
export const RESPONSIVE_BREAKPOINTS = {
  breakpoints: {
    mobile: 320,
    tablet: 768,
    desktop: 1024,
    wide: 1280
  },
  mediaQueries: {
    mobile: `@media (min-width: 320px)`,
    tablet: `@media (min-width: 768px)`,
    desktop: `@media (min-width: 1024px)`,
    wide: `@media (min-width: 1280px)`
  }
};

/**
 * Default form state
 * @constant
 */
export const DEFAULT_FORM_STATE = {
  fields: [],
  style: DEFAULT_FIELD_STYLES,
  validation: [],
  isDirty: false,
  isValid: true,
  submissionState: 'idle' as const,
  errors: [],
  theme: {
    mode: 'light' as const,
    colors: {
      primary: '#2563EB',
      secondary: '#3B82F6',
      success: '#10B981',
      error: '#EF4444',
      neutral: '#1F2937'
    },
    typography: {
      fontFamily: 'Inter, sans-serif',
      headingSizes: {
        h1: '3rem',
        h2: '2rem',
        h3: '1.5rem',
        h4: '1.25rem',
        h5: '1rem'
      },
      bodyText: {
        large: '1.125rem',
        regular: '1rem',
        small: '0.875rem'
      }
    },
    spacing: {
      base: 4,
      scale: [4, 8, 12, 16, 24, 32, 48]
    }
  }
};