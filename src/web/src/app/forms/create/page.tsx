'use client';

import React, { useCallback, useState } from 'react';
import { useRouter } from 'next/navigation'; // v14.0.0
import toast from 'react-hot-toast'; // v2.4.1
import { FormBuilder } from '../../../components/forms/FormBuilder';
import { useForm } from '../../../hooks/useForm';
import { useAnalytics } from '../../../hooks/useAnalytics';
import { FormState } from '../../../types/form';
import { DEFAULT_FORM_STATE } from '../../../lib/constants/forms';

/**
 * Enhanced form creation page component with analytics tracking and error handling
 * Implements drag-and-drop form building, live preview, and comprehensive validation
 */
const CreateFormPage: React.FC = () => {
  // Hooks
  const router = useRouter();
  const { formState, validateForm, saveForm } = useForm('new-form');
  const { trackFormEvent } = useAnalytics();
  const [isLoading, setIsLoading] = useState(false);

  /**
   * Handles form saving with validation and analytics tracking
   */
  const handleFormSave = useCallback(async () => {
    setIsLoading(true);
    
    try {
      // Track save attempt
      trackFormEvent('form_save_attempt', {
        formId: formState.id,
        fieldCount: formState.fields.length
      });

      // Validate form before saving
      const validationResult = await validateForm();
      if (!validationResult.isValid) {
        toast.error('Please fix validation errors before saving');
        return;
      }

      // Attempt to save form with retry logic
      const savedForm = await saveForm(formState);
      
      // Track successful save
      trackFormEvent('form_save_success', {
        formId: savedForm.id,
        fieldCount: savedForm.fields.length
      });

      toast.success('Form saved successfully');
      router.push('/forms');
    } catch (error) {
      console.error('Error saving form:', error);
      
      // Track save failure
      trackFormEvent('form_save_error', {
        formId: formState.id,
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      toast.error(
        error instanceof Error 
          ? error.message 
          : 'An error occurred while saving the form'
      );
    } finally {
      setIsLoading(false);
    }
  }, [formState, validateForm, saveForm, router, trackFormEvent]);

  /**
   * Handles form preview with validation and analytics
   */
  const handlePreview = useCallback(async () => {
    try {
      const validationResult = await validateForm();
      if (!validationResult.isValid) {
        toast.error('Please fix validation errors before previewing');
        return;
      }

      // Generate secure preview URL
      const previewToken = btoa(JSON.stringify({
        formId: formState.id,
        timestamp: Date.now()
      }));

      // Track preview event
      trackFormEvent('form_preview', {
        formId: formState.id,
        fieldCount: formState.fields.length
      });

      // Open preview in new window with security headers
      window.open(
        `/forms/preview/${previewToken}`,
        'formPreview',
        'width=480,height=800,noopener,noreferrer'
      );
    } catch (error) {
      console.error('Error generating preview:', error);
      toast.error('Unable to generate form preview');
    }
  }, [formState, validateForm, trackFormEvent]);

  return (
    <div className="page-container">
      {/* Header with actions */}
      <header className="header">
        <h1 className="title">Create New Form</h1>
        <div className="actions">
          <button
            type="button"
            className="btn btn-secondary"
            onClick={handlePreview}
            disabled={isLoading}
          >
            Preview
          </button>
          <button
            type="button"
            className="btn btn-primary"
            onClick={handleFormSave}
            disabled={isLoading}
          >
            {isLoading ? 'Saving...' : 'Save Form'}
          </button>
        </div>
      </header>

      {/* Form Builder */}
      <FormBuilder
        formId="new-form"
        className="form-builder-container"
        theme={{
          mode: 'light',
          colors: DEFAULT_FORM_STATE.theme.colors
        }}
        errorBoundary={{
          onError: (error) => {
            console.error('Form builder error:', error);
            toast.error('An error occurred in the form builder');
          },
          fallback: (
            <div className="error-fallback">
              <h2>Form Builder Error</h2>
              <p>Please refresh the page and try again</p>
            </div>
          )
        }}
      />

      {/* Loading Overlay */}
      {isLoading && (
        <div className="loading-overlay">
          <div className="spinner" />
          <p>Saving form...</p>
        </div>
      )}

      {/* Toast Container */}
      <div id="toast-container" />

      <style jsx>{`
        .page-container {
          min-height: 100vh;
          background: #F9FAFB;
          padding: 24px;
          position: relative;
        }

        .header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 24px;
          z-index: 10;
        }

        .title {
          font-size: 24px;
          font-weight: 600;
          color: #111827;
        }

        .actions {
          display: flex;
          gap: 12px;
        }

        .btn {
          padding: 8px 16px;
          border-radius: 6px;
          font-weight: 500;
          transition: all 150ms ease-in-out;
        }

        .btn-primary {
          background: #2563EB;
          color: white;
        }

        .btn-secondary {
          background: white;
          border: 1px solid #E5E7EB;
        }

        .btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .form-builder-container {
          height: calc(100vh - 120px);
        }

        .loading-overlay {
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(255, 255, 255, 0.7);
          display: flex;
          flex-direction: column;
          justify-content: center;
          align-items: center;
          z-index: 20;
        }

        .spinner {
          width: 40px;
          height: 40px;
          border: 3px solid #E5E7EB;
          border-top-color: #2563EB;
          border-radius: 50%;
          animation: spin 1s linear infinite;
        }

        @keyframes spin {
          to {
            transform: rotate(360deg);
          }
        }

        .error-fallback {
          padding: 24px;
          text-align: center;
          color: #EF4444;
        }
      `}</style>
    </div>
  );
};

export default CreateFormPage;