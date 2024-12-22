// @ts-check
import React, { memo, useCallback, useMemo } from 'react'; // ^18.0.0
import clsx from 'clsx'; // ^2.0.0
import { FormState } from '../../types/form';
import { useForm } from '../../hooks/useForm';
import Card from '../shared/Card';
import { FieldType, ValidationRuleType } from '../../../backend/shared/types/form.types';
import { FIELD_DEFAULTS, VALIDATION_MESSAGES } from '../../lib/constants/forms';

/**
 * Props interface for custom field renderers
 */
interface CustomFieldRenderers {
  [key: string]: React.ComponentType<any>;
}

/**
 * Props interface for FormPreview component
 */
interface FormPreviewProps {
  formState: FormState;
  onFieldChange: (field: string, value: any, validationResult?: ValidationResult) => void;
  isInteractive?: boolean;
  className?: string;
  theme?: FormState['theme'];
  customRenderers?: CustomFieldRenderers;
}

/**
 * Interface for field validation result
 */
interface ValidationResult {
  isValid: boolean;
  errors: string[];
  metadata?: Record<string, unknown>;
}

/**
 * A component that provides a live preview of the form being built.
 * Implements responsive design, accessibility features, and theme integration.
 *
 * @component
 * @example
 * ```tsx
 * <FormPreview
 *   formState={formState}
 *   onFieldChange={handleFieldChange}
 *   isInteractive={true}
 *   theme={customTheme}
 * />
 * ```
 */
export const FormPreview = memo<FormPreviewProps>(({
  formState,
  onFieldChange,
  isInteractive = true,
  className,
  theme = formState.theme,
  customRenderers
}) => {
  const { updateField, validationState } = useForm(formState.id);

  /**
   * Handles field value changes with validation
   */
  const handleFieldChange = useCallback(async (fieldId: string, value: any) => {
    const field = formState.fields.find(f => f.id === fieldId);
    if (!field) return;

    let validationResult: ValidationResult = {
      isValid: true,
      errors: []
    };

    if (field.validation.length > 0) {
      // Required field validation
      if (field.validation.some(rule => rule.type === ValidationRuleType.REQUIRED)) {
        if (!value || (typeof value === 'string' && !value.trim())) {
          validationResult.errors.push(VALIDATION_MESSAGES.messages[ValidationRuleType.REQUIRED]);
        }
      }

      // Field type specific validation
      switch (field.type) {
        case FieldType.EMAIL:
          const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
          if (value && !emailRegex.test(value)) {
            validationResult.errors.push(VALIDATION_MESSAGES.messages[ValidationRuleType.EMAIL]);
          }
          break;

        case FieldType.PHONE:
          const phoneRegex = /^\+?[\d\s-()]{10,}$/;
          if (value && !phoneRegex.test(value)) {
            validationResult.errors.push(VALIDATION_MESSAGES.messages[ValidationRuleType.PHONE]);
          }
          break;

        case FieldType.FILE:
          if (value instanceof File) {
            const maxSize = field.validation.find(rule => rule.type === ValidationRuleType.FILE_SIZE)?.value;
            if (maxSize && value.size > maxSize * 1024 * 1024) {
              validationResult.errors.push(
                VALIDATION_MESSAGES.templates.fileSize(maxSize)
              );
            }
          }
          break;
      }
    }

    validationResult.isValid = validationResult.errors.length === 0;
    
    // Update field value and validation state
    await updateField(fieldId, value, true);
    onFieldChange(fieldId, value, validationResult);
  }, [formState.fields, updateField, onFieldChange]);

  /**
   * Renders a form field based on its type with theme and accessibility support
   */
  const renderFormField = useCallback((field: FormState['fields'][0]) => {
    const fieldDefaults = FIELD_DEFAULTS[field.type as FieldType];
    const hasError = validationState.errors.some(error => error.field === field.id);
    
    // Check for custom renderer
    if (customRenderers?.[field.type]) {
      const CustomRenderer = customRenderers[field.type];
      return (
        <CustomRenderer
          key={field.id}
          field={field}
          onChange={(value: any) => handleFieldChange(field.id, value)}
          hasError={hasError}
          disabled={!isInteractive}
          theme={theme}
        />
      );
    }

    const baseFieldProps = {
      id: field.id,
      name: field.id,
      value: field.value ?? fieldDefaults.defaultValue,
      onChange: (e: React.ChangeEvent<HTMLInputElement>) => 
        handleFieldChange(field.id, e.target.value),
      disabled: !isInteractive,
      'aria-label': field.label,
      'aria-invalid': hasError,
      'aria-required': field.validation.some(
        rule => rule.type === ValidationRuleType.REQUIRED
      ),
      className: clsx(
        'w-full rounded-md transition-all duration-200',
        hasError ? 'border-error-500' : 'border-neutral-300',
        !isInteractive && 'opacity-75 cursor-not-allowed'
      ),
      style: {
        backgroundColor: theme.colors.neutral,
        color: theme.colors.primary,
        fontFamily: theme.typography.fontFamily,
        fontSize: theme.typography.bodyText.regular,
        padding: `${theme.spacing.base * 2}px`,
        borderRadius: '0.375rem'
      }
    };

    switch (field.type) {
      case FieldType.TEXT:
      case FieldType.EMAIL:
      case FieldType.PHONE:
        return (
          <input
            type={field.type.toLowerCase()}
            placeholder={fieldDefaults.placeholder}
            {...baseFieldProps}
          />
        );

      case FieldType.SELECT:
        return (
          <select {...baseFieldProps}>
            <option value="">{fieldDefaults.placeholder}</option>
            {field.options?.map(option => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        );

      case FieldType.CHECKBOX:
        return (
          <input
            type="checkbox"
            checked={field.value ?? false}
            {...baseFieldProps}
            onChange={(e) => handleFieldChange(field.id, e.target.checked)}
          />
        );

      // Add other field type renderers as needed
      default:
        return null;
    }
  }, [theme, isInteractive, handleFieldChange, validationState.errors, customRenderers]);

  /**
   * Memoized form fields with theme and accessibility support
   */
  const formFields = useMemo(() => {
    return formState.fields.map(field => (
      <div
        key={field.id}
        className="mb-4"
        role="group"
        aria-labelledby={`${field.id}-label`}
      >
        <label
          id={`${field.id}-label`}
          htmlFor={field.id}
          className="block mb-2 font-medium"
          style={{
            color: theme.colors.neutral,
            fontFamily: theme.typography.fontFamily,
            fontSize: theme.typography.bodyText.regular
          }}
        >
          {field.label}
          {field.validation.some(rule => rule.type === ValidationRuleType.REQUIRED) && (
            <span className="text-error-500 ml-1">*</span>
          )}
        </label>
        {renderFormField(field)}
        {validationState.errors
          .filter(error => error.field === field.id)
          .map((error, index) => (
            <p
              key={index}
              className="mt-1 text-sm text-error-500"
              role="alert"
            >
              {error.message}
            </p>
          ))}
      </div>
    ));
  }, [formState.fields, theme, renderFormField, validationState.errors]);

  return (
    <Card
      variant="elevated"
      padding="lg"
      className={clsx('w-full max-w-2xl mx-auto', className)}
      role="form"
      aria-label="Form Preview"
    >
      <form
        className="space-y-6"
        onSubmit={(e) => e.preventDefault()}
        noValidate
      >
        {formFields}
      </form>
    </Card>
  );
});

FormPreview.displayName = 'FormPreview';

export default FormPreview;