import React, { useCallback, useState } from 'react';
import classNames from 'classnames'; // v2.3.2
import { useTranslation } from 'react-i18next'; // v12.0.0
import Input from '../../shared/Input';
import { validateEmail } from '../../../lib/utils/validation';
import type { FormFieldStyle } from '../../../types/form';

/**
 * Props interface for EmailField component with enhanced validation and accessibility
 */
interface EmailFieldProps {
  id: string;
  name: string;
  value: string;
  placeholder?: string;
  label?: string;
  required?: boolean;
  disabled?: boolean;
  style?: FormFieldStyle;
  onChange: (value: string) => Promise<void>;
  onBlur?: () => void;
  loading?: boolean;
  errorMessage?: string;
  helpText?: string;
  aria?: Record<string, string>;
}

/**
 * Enhanced email field component with validation, accessibility, and design system integration
 * Implements WCAG 2.1 Level AA compliance
 */
const EmailField: React.FC<EmailFieldProps> = ({
  id,
  name,
  value,
  placeholder = 'Enter email address',
  label,
  required = false,
  disabled = false,
  style,
  onChange,
  onBlur,
  loading = false,
  errorMessage,
  helpText,
  aria = {}
}) => {
  const { t } = useTranslation();
  const [isValidating, setIsValidating] = useState(false);
  const [internalError, setInternalError] = useState<string | undefined>(errorMessage);

  /**
   * Enhanced email input change handler with validation
   */
  const handleChange = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const emailValue = event.target.value;
    setIsValidating(true);

    try {
      const validationResult = await validateEmail(emailValue);
      
      if (!validationResult.isValid) {
        setInternalError(t(validationResult.errors[0]?.message || 'Invalid email format'));
      } else {
        setInternalError(undefined);
      }

      await onChange(emailValue);
    } catch (error) {
      console.error('Email validation error:', error);
      setInternalError(t('Error validating email'));
    } finally {
      setIsValidating(false);
    }
  }, [onChange, t]);

  /**
   * Enhanced blur event handler with final validation
   */
  const handleBlur = useCallback(async (event: React.FocusEvent<HTMLInputElement>) => {
    try {
      const validationResult = await validateEmail(event.target.value);
      if (!validationResult.isValid) {
        setInternalError(t(validationResult.errors[0]?.message || 'Invalid email format'));
      }
    } catch (error) {
      console.error('Email validation error on blur:', error);
    }

    onBlur?.();
  }, [onBlur, t]);

  // Generate unique IDs for accessibility
  const inputId = id || `email-field-${name}`;
  const errorId = `${inputId}-error`;
  const helpTextId = `${inputId}-help`;

  // Combine ARIA attributes
  const ariaAttributes = {
    'aria-label': aria.label || label,
    'aria-required': required,
    'aria-invalid': !!internalError,
    'aria-errormessage': internalError ? errorId : undefined,
    'aria-describedby': helpText ? helpTextId : undefined,
    ...aria
  };

  // Generate class names
  const fieldClasses = classNames(
    'email-field',
    {
      'email-field--error': internalError,
      'email-field--disabled': disabled,
      'email-field--loading': loading || isValidating
    }
  );

  return (
    <div className={fieldClasses}>
      <Input
        id={inputId}
        name={name}
        type="email"
        value={value}
        placeholder={placeholder}
        label={label}
        required={required}
        disabled={disabled}
        style={style}
        error={internalError}
        onChange={handleChange}
        onBlur={handleBlur}
        validationOptions={{
          validateOnChange: true,
          validateOnBlur: true,
          rules: [
            {
              type: 'EMAIL',
              message: t('Please enter a valid email address')
            }
          ]
        }}
        ariaProps={ariaAttributes}
      />

      {helpText && (
        <div
          id={helpTextId}
          className="email-field__help-text"
          aria-hidden="true"
        >
          {helpText}
        </div>
      )}

      {(loading || isValidating) && (
        <div 
          className="email-field__loading-indicator" 
          role="status"
          aria-label={t('Validating email')}
        >
          <span className="sr-only">{t('Validating email')}</span>
        </div>
      )}
    </div>
  );
};

EmailField.displayName = 'EmailField';

export default EmailField;