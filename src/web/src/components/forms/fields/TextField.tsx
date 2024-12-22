import React, { useCallback, useEffect, useMemo, useState } from 'react';
import classNames from 'classnames'; // v2.3.2
import { Input } from '../../shared/Input';
import { FormFieldStyle } from '../../../types/form';
import { validateFormField } from '../../../lib/utils/validation';
import { DEFAULT_FIELD_STYLES, VALIDATION_MESSAGES } from '../../../lib/constants/forms';
import { FieldType, ValidationRuleType } from '../../../backend/shared/types/form.types';

/**
 * Props interface for TextField component with enhanced validation and styling support
 */
interface TextFieldProps {
  id: string;
  name: string;
  value: string;
  placeholder?: string;
  label?: string;
  validationRules?: Array<{
    type: ValidationRuleType;
    message?: string;
    value?: unknown;
  }>;
  asyncValidationRules?: Array<{
    type: ValidationRuleType.ASYNC;
    validatorFn: string;
    message?: string;
  }>;
  style?: FormFieldStyle;
  required?: boolean;
  disabled?: boolean;
  theme?: {
    mode: 'light' | 'dark';
    colors: Record<string, string>;
  };
  onChange?: (value: string) => void;
  onValidation?: (isValid: boolean, errors?: string[]) => void;
  onFocus?: () => void;
  onBlur?: () => void;
}

/**
 * TextField component for form builder with enhanced validation, styling, and accessibility
 * @component
 * @version 1.0.0
 */
const TextField: React.FC<TextFieldProps> = React.memo(({
  id,
  name,
  value,
  placeholder,
  label,
  validationRules = [],
  asyncValidationRules = [],
  style = DEFAULT_FIELD_STYLES,
  required = false,
  disabled = false,
  theme,
  onChange,
  onValidation,
  onFocus,
  onBlur
}) => {
  // State management
  const [internalValue, setInternalValue] = useState<string>(value);
  const [isTouched, setIsTouched] = useState<boolean>(false);
  const [isValidating, setIsValidating] = useState<boolean>(false);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);

  // Merge validation rules
  const allValidationRules = useMemo(() => {
    const rules = [...validationRules];
    if (required) {
      rules.unshift({
        type: ValidationRuleType.REQUIRED,
        message: VALIDATION_MESSAGES.messages[ValidationRuleType.REQUIRED]
      });
    }
    return rules;
  }, [validationRules, required]);

  // Generate unique field ID
  const fieldId = useMemo(() => 
    id || `text-field-${name}-${Math.random().toString(36).substr(2, 9)}`,
    [id, name]
  );

  // Merge styles with theme
  const mergedStyles = useMemo(() => ({
    ...DEFAULT_FIELD_STYLES,
    ...style,
    ...(theme?.mode === 'dark' ? {
      backgroundColor: '#1F2937',
      textColor: '#F9FAFB',
      borderColor: '#374151'
    } : {}),
    ...(theme?.colors ? {
      borderColor: theme.colors.primary,
      focus: {
        ...DEFAULT_FIELD_STYLES.focus,
        borderColor: theme.colors.primary,
        boxShadow: `0 0 0 3px ${theme.colors.primary}33`
      }
    } : {})
  }), [style, theme]);

  /**
   * Validates the field value using synchronous and asynchronous rules
   */
  const validateField = useCallback(async (valueToValidate: string) => {
    setIsValidating(true);
    try {
      const validationResult = await validateFormField(
        valueToValidate,
        allValidationRules,
        FieldType.TEXT
      );

      setValidationErrors(validationResult.errors.map(error => error.message));
      onValidation?.(validationResult.isValid, validationResult.errors.map(error => error.message));
      
      return validationResult.isValid;
    } catch (error) {
      console.error('TextField validation error:', error);
      return false;
    } finally {
      setIsValidating(false);
    }
  }, [allValidationRules, onValidation]);

  /**
   * Handles input value changes with debounced validation
   */
  const handleChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    setInternalValue(newValue);
    onChange?.(newValue);

    if (isTouched) {
      await validateField(newValue);
    }
  }, [onChange, validateField, isTouched]);

  /**
   * Handles input blur events
   */
  const handleBlur = useCallback(async () => {
    setIsTouched(true);
    await validateField(internalValue);
    onBlur?.();
  }, [validateField, internalValue, onBlur]);

  /**
   * Handles input focus events
   */
  const handleFocus = useCallback(() => {
    onFocus?.();
  }, [onFocus]);

  // Validate initial value
  useEffect(() => {
    if (value !== internalValue) {
      setInternalValue(value);
      if (isTouched) {
        validateField(value);
      }
    }
  }, [value, validateField, isTouched, internalValue]);

  return (
    <Input
      id={fieldId}
      name={name}
      type="text"
      value={internalValue}
      placeholder={placeholder}
      label={label}
      error={validationErrors[0]}
      required={required}
      disabled={disabled}
      style={mergedStyles}
      validationOptions={{
        rules: allValidationRules,
        validateOnBlur: true,
        validateOnChange: true
      }}
      ariaProps={{
        label: label || name,
        description: placeholder,
        errorMessage: validationErrors[0],
        required,
        invalid: validationErrors.length > 0
      }}
      onChange={handleChange}
      onBlur={handleBlur}
      onFocus={handleFocus}
    />
  );
});

TextField.displayName = 'TextField';

export default TextField;