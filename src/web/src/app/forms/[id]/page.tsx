'use client';

import React, { useCallback, useEffect } from 'react';
import { useParams, notFound } from 'next/navigation';
import { useAnalytics } from '@vercel/analytics/react';
import FormBuilder from '../../../components/forms/FormBuilder';
import { useForm } from '../../../hooks/useForm';
import { FormState } from '../../../types/form';
import { METRIC_THRESHOLDS } from '../../../lib/constants/analytics';

/**
 * Metadata generation for SEO optimization
 */
export async function generateMetadata({ params }: { params: { id: string } }) {
  return {
    title: `Edit Form ${params.id} | AI-SMS Lead Platform`,
    description: 'Advanced form builder interface with real-time preview, AI-powered validation, and responsive design.',
    openGraph: {
      title: `Edit Form ${params.id} | AI-SMS Lead Platform`,
      description: 'Create and customize lead capture forms with intelligent validation and real-time preview.',
      type: 'website',
      siteName: 'AI-SMS Lead Platform'
    },
    twitter: {
      card: 'summary_large_image',
      title: `Edit Form ${params.id} | AI-SMS Lead Platform`,
      description: 'Create and customize lead capture forms with intelligent validation and real-time preview.'
    }
  };
}

/**
 * Enhanced form page component with error boundary, analytics, and accessibility
 * @component
 */
const FormPage: React.FC = () => {
  // Get form ID from route parameters
  const params = useParams();
  const formId = params?.id as string;

  // Initialize analytics
  const { track } = useAnalytics();

  // Initialize form state with validation and autosave
  const {
    formState,
    validationState,
    updateField,
    validateForm,
    resetValidation,
    isOptimisticUpdate,
    formError,
    lastSaved
  } = useForm(formId, {
    validateOnChange: true,
    validateOnBlur: true,
    revalidateOnStateChange: true,
    enableOptimisticUpdates: true,
    autosave: true,
    autosaveDelay: 1000
  });

  /**
   * Track page view and form builder usage
   */
  useEffect(() => {
    track('form_builder_view', {
      formId,
      timestamp: new Date().toISOString()
    });
  }, [track, formId]);

  /**
   * Handle form field changes with analytics
   */
  const handleFieldChange = useCallback(async (
    fieldId: string,
    value: unknown,
    validationResult?: { isValid: boolean; errors: string[] }
  ) => {
    try {
      await updateField(fieldId, value);

      track('form_field_update', {
        formId,
        fieldId,
        isValid: validationResult?.isValid,
        hasErrors: validationResult?.errors.length > 0
      });
    } catch (error) {
      console.error('Field update error:', error);
      track('form_field_error', {
        formId,
        fieldId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }, [formId, updateField, track]);

  // Show 404 if form not found
  if (!formState && !isOptimisticUpdate) {
    notFound();
  }

  // Show loading state
  if (!formState) {
    return (
      <div 
        className="loading-container"
        role="status"
        aria-label="Loading form builder"
      >
        <div className="loading-spinner" />
        <p className="loading-text">Loading form builder...</p>
      </div>
    );
  }

  // Show error state
  if (formError) {
    return (
      <div 
        className="error-container"
        role="alert"
        aria-live="assertive"
      >
        <h2 className="error-title">Error Loading Form</h2>
        <p className="error-message">{formError}</p>
        <button 
          onClick={resetValidation}
          className="error-retry-button"
        >
          Try Again
        </button>
      </div>
    );
  }

  return (
    <main className="form-page-container">
      {/* Skip link for keyboard navigation */}
      <a 
        href="#form-builder"
        className="skip-link"
      >
        Skip to form builder
      </a>

      {/* Form builder interface */}
      <div 
        id="form-builder"
        className="form-builder-wrapper"
      >
        <FormBuilder
          formId={formId}
          className="form-builder-component"
          theme={{
            mode: 'light',
            colors: {
              primary: '#2563EB',
              secondary: '#3B82F6',
              success: '#10B981',
              error: '#EF4444',
              neutral: '#1F2937'
            }
          }}
          errorBoundary={{
            onError: (error) => {
              track('form_builder_error', {
                formId,
                error: error.message
              });
            },
            fallback: (
              <div className="error-boundary-fallback">
                <h3>Form Builder Error</h3>
                <p>An error occurred while loading the form builder.</p>
                <button onClick={() => window.location.reload()}>
                  Reload Page
                </button>
              </div>
            )
          }}
        />
      </div>

      {/* Last saved indicator */}
      {lastSaved && (
        <div 
          className="last-saved-indicator"
          role="status"
          aria-live="polite"
        >
          Last saved: {new Date(lastSaved).toLocaleTimeString()}
        </div>
      )}

      <style jsx>{`
        .form-page-container {
          min-height: 100vh;
          background: var(--background);
          padding: var(--spacing-6);
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
          gap: var(--spacing-4);
          transition: background-color 0.3s ease;
        }

        .skip-link {
          position: absolute;
          width: 1px;
          height: 1px;
          padding: 0;
          margin: -1px;
          overflow: hidden;
          clip: rect(0, 0, 0, 0);
          border: 0;
        }

        .skip-link:focus {
          position: fixed;
          top: 16px;
          left: 16px;
          width: auto;
          height: auto;
          padding: 8px 16px;
          clip: auto;
          background: var(--primary);
          color: white;
          z-index: 100;
          border-radius: 4px;
        }

        .loading-container,
        .error-container {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          min-height: 50vh;
          text-align: center;
          padding: var(--spacing-6);
        }

        .loading-spinner {
          border: 4px solid var(--background-secondary);
          border-top: 4px solid var(--primary);
          border-radius: 50%;
          width: 40px;
          height: 40px;
          animation: spin 1s linear infinite;
        }

        .error-retry-button {
          margin-top: var(--spacing-4);
          padding: var(--spacing-2) var(--spacing-4);
          background: var(--primary);
          color: white;
          border: none;
          border-radius: var(--border-radius);
          cursor: pointer;
          transition: background-color 0.2s ease;
        }

        .error-retry-button:hover {
          background: var(--primary-dark);
        }

        .last-saved-indicator {
          position: fixed;
          bottom: var(--spacing-4);
          right: var(--spacing-4);
          padding: var(--spacing-2) var(--spacing-4);
          background: var(--background-secondary);
          border-radius: var(--border-radius);
          font-size: var(--font-size-sm);
          color: var(--text-secondary);
        }

        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }

        @media (max-width: 768px) {
          .form-page-container {
            padding: var(--spacing-4);
          }
        }
      `}</style>
    </main>
  );
};

export default FormPage;