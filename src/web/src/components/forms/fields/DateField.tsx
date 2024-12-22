import React, { useCallback, useMemo, useState } from 'react';
import { format, isValid, parse } from 'date-fns'; // v2.30.0
import classNames from 'classnames'; // v2.3.2
import Input from '../../shared/Input';
import { FormFieldStyle } from '../../../types/form';
import { validateFormField } from '../../../lib/utils/validation';
import { FieldType, ValidationRuleType } from '../../../backend/shared/types/form.types';

/**
 * Props interface for DateField component with comprehensive validation and accessibility support
 */
interface DateFieldProps {
  id: string;
  name: string;
  label: string;
  value: string;
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
  style?: FormFieldStyle;
  minDate?: string;
  maxDate?: string;
  dateFormat?: string;
  locale?: string;
  errorMessage?: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
  onError?: (error: string) => void;
}

/**
 * Enhanced date field component with comprehensive validation, accessibility, and internationalization support
 * Implements WCAG 2.1 Level AA compliance and integrates with the design system
 */
const DateField: React.FC<DateFieldProps> = React.memo(({
  id,
  name,
  label,
  value,
  placeholder = 'YYYY-MM-DD',
  required = false,
  disabled = false,
  style,
  minDate,
  maxDate,
  dateFormat = 'yyyy-MM-dd',
  locale = 'en-US',
  errorMessage,
  onChange,
  onBlur,
  onError
}) => {
  // Local state for internal validation and formatting
  const [isTouched, setIsTouched] = useState(false);
  const [internalError, setInternalError] = useState<string | undefined>(errorMessage);

  // Memoize validation rules based on props
  const validationRules = useMemo(() => {
    const rules = [];

    if (required) {
      rules.push({
        type: ValidationRuleType.REQUIRED,
        message: 'Please select a date',
      });
    }

    if (minDate) {
      rules.push({
        type: ValidationRuleType.CUSTOM,
        message: `Date must be after ${minDate}`,
        validatorFn: `(value) => new Date(value) >= new Date('${minDate}')`
      });
    }

    if (maxDate) {
      rules.push({
        type: ValidationRuleType.CUSTOM,
        message: `Date must be before ${maxDate}`,
        validatorFn: `(value) => new Date(value) <= new Date('${maxDate}')`
      });
    }

    return rules;
  }, [required, minDate, maxDate]);

  // Format date value according to specified format
  const formatDateValue = useCallback((dateString: string): string => {
    if (!dateString) return '';

    try {
      const parsedDate = parse(dateString, 'yyyy-MM-dd', new Date());
      if (isValid(parsedDate)) {
        return format(parsedDate, dateFormat, { locale: require(`date-fns/locale/${locale}`) });
      }
      return dateString;
    } catch (error) {
      console.error('Date formatting error:', error);
      return dateString;
    }
  }, [dateFormat, locale]);

  // Handle date value changes with validation
  const handleChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    
    try {
      // Validate the date format and range
      const validationResult = await validateFormField(
        newValue,
        validationRules,
        FieldType.DATE
      );

      if (!validationResult.isValid) {
        const error = validationResult.errors[0]?.message;
        setInternalError(error);
        onError?.(error);
      } else {
        setInternalError(undefined);
        onError?.('');
      }

      onChange(newValue);
    } catch (error) {
      console.error('Date validation error:', error);
      const errorMessage = 'Invalid date format';
      setInternalError(errorMessage);
      onError?.(errorMessage);
    }
  }, [onChange, onError, validationRules]);

  // Handle blur event for validation
  const handleBlur = useCallback(() => {
    setIsTouched(true);
    onBlur?.();
  }, [onBlur]);

  // Generate ARIA attributes for accessibility
  const ariaAttributes = {
    'aria-label': label,
    'aria-required': required,
    'aria-invalid': !!internalError,
    'aria-describedby': internalError ? `${id}-error` : undefined,
  };

  // Render the date field using the base Input component
  return (
    <Input
      id={id}
      name={name}
      type="date"
      value={value}
      onChange={handleChange}
      onBlur={handleBlur}
      placeholder={placeholder}
      label={label}
      error={internalError}
      required={required}
      disabled={disabled}
      style={style}
      validationOptions={{
        rules: validationRules,
        validateOnBlur: true,
        validateOnChange: true,
      }}
      ariaProps={ariaAttributes}
      themeOverrides={{
        input: {
          appearance: 'none',
          paddingRight: '0.75rem',
          cursor: 'pointer',
        },
        calendar: {
          zIndex: 10,
          backgroundColor: style?.backgroundColor || '#FFFFFF',
          borderColor: style?.borderColor || '#E5E7EB',
          boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
        },
      }}
    />
  );
});

// Set display name for debugging
DateField.displayName = 'DateField';

export default DateField;