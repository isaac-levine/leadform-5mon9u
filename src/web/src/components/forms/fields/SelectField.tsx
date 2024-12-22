/**
 * @fileoverview Enhanced select field component with accessibility, analytics, and validation
 * Implements WCAG 2.1 Level AA compliance and integrates with form builder state management
 * @version 1.0.0
 */

import React, { useCallback, useRef, useState, useEffect, memo } from 'react';
import clsx from 'clsx'; // v2.0.0
import Select from '../../shared/Select';
import { FormFieldStyle } from '../../../types/form';
import { validateFormField } from '../../../lib/utils/validation';
import { useAnalytics } from '../../../hooks/useAnalytics';
import { FieldType, ValidationRuleType } from '../../../backend/shared/types/form.types';
import { FIELD_DEFAULTS, DEFAULT_FIELD_STYLES } from '../../../lib/constants/forms';

/**
 * Interface for select options with enhanced accessibility
 */
interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
  description?: string;
  icon?: string;
}

/**
 * Interface for validation cache to optimize performance
 */
interface ValidationCache {
  result: {
    isValid: boolean;
    errors: Array<{ field: string; message: string; type: string }>;
  };
  timestamp: number;
}

/**
 * Interface for analytics tracking configuration
 */
interface AnalyticsConfig {
  trackInteraction?: boolean;
  trackValidation?: boolean;
  customMetrics?: Record<string, unknown>;
}

/**
 * Interface for async validation configuration
 */
interface AsyncValidationConfig {
  url?: string;
  debounceMs?: number;
  headers?: Record<string, string>;
}

/**
 * Enhanced props interface for SelectField component
 */
interface SelectFieldProps {
  id: string;
  name: string;
  label: string;
  options: SelectOption[];
  value: string;
  style?: FormFieldStyle;
  validation?: Array<{
    type: ValidationRuleType;
    message: string;
    isAsync?: boolean;
    validatorFn?: string;
  }>;
  onChange: (value: string) => void;
  disabled?: boolean;
  ariaLabel?: string;
  ariaDescribedBy?: string;
  asyncValidation?: AsyncValidationConfig;
  analytics?: AnalyticsConfig;
}

/**
 * Enhanced select field component with accessibility, validation, and analytics
 */
const SelectField: React.FC<SelectFieldProps> = memo(({
  id,
  name,
  label,
  options,
  value,
  style = DEFAULT_FIELD_STYLES,
  validation = [],
  onChange,
  disabled = false,
  ariaLabel,
  ariaDescribedBy,
  asyncValidation,
  analytics = { trackInteraction: true, trackValidation: true }
}) => {
  // Refs and state
  const selectRef = useRef<HTMLSelectElement>(null);
  const [error, setError] = useState<string>('');
  const validationCache = useRef<ValidationCache | null>(null);
  const validationTimeout = useRef<NodeJS.Timeout>();

  // Analytics hook
  const { trackFieldInteraction } = useAnalytics();

  /**
   * Enhanced change handler with validation and analytics
   */
  const handleSelectChange = useCallback(async (newValue: string) => {
    if (analytics?.trackInteraction) {
      trackFieldInteraction({
        fieldId: id,
        fieldType: FieldType.SELECT,
        action: 'change',
        value: newValue,
        metadata: analytics.customMetrics
      });
    }

    // Clear previous validation timeout
    if (validationTimeout.current) {
      clearTimeout(validationTimeout.current);
    }

    // Perform validation with debounce for async cases
    validationTimeout.current = setTimeout(async () => {
      const validationResult = await validateFormField(
        newValue,
        validation,
        FieldType.SELECT
      );

      if (!validationResult.isValid) {
        setError(validationResult.errors[0]?.message || 'Invalid selection');
      } else {
        setError('');
      }

      // Cache validation result
      validationCache.current = {
        result: validationResult,
        timestamp: Date.now()
      };

      if (analytics?.trackValidation) {
        trackFieldInteraction({
          fieldId: id,
          fieldType: FieldType.SELECT,
          action: 'validation',
          isValid: validationResult.isValid,
          errors: validationResult.errors
        });
      }
    }, asyncValidation?.debounceMs || 300);

    onChange(newValue);
  }, [id, validation, onChange, trackFieldInteraction, analytics, asyncValidation]);

  /**
   * Enhanced blur handler with validation
   */
  const handleSelectBlur = useCallback(async (event: React.FocusEvent<HTMLSelectElement>) => {
    if (analytics?.trackInteraction) {
      trackFieldInteraction({
        fieldId: id,
        fieldType: FieldType.SELECT,
        action: 'blur'
      });
    }

    // Perform validation on blur if not already cached
    if (!validationCache.current || Date.now() - validationCache.current.timestamp > 5000) {
      const validationResult = await validateFormField(
        value,
        validation,
        FieldType.SELECT
      );

      if (!validationResult.isValid) {
        setError(validationResult.errors[0]?.message || 'Invalid selection');
      } else {
        setError('');
      }

      if (analytics?.trackValidation) {
        trackFieldInteraction({
          fieldId: id,
          fieldType: FieldType.SELECT,
          action: 'validation',
          isValid: validationResult.isValid,
          errors: validationResult.errors
        });
      }
    }
  }, [id, value, validation, trackFieldInteraction, analytics]);

  // Effect for handling async validation configuration
  useEffect(() => {
    if (asyncValidation?.url && value) {
      const controller = new AbortController();
      
      fetch(asyncValidation.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...asyncValidation.headers
        },
        body: JSON.stringify({ value }),
        signal: controller.signal
      })
        .then(response => response.json())
        .then(result => {
          if (!result.isValid) {
            setError(result.message || 'Validation failed');
          }
        })
        .catch(error => {
          if (error.name !== 'AbortError') {
            console.error('Async validation error:', error);
          }
        });

      return () => controller.abort();
    }
  }, [value, asyncValidation]);

  return (
    <div className="form-field select-field">
      <label
        htmlFor={id}
        className={clsx(
          'block text-sm font-medium mb-1',
          error && 'text-red-600',
          disabled && 'opacity-50'
        )}
      >
        {label}
      </label>

      <Select
        id={id}
        name={name}
        value={value}
        options={options}
        disabled={disabled}
        style={style}
        isError={!!error}
        errorMessage={error}
        onChange={handleSelectChange}
        onBlur={handleSelectBlur}
        aria-label={ariaLabel || label}
        aria-describedby={ariaDescribedBy}
        aria-invalid={!!error}
        data-testid={`select-field-${id}`}
      />

      {error && (
        <div
          className="mt-1 text-sm text-red-600"
          id={`${id}-error`}
          role="alert"
          aria-live="polite"
        >
          {error}
        </div>
      )}
    </div>
  );
});

SelectField.displayName = 'SelectField';

export default SelectField;