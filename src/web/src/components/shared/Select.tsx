import React, { useCallback, useRef, memo } from 'react';
import clsx from 'clsx'; // v2.0.0
import { FormFieldStyle } from '../../../types/form';
import { useAnalytics } from '../../../hooks/useAnalytics';

/**
 * Interface for select option items with enhanced features
 */
interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
  description?: string;
  icon?: string;
}

/**
 * Enhanced props interface for Select component with validation and analytics
 */
interface SelectProps {
  id: string;
  name: string;
  options: SelectOption[];
  value: string;
  placeholder?: string;
  disabled?: boolean;
  style?: FormFieldStyle;
  isError?: boolean;
  errorMessage?: string;
  isLoading?: boolean;
  onChange: (value: string) => void;
  onBlur?: (event: React.FocusEvent<HTMLSelectElement>) => void;
}

/**
 * Enhanced Select component implementing design system specifications with
 * full accessibility support and analytics integration
 */
const Select: React.FC<SelectProps> = memo(({
  id,
  name,
  options,
  value,
  placeholder,
  disabled,
  style,
  isError,
  errorMessage,
  isLoading,
  onChange,
  onBlur
}) => {
  // Refs
  const selectRef = useRef<HTMLSelectElement>(null);

  // Analytics hook
  const { trackFieldInteraction } = useAnalytics();

  /**
   * Enhanced change handler with analytics tracking
   */
  const handleChange = useCallback((event: React.ChangeEvent<HTMLSelectElement>) => {
    event.preventDefault();
    const newValue = event.target.value;
    
    // Track field interaction
    trackFieldInteraction({
      fieldId: id,
      fieldType: 'select',
      action: 'change',
      value: newValue
    });

    onChange(newValue);
  }, [id, onChange, trackFieldInteraction]);

  /**
   * Enhanced blur handler with validation
   */
  const handleBlur = useCallback((event: React.FocusEvent<HTMLSelectElement>) => {
    // Track blur interaction
    trackFieldInteraction({
      fieldId: id,
      fieldType: 'select',
      action: 'blur'
    });

    if (onBlur) {
      onBlur(event);
    }
  }, [id, onBlur, trackFieldInteraction]);

  // Generate dynamic styles based on design system and props
  const selectStyles = {
    backgroundColor: style?.backgroundColor || '#FFFFFF',
    color: style?.textColor || '#1F2937',
    borderColor: isError ? (style?.errorColor || '#EF4444') : (style?.borderColor || '#E5E7EB'),
    borderRadius: style?.borderRadius || '0.375rem',
    fontSize: style?.fontSize || '1rem',
    padding: style?.padding || '0.5rem 2.5rem 0.5rem 0.75rem',
    transition: 'all 150ms ease-in-out',
    cursor: disabled || isLoading ? 'not-allowed' : 'pointer',
    opacity: disabled || isLoading ? 0.5 : 1,
    // Focus styles
    '--focus-color': style?.focusColor || '#2563EB',
    '--focus-ring-color': `${style?.focusColor || '#2563EB'}33` // 20% opacity
  };

  return (
    <div className="relative w-full">
      <select
        ref={selectRef}
        id={id}
        name={name}
        value={value}
        disabled={disabled || isLoading}
        onChange={handleChange}
        onBlur={handleBlur}
        className={clsx(
          'block w-full appearance-none rounded border',
          'focus:outline-none focus:ring-2 focus:border-[var(--focus-color)]',
          'focus:ring-[var(--focus-ring-color)]',
          isError && 'border-[var(--error-color)]',
          disabled && 'cursor-not-allowed opacity-50'
        )}
        style={selectStyles}
        aria-invalid={isError}
        aria-describedby={isError ? `${id}-error` : undefined}
        data-testid={`select-${id}`}
      >
        {placeholder && (
          <option value="" disabled>
            {placeholder}
          </option>
        )}
        {options.map((option) => (
          <option
            key={option.value}
            value={option.value}
            disabled={option.disabled}
            aria-label={option.description}
          >
            {option.icon && `${option.icon} `}{option.label}
          </option>
        ))}
      </select>

      {/* Custom select arrow */}
      <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2">
        <svg
          className="h-4 w-4 fill-current"
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 20 20"
        >
          <path
            fillRule="evenodd"
            d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"
            clipRule="evenodd"
          />
        </svg>
      </div>

      {/* Loading indicator */}
      {isLoading && (
        <div className="absolute inset-y-0 right-8 flex items-center pr-2">
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-[var(--focus-color)] border-t-transparent" />
        </div>
      )}

      {/* Error message */}
      {isError && errorMessage && (
        <p
          id={`${id}-error`}
          className="mt-1 text-sm text-[var(--error-color)]"
          role="alert"
        >
          {errorMessage}
        </p>
      )}
    </div>
  );
});

Select.displayName = 'Select';

export default Select;