import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import classNames from 'classnames'; // v2.3.2
import { FormFieldStyle } from '../../types/form';
import { validateFormField } from '../../lib/utils/validation';
import { DEFAULT_FIELD_STYLES, FIELD_DEFAULTS, VALIDATION_RULES } from '../../lib/constants/forms';
import { FieldType, ValidationRuleType } from '../../../backend/shared/types/form.types';

/**
 * Enhanced props interface for Input component with accessibility and validation support
 */
interface InputProps {
  id?: string;
  name: string;
  type: string;
  value: string | number | undefined;
  placeholder?: string;
  label?: string;
  error?: string;
  required?: boolean;
  disabled?: boolean;
  style?: FormFieldStyle;
  themeOverrides?: Record<string, unknown>;
  responsiveStyles?: Record<string, unknown>;
  validationOptions?: {
    rules?: Array<{
      type: ValidationRuleType;
      message?: string;
      value?: unknown;
    }>;
    validateOnBlur?: boolean;
    validateOnChange?: boolean;
  };
  ariaProps?: {
    label?: string;
    description?: string;
    errorMessage?: string;
    required?: boolean;
    invalid?: boolean;
  };
  onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onBlur?: (e: React.FocusEvent<HTMLInputElement>) => void;
  onKeyDown?: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  onFileUpload?: (files: FileList) => Promise<void>;
}

/**
 * Enhanced reusable input component with accessibility, validation, and theme support
 */
const Input: React.FC<InputProps> = React.memo(({
  id,
  name,
  type,
  value,
  placeholder,
  label,
  error,
  required = false,
  disabled = false,
  style = DEFAULT_FIELD_STYLES,
  themeOverrides,
  responsiveStyles,
  validationOptions = {},
  ariaProps = {},
  onChange,
  onBlur,
  onKeyDown,
  onFileUpload
}) => {
  // Generate unique ID if not provided
  const inputId = useMemo(() => id || `input-${name}-${Math.random().toString(36).substr(2, 9)}`, [id, name]);
  const inputRef = useRef<HTMLInputElement>(null);
  const [isFocused, setIsFocused] = useState(false);
  const [internalError, setInternalError] = useState<string | undefined>(error);
  const [isValidating, setIsValidating] = useState(false);

  // Merge base styles with overrides and responsive styles
  const mergedStyles = useMemo(() => ({
    ...DEFAULT_FIELD_STYLES,
    ...style,
    ...(themeOverrides as Partial<FormFieldStyle>),
    responsive: {
      ...DEFAULT_FIELD_STYLES.responsive,
      ...(style?.responsive || {}),
      ...(responsiveStyles || {})
    }
  }), [style, themeOverrides, responsiveStyles]);

  // Get field type defaults
  const fieldDefaults = useMemo(() => {
    const fieldType = Object.entries(FieldType).find(([_, value]) => 
      value.toLowerCase() === type.toLowerCase()
    );
    return fieldType ? FIELD_DEFAULTS[fieldType[1]] : FIELD_DEFAULTS[FieldType.TEXT];
  }, [type]);

  // Handle validation
  const validateInput = useCallback(async (inputValue: string | number | undefined) => {
    if (!validationOptions.rules?.length) return true;

    setIsValidating(true);
    try {
      const result = await validateFormField(
        inputValue,
        validationOptions.rules.map(rule => ({
          ...rule,
          message: rule.message || VALIDATION_RULES[rule.type].message,
          isAsync: VALIDATION_RULES[rule.type].isAsync
        })),
        type.toUpperCase() as FieldType
      );

      setInternalError(result.errors[0]?.message);
      return result.isValid;
    } catch (err) {
      console.error('Validation error:', err);
      return false;
    } finally {
      setIsValidating(false);
    }
  }, [validationOptions.rules, type]);

  // Handle file upload
  const handleFileChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0 && onFileUpload) {
      try {
        await onFileUpload(files);
      } catch (err) {
        console.error('File upload error:', err);
        setInternalError('File upload failed');
      }
    }
  }, [onFileUpload]);

  // Handle input change
  const handleChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange?.(e);
    if (validationOptions.validateOnChange) {
      await validateInput(e.target.value);
    }
  }, [onChange, validateInput, validationOptions.validateOnChange]);

  // Handle input blur
  const handleBlur = useCallback(async (e: React.FocusEvent<HTMLInputElement>) => {
    setIsFocused(false);
    onBlur?.(e);
    if (validationOptions.validateOnBlur) {
      await validateInput(e.target.value);
    }
  }, [onBlur, validateInput, validationOptions.validateOnBlur]);

  // Handle keyboard interaction
  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    onKeyDown?.(e);
    if (e.key === 'Enter' && type !== 'textarea') {
      e.currentTarget.blur();
    }
  }, [onKeyDown, type]);

  // Update error state when error prop changes
  useEffect(() => {
    setInternalError(error);
  }, [error]);

  // Generate input classes
  const inputClasses = classNames(
    'form-input',
    {
      'form-input--focused': isFocused,
      'form-input--error': internalError,
      'form-input--disabled': disabled,
      'form-input--validating': isValidating
    }
  );

  // Generate ARIA attributes
  const ariaAttributes = {
    'aria-label': ariaProps.label || label,
    'aria-describedby': ariaProps.description ? `${inputId}-description` : undefined,
    'aria-errormessage': internalError ? `${inputId}-error` : undefined,
    'aria-required': required || ariaProps.required,
    'aria-invalid': internalError ? true : ariaProps.invalid,
    'aria-busy': isValidating
  };

  return (
    <div className="form-field" style={mergedStyles}>
      {label && (
        <label
          htmlFor={inputId}
          className="form-field__label"
          style={{
            color: mergedStyles.textColor,
            fontFamily: mergedStyles.fontFamily,
            fontSize: mergedStyles.fontSize
          }}
        >
          {label}
          {required && <span className="form-field__required" aria-hidden="true">*</span>}
        </label>
      )}

      <input
        ref={inputRef}
        id={inputId}
        name={name}
        type={type}
        value={value}
        placeholder={placeholder || fieldDefaults.placeholder}
        className={inputClasses}
        disabled={disabled}
        onChange={type === 'file' ? handleFileChange : handleChange}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        onFocus={() => setIsFocused(true)}
        style={{
          backgroundColor: mergedStyles.backgroundColor,
          color: mergedStyles.textColor,
          borderColor: internalError ? mergedStyles.error?.borderColor : mergedStyles.borderColor,
          borderRadius: mergedStyles.borderRadius,
          padding: mergedStyles.padding,
          fontSize: mergedStyles.fontSize,
          fontFamily: mergedStyles.fontFamily,
          boxShadow: mergedStyles.boxShadow,
          transition: mergedStyles.transition,
          ...(isFocused ? mergedStyles.focus : {}),
          ...(disabled ? mergedStyles.disabled : {})
        }}
        {...ariaAttributes}
      />

      {internalError && (
        <div
          id={`${inputId}-error`}
          className="form-field__error"
          role="alert"
          aria-live="polite"
          style={{
            color: mergedStyles.error?.textColor || '#EF4444',
            fontSize: `calc(${mergedStyles.fontSize} * 0.875)`,
            marginTop: '0.25rem'
          }}
        >
          {internalError}
        </div>
      )}

      {ariaProps.description && (
        <div
          id={`${inputId}-description`}
          className="form-field__description"
          style={{
            color: mergedStyles.textColor,
            fontSize: `calc(${mergedStyles.fontSize} * 0.875)`,
            marginTop: '0.25rem'
          }}
        >
          {ariaProps.description}
        </div>
      )}
    </div>
  );
});

Input.displayName = 'Input';

export default Input;