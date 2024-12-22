import React, { useCallback, useEffect, useRef, useState } from 'react';
import classNames from 'classnames'; // v2.3.2
import { FormFieldStyle } from '../../../types/form';
import { validateFormField } from '../../../lib/utils/validation';
import { DEFAULT_FIELD_STYLES } from '../../../lib/constants/forms';
import { FieldType } from '../../../../backend/shared/types/form.types';

// Interface for radio button option
interface RadioOption {
  value: string;
  label: string;
  description?: string;
  disabled?: boolean;
}

// Props interface for RadioField component
interface RadioFieldProps {
  id: string;
  name: string;
  label: string;
  options: RadioOption[];
  value: string;
  error?: string;
  required?: boolean;
  disabled?: boolean;
  style?: FormFieldStyle;
  description?: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
  validateAsync?: (value: string) => Promise<string | undefined>;
}

/**
 * Enhanced radio field component with accessibility and validation features
 */
const RadioField: React.FC<RadioFieldProps> = React.memo(({
  id,
  name,
  label,
  options,
  value,
  error,
  required = false,
  disabled = false,
  style = DEFAULT_FIELD_STYLES,
  description,
  onChange,
  onBlur,
  validateAsync
}) => {
  // State and refs
  const [internalError, setInternalError] = useState<string | undefined>(error);
  const [isValidating, setIsValidating] = useState(false);
  const radioGroupRef = useRef<HTMLDivElement>(null);
  const validationTimeoutRef = useRef<NodeJS.Timeout>();

  // Generate unique IDs for accessibility
  const fieldId = `radio-${id}`;
  const descriptionId = `${fieldId}-description`;
  const errorId = `${fieldId}-error`;

  // Styles with theme integration
  const radioGroupStyles = {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: style.padding,
    ...style.responsive
  };

  const radioStyles = {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    padding: style.padding,
    borderRadius: style.borderRadius,
    transition: style.transition || 'all 0.2s ease-in-out',
    cursor: disabled ? 'not-allowed' : 'pointer',
    backgroundColor: disabled ? style.disabled?.backgroundColor : style.backgroundColor,
    color: disabled ? style.disabled?.textColor : style.textColor,
    border: `1px solid ${error ? style.errorColor : style.borderColor}`
  };

  // Validation handler
  const handleValidation = useCallback(async (newValue: string) => {
    if (!validateAsync) return;

    setIsValidating(true);
    try {
      const validationResult = await validateFormField(
        newValue,
        [], // Validation rules passed from parent
        FieldType.RADIO
      );

      if (!validationResult.isValid) {
        setInternalError(validationResult.errors[0]?.message);
      } else {
        setInternalError(undefined);
      }
    } catch (err) {
      console.error('Radio field validation error:', err);
      setInternalError('Validation failed');
    } finally {
      setIsValidating(false);
    }
  }, [validateAsync]);

  // Change handler with validation
  const handleChange = useCallback((newValue: string) => {
    onChange(newValue);

    // Debounced validation
    if (validationTimeoutRef.current) {
      clearTimeout(validationTimeoutRef.current);
    }
    validationTimeoutRef.current = setTimeout(() => {
      handleValidation(newValue);
    }, 300);
  }, [onChange, handleValidation]);

  // Keyboard navigation
  const handleKeyDown = useCallback((e: React.KeyboardEvent, optionValue: string) => {
    switch (e.key) {
      case ' ':
      case 'Enter':
        e.preventDefault();
        handleChange(optionValue);
        break;
      case 'ArrowDown':
      case 'ArrowRight':
        e.preventDefault();
        const nextOption = options.find(opt => !opt.disabled && opt.value > value);
        if (nextOption) handleChange(nextOption.value);
        break;
      case 'ArrowUp':
      case 'ArrowLeft':
        e.preventDefault();
        const prevOption = options.find(opt => !opt.disabled && opt.value < value);
        if (prevOption) handleChange(prevOption.value);
        break;
    }
  }, [options, value, handleChange]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (validationTimeoutRef.current) {
        clearTimeout(validationTimeoutRef.current);
      }
    };
  }, []);

  return (
    <div className="radio-field-container">
      <div 
        className="radio-field-label"
        style={{ marginBottom: style.padding }}
      >
        <label 
          htmlFor={fieldId}
          style={{ 
            color: style.textColor,
            fontSize: style.fontSize,
            fontFamily: style.fontFamily
          }}
        >
          {label}
          {required && (
            <span 
              style={{ color: style.errorColor, marginLeft: '0.25rem' }}
              aria-hidden="true"
            >
              *
            </span>
          )}
        </label>
        {description && (
          <div
            id={descriptionId}
            className="radio-field-description"
            style={{ 
              fontSize: '0.875rem',
              color: style.textColor,
              opacity: 0.8,
              marginTop: '0.25rem'
            }}
          >
            {description}
          </div>
        )}
      </div>

      <div
        ref={radioGroupRef}
        role="radiogroup"
        aria-labelledby={fieldId}
        aria-describedby={classNames(description && descriptionId, error && errorId)}
        aria-invalid={!!error}
        aria-busy={isValidating}
        style={radioGroupStyles}
      >
        {options.map((option) => (
          <div
            key={option.value}
            style={radioStyles}
            className={classNames(
              'radio-option',
              option.disabled && 'disabled',
              value === option.value && 'selected'
            )}
          >
            <input
              type="radio"
              id={`${fieldId}-${option.value}`}
              name={name}
              value={option.value}
              checked={value === option.value}
              disabled={disabled || option.disabled}
              onChange={() => handleChange(option.value)}
              onBlur={onBlur}
              onKeyDown={(e) => handleKeyDown(e, option.value)}
              aria-describedby={option.description ? `${fieldId}-${option.value}-description` : undefined}
              style={{
                accentColor: style.focusColor,
                cursor: (disabled || option.disabled) ? 'not-allowed' : 'pointer'
              }}
            />
            <label
              htmlFor={`${fieldId}-${option.value}`}
              style={{
                cursor: (disabled || option.disabled) ? 'not-allowed' : 'pointer',
                opacity: option.disabled ? 0.5 : 1
              }}
            >
              {option.label}
              {option.description && (
                <div
                  id={`${fieldId}-${option.value}-description`}
                  className="option-description"
                  style={{
                    fontSize: '0.875rem',
                    color: style.textColor,
                    opacity: 0.8,
                    marginTop: '0.25rem'
                  }}
                >
                  {option.description}
                </div>
              )}
            </label>
          </div>
        ))}
      </div>

      {(error || internalError) && (
        <div
          id={errorId}
          role="alert"
          className="radio-field-error"
          style={{
            color: style.errorColor,
            fontSize: '0.875rem',
            marginTop: '0.5rem'
          }}
        >
          {error || internalError}
        </div>
      )}
    </div>
  );
});

RadioField.displayName = 'RadioField';

export default RadioField;