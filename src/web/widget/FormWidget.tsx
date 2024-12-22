// @ts-check
import React, { useEffect, useRef, useState, useCallback } from 'react';
import styled from '@emotion/styled'; // v11.11.0
import { z } from 'zod'; // v3.22.0
import debounce from 'lodash/debounce'; // v4.0.8
import { ErrorBoundary } from 'react-error-boundary'; // v4.0.0

import { 
  WidgetConfig, 
  WidgetState, 
  ValidationState,
  ValidationSource,
  WidgetTheme,
  WidgetEvent,
  widgetConfigSchema,
  isValidWidgetConfig 
} from './types';
import { validateField, validateForm } from './validation';
import type { FormFieldValue } from './types';
import type { FieldType, ValidationRule } from '../../backend/shared/types/form.types';

// Version and configuration constants
const WIDGET_VERSION = '1.0.0';
const DEFAULT_THEME = {
  primaryColor: '#2563EB',
  fontFamily: 'Inter, sans-serif',
  fontSize: '16px',
  borderRadius: '4px',
  backgroundColor: '#ffffff'
};

const SECURITY_CONFIG = {
  allowedOrigins: ['*.example.com'],
  maxSubmissionsPerMinute: 5,
  maxFieldLength: 1000,
  csrfTokenHeader: 'X-CSRF-Token'
};

// Styled components with accessibility and theming support
const WidgetContainer = styled.div<{ theme: typeof DEFAULT_THEME }>`
  font-family: ${props => props.theme.fontFamily};
  font-size: ${props => props.theme.fontSize};
  background-color: ${props => props.theme.backgroundColor};
  border-radius: ${props => props.theme.borderRadius};
  padding: 1.5rem;
  max-width: 100%;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);

  @media (max-width: 768px) {
    padding: 1rem;
  }
`;

const FormField = styled.div`
  margin-bottom: 1.5rem;
`;

const Label = styled.label`
  display: block;
  margin-bottom: 0.5rem;
  font-weight: 500;
  color: #1F2937;
`;

const Input = styled.input<{ hasError?: boolean }>`
  width: 100%;
  padding: 0.75rem;
  border: 1px solid ${props => props.hasError ? '#EF4444' : '#D1D5DB'};
  border-radius: ${props => props.theme.borderRadius};
  font-size: inherit;
  transition: border-color 0.2s;

  &:focus {
    outline: none;
    border-color: ${props => props.theme.primaryColor};
    box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.1);
  }

  &:disabled {
    background-color: #F3F4F6;
    cursor: not-allowed;
  }
`;

const ErrorMessage = styled.div`
  color: #EF4444;
  font-size: 0.875rem;
  margin-top: 0.5rem;
`;

const SubmitButton = styled.button<{ isLoading?: boolean }>`
  background-color: ${props => props.theme.primaryColor};
  color: white;
  padding: 0.75rem 1.5rem;
  border: none;
  border-radius: ${props => props.theme.borderRadius};
  font-weight: 500;
  cursor: ${props => props.isLoading ? 'wait' : 'pointer'};
  opacity: ${props => props.isLoading ? 0.7 : 1};
  transition: opacity 0.2s;

  &:hover:not(:disabled) {
    opacity: 0.9;
  }

  &:disabled {
    cursor: not-allowed;
    background-color: #9CA3AF;
  }
`;

// Error boundary fallback component
const ErrorFallback = ({ error, resetErrorBoundary }) => (
  <div role="alert">
    <p>Something went wrong:</p>
    <pre>{error.message}</pre>
    <button onClick={resetErrorBoundary}>Try again</button>
  </div>
);

interface FormWidgetProps extends WidgetConfig {}

export const FormWidget: React.FC<FormWidgetProps> = (props) => {
  // State management
  const [state, setState] = useState<WidgetState>({
    isLoading: true,
    isSubmitting: false,
    isValid: false,
    formData: {},
    fieldStates: {},
    errors: {},
    metadata: {
      instanceId: crypto.randomUUID(),
      version: WIDGET_VERSION,
      loadTime: Date.now(),
      userAgent: navigator.userAgent,
      screenSize: {
        width: window.innerWidth,
        height: window.innerHeight
      },
      performance: {
        loadDuration: 0,
        renderDuration: 0,
        interactionDelay: 0
      }
    }
  });

  // Refs for form and security context
  const formRef = useRef<HTMLFormElement>(null);
  const securityContextRef = useRef({
    csrfToken: '',
    submissionCount: 0,
    lastSubmissionTime: 0
  });

  // Validation debouncing
  const debouncedValidation = useCallback(
    debounce(async (fieldName: string, value: FormFieldValue) => {
      const rules = props.validation?.[fieldName] || [];
      const result = await validateField(value, rules, state.formData);
      
      setState(prev => ({
        ...prev,
        fieldStates: {
          ...prev.fieldStates,
          [fieldName]: {
            ...result,
            isValidating: false
          }
        },
        errors: {
          ...prev.errors,
          [fieldName]: result.error
        }
      }));

      props.callbacks?.onValidation?.(result);
    }, 300),
    [props.validation, state.formData]
  );

  // Handle field change
  const handleFieldChange = useCallback(async (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const { name, value, type } = event.target;
    const fieldValue = type === 'checkbox' ? event.target.checked : value;

    setState(prev => ({
      ...prev,
      formData: { ...prev.formData, [name]: fieldValue },
      fieldStates: {
        ...prev.fieldStates,
        [name]: { ...prev.fieldStates[name], isValidating: true }
      }
    }));

    props.callbacks?.onFieldChange?.(name, fieldValue);
    debouncedValidation(name, fieldValue);
  }, [debouncedValidation, props.callbacks]);

  // Handle form submission
  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    // Rate limiting check
    const now = Date.now();
    const timeSinceLastSubmission = now - securityContextRef.current.lastSubmissionTime;
    if (
      timeSinceLastSubmission < 60000 && 
      securityContextRef.current.submissionCount >= SECURITY_CONFIG.maxSubmissionsPerMinute
    ) {
      setState(prev => ({
        ...prev,
        errors: { ...prev.errors, form: 'Too many submissions. Please try again later.' }
      }));
      return;
    }

    setState(prev => ({ ...prev, isSubmitting: true }));

    try {
      // Validate all fields
      const validationResults = await validateForm(state.formData, props.validation || {});
      const isValid = Object.values(validationResults).every(result => result.isValid);

      if (!isValid) {
        setState(prev => ({
          ...prev,
          isSubmitting: false,
          fieldStates: validationResults,
          errors: Object.entries(validationResults).reduce((acc, [field, result]) => ({
            ...acc,
            [field]: result.error
          }), {})
        }));
        return;
      }

      // Prepare submission data
      const submissionData = {
        ...state.formData,
        metadata: {
          ...state.metadata,
          submittedAt: now
        }
      };

      // Submit form data
      await props.callbacks?.onSubmit?.(submissionData);

      // Update security context
      securityContextRef.current = {
        ...securityContextRef.current,
        submissionCount: securityContextRef.current.submissionCount + 1,
        lastSubmissionTime: now
      };

      // Reset form after successful submission
      setState(prev => ({
        ...prev,
        isSubmitting: false,
        formData: {},
        fieldStates: {},
        errors: {}
      }));

      formRef.current?.reset();

    } catch (error) {
      setState(prev => ({
        ...prev,
        isSubmitting: false,
        errors: { 
          form: error instanceof Error ? error.message : 'Form submission failed'
        }
      }));

      props.callbacks?.onError?.(
        error instanceof Error ? error : new Error('Form submission failed')
      );
    }
  };

  // Initialize widget
  useEffect(() => {
    const initializeWidget = async () => {
      try {
        // Validate configuration
        if (!isValidWidgetConfig(props)) {
          throw new Error('Invalid widget configuration');
        }

        // Initialize CSRF token
        const csrfToken = crypto.randomUUID();
        securityContextRef.current.csrfToken = csrfToken;

        // Mark loading complete
        setState(prev => ({ 
          ...prev, 
          isLoading: false,
          metadata: {
            ...prev.metadata,
            performance: {
              ...prev.metadata.performance,
              loadDuration: Date.now() - prev.metadata.loadTime
            }
          }
        }));

        props.callbacks?.onLoad?.(props.formId);
        props.callbacks?.onFormReady?.();

      } catch (error) {
        setState(prev => ({ 
          ...prev, 
          isLoading: false,
          errors: { form: 'Widget initialization failed' }
        }));

        props.callbacks?.onError?.(
          error instanceof Error ? error : new Error('Widget initialization failed')
        );
      }
    };

    initializeWidget();

    // Cleanup
    return () => {
      debouncedValidation.cancel();
    };
  }, [props]);

  if (state.isLoading) {
    return <div aria-busy="true">Loading form...</div>;
  }

  return (
    <ErrorBoundary FallbackComponent={ErrorFallback}>
      <WidgetContainer
        theme={{
          ...DEFAULT_THEME,
          ...props.styling?.customStyles
        }}
        className={props.styling?.className}
      >
        <form
          ref={formRef}
          onSubmit={handleSubmit}
          noValidate
          aria-label="Contact form"
        >
          {state.errors.form && (
            <ErrorMessage role="alert">{state.errors.form}</ErrorMessage>
          )}

          {/* Form fields would be rendered here based on form configuration */}
          {/* This is a placeholder for dynamic field rendering */}

          <SubmitButton
            type="submit"
            disabled={state.isSubmitting || !state.isValid}
            isLoading={state.isSubmitting}
            aria-busy={state.isSubmitting}
          >
            {state.isSubmitting ? 'Submitting...' : 'Submit'}
          </SubmitButton>
        </form>
      </WidgetContainer>
    </ErrorBoundary>
  );
};

// Initialize widget function for external use
export function initializeWidget(config: WidgetConfig): void {
  const container = document.getElementById(config.containerId);
  if (!container) {
    throw new Error(`Container element with id "${config.containerId}" not found`);
  }

  // Verify origin
  const origin = window.location.origin;
  if (!SECURITY_CONFIG.allowedOrigins.some(allowed => 
    new RegExp(allowed.replace('*', '.*')).test(origin)
  )) {
    throw new Error('Unauthorized origin');
  }

  // Render widget
  const root = document.createElement('div');
  root.setAttribute('data-widget-version', WIDGET_VERSION);
  container.appendChild(root);

  React.createRoot(root).render(
    <React.StrictMode>
      <FormWidget {...config} />
    </React.StrictMode>
  );
}

export default FormWidget;