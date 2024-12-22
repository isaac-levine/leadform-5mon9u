// @ts-check
import React from 'react'; // v18.0.0
import classNames from 'classnames'; // v2.3.2
import { FormFieldStyle } from '../../../types/form';
import { validateFormField } from '../../../lib/utils/validation';
import { DEFAULT_FIELD_STYLES, FIELD_DEFAULTS, VALIDATION_RULES } from '../../../lib/constants/forms';
import { FieldType } from '../../../../backend/shared/types/form.types';

/**
 * Props interface for the CheckboxField component
 */
interface CheckboxFieldProps {
  id: string;
  name: string;
  checked: boolean;
  label: string;
  error?: string;
  required?: boolean;
  disabled?: boolean;
  style?: FormFieldStyle;
  onChange: (checked: boolean) => void;
  onBlur?: (e: React.FocusEvent<HTMLInputElement>) => void;
  'data-testid'?: string;
  themeOverrides?: Partial<FormFieldStyle>;
  validationRules?: Array<{
    type: string;
    message: string;
    isAsync?: boolean;
  }>;
  validateOnChange?: boolean;
}

/**
 * A reusable, accessible checkbox field component with theme support and validation
 */
const CheckboxField = React.memo(({
  id,
  name,
  checked,
  label,
  error,
  required = false,
  disabled = false,
  style = DEFAULT_FIELD_STYLES,
  onChange,
  onBlur,
  'data-testid': dataTestId,
  themeOverrides,
  validationRules = [],
  validateOnChange = true
}: CheckboxFieldProps) => {
  // Generate unique IDs for accessibility
  const inputId = `checkbox-${id}`;
  const errorId = `checkbox-error-${id}`;
  const labelId = `checkbox-label-${id}`;

  // Merge default styles with theme overrides
  const mergedStyles = React.useMemo(() => ({
    ...DEFAULT_FIELD_STYLES,
    ...style,
    ...themeOverrides
  }), [style, themeOverrides]);

  // Setup validation state
  const [validationError, setValidationError] = React.useState<string | undefined>(error);
  const [isValidating, setIsValidating] = React.useState(false);

  // Handle validation with debounce
  const validateField = React.useCallback(async (value: boolean) => {
    if (!validateOnChange || isValidating) return;

    setIsValidating(true);
    const result = await validateFormField(
      value,
      validationRules,
      FieldType.CHECKBOX
    );
    
    setValidationError(result.errors[0]?.message);
    setIsValidating(false);
  }, [validationRules, validateOnChange, isValidating]);

  // Handle change events
  const handleChange = React.useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const newChecked = e.target.checked;
    onChange(newChecked);
    
    if (validateOnChange) {
      validateField(newChecked);
    }
  }, [onChange, validateOnChange, validateField]);

  // Handle blur events
  const handleBlur = React.useCallback((e: React.FocusEvent<HTMLInputElement>) => {
    validateField(e.target.checked);
    onBlur?.(e);
  }, [onBlur, validateField]);

  // Generate CSS classes
  const checkboxClasses = classNames(
    'form-checkbox',
    {
      'form-checkbox--error': validationError,
      'form-checkbox--disabled': disabled,
      'form-checkbox--checked': checked
    }
  );

  const wrapperClasses = classNames(
    'form-checkbox-wrapper',
    {
      'form-checkbox-wrapper--disabled': disabled,
      'form-checkbox-wrapper--error': validationError
    }
  );

  // Custom styles based on theme
  const checkboxStyles = {
    '--checkbox-bg': mergedStyles.backgroundColor,
    '--checkbox-border': mergedStyles.borderColor,
    '--checkbox-text': mergedStyles.textColor,
    '--checkbox-size': '1.25rem',
    '--checkbox-border-radius': mergedStyles.borderRadius,
    '--checkbox-transition': mergedStyles.transition,
    ...(checked && {
      '--checkbox-bg': mergedStyles.theme?.colors?.primary || '#2563EB',
      '--checkbox-border': mergedStyles.theme?.colors?.primary || '#2563EB'
    }),
    ...(validationError && {
      '--checkbox-border': mergedStyles.theme?.colors?.error || '#EF4444'
    })
  } as React.CSSProperties;

  return (
    <div className={wrapperClasses} style={checkboxStyles}>
      <div className="form-checkbox-input-wrapper">
        <input
          id={inputId}
          type="checkbox"
          name={name}
          checked={checked}
          disabled={disabled}
          required={required}
          onChange={handleChange}
          onBlur={handleBlur}
          className={checkboxClasses}
          aria-describedby={validationError ? errorId : undefined}
          aria-labelledby={labelId}
          aria-required={required}
          aria-invalid={!!validationError}
          data-testid={dataTestId}
          {...FIELD_DEFAULTS[FieldType.CHECKBOX]}
        />
        <label 
          id={labelId}
          htmlFor={inputId}
          className="form-checkbox-label"
        >
          {label}
          {required && <span className="form-checkbox-required" aria-hidden="true">*</span>}
        </label>
      </div>
      {validationError && (
        <div
          id={errorId}
          className="form-checkbox-error"
          role="alert"
          aria-live="polite"
        >
          {validationError}
        </div>
      )}
    </div>
  );
});

// Display name for debugging
CheckboxField.displayName = 'CheckboxField';

export default CheckboxField;