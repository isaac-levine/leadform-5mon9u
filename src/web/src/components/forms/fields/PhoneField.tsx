import React, { useCallback, useMemo } from 'react';
import { parsePhoneNumberFromString, AsYouType } from 'libphonenumber-js'; // v1.10.0
import { Input } from '../../shared/Input';
import { validatePhoneNumber } from '../../../lib/utils/validation';
import type { FormFieldStyle } from '../../../types/form';

/**
 * Props interface for PhoneField component with accessibility and validation support
 */
interface PhoneFieldProps {
  id: string;
  name: string;
  value: string;
  placeholder?: string;
  label?: string;
  required?: boolean;
  disabled?: boolean;
  style?: FormFieldStyle;
  onChange: (value: string, isValid: boolean) => void;
  onBlur?: () => void;
}

/**
 * Enhanced phone number input field component with international formatting and validation
 */
const PhoneField: React.FC<PhoneFieldProps> = React.memo(({
  id,
  name,
  value,
  placeholder = '(555) 555-5555',
  label = 'Phone Number',
  required = false,
  disabled = false,
  style,
  onChange,
  onBlur
}) => {
  // Format phone number as user types
  const formatPhoneNumber = useCallback((input: string): string => {
    const formatter = new AsYouType('US'); // Default to US formatting
    return formatter.input(input);
  }, []);

  // Validate phone number with proper formatting
  const validateInput = useCallback(async (phoneNumber: string): Promise<boolean> => {
    const parsedNumber = parsePhoneNumberFromString(phoneNumber);
    if (!parsedNumber) return false;

    const validationResult = await validatePhoneNumber(phoneNumber);
    return validationResult.isValid;
  }, []);

  // Handle phone number input changes
  const handleChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const inputValue = e.target.value;
    const formattedValue = formatPhoneNumber(inputValue);
    const isValid = await validateInput(formattedValue);
    
    onChange(formattedValue, isValid);
  }, [formatPhoneNumber, validateInput, onChange]);

  // Enhanced ARIA props for accessibility
  const ariaProps = useMemo(() => ({
    label: `${label}${required ? ' (Required)' : ''}`,
    description: 'Enter your phone number with area code',
    errorMessage: 'Please enter a valid phone number',
    required,
    invalid: false
  }), [label, required]);

  // Validation options for phone number format
  const validationOptions = useMemo(() => ({
    rules: [
      {
        type: 'PHONE',
        message: 'Please enter a valid phone number',
        validateOnChange: true,
        validateOnBlur: true
      }
    ]
  }), []);

  return (
    <Input
      id={id}
      name={name}
      type="tel"
      value={value}
      placeholder={placeholder}
      label={label}
      required={required}
      disabled={disabled}
      style={style}
      ariaProps={ariaProps}
      validationOptions={validationOptions}
      onChange={handleChange}
      onBlur={onBlur}
      onKeyDown={(e) => {
        // Prevent non-numeric input except for allowed special characters
        if (
          !/[\d\s+()-]/.test(e.key) && 
          !['Backspace', 'Delete', 'Tab', 'ArrowLeft', 'ArrowRight'].includes(e.key)
        ) {
          e.preventDefault();
        }
      }}
    />
  );
});

// Display name for debugging
PhoneField.displayName = 'PhoneField';

export default PhoneField;