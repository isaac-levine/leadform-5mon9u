'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { Loader } from '@mui/material'; // v5.0.0
import FormBuilder from '@/components/forms/FormBuilder';
import FormSettings from '@/components/forms/FormSettings';
import { useForm } from '@/hooks/useForm';
import { FormState } from '@/types/form';

/**
 * Props interface for FormEditPage component
 */
interface FormEditPageProps {
  params: {
    id: string;
  };
}

/**
 * Enhanced form edit page component with real-time validation,
 * accessibility features, and analytics tracking
 * 
 * @component
 */
const FormEditPage: React.FC<FormEditPageProps> = ({ params }) => {
  // Get form ID from route parameters
  const { id } = params;

  // Initialize form state with validation and analytics
  const {
    formState,
    validationState,
    updateField,
    batchUpdate,
    validateForm,
    resetValidation,
    isOptimisticUpdate,
    formError,
    lastSaved
  } = useForm(id, {
    validateOnChange: true,
    validateOnBlur: true,
    revalidateOnStateChange: true,
    enableOptimisticUpdates: true,
    autosave: true,
    autosaveDelay: 3000
  });

  // Local state for UI management
  const [isSaving, setIsSaving] = useState(false);
  const [lastSavedMessage, setLastSavedMessage] = useState<string>('');

  /**
   * Handles form save operation with validation and error handling
   */
  const handleSave = useCallback(async () => {
    try {
      setIsSaving(true);
      
      // Validate entire form before saving
      const validationResult = await validateForm();
      if (!validationResult.isValid) {
        // Announce validation errors for screen readers
        const errorMessage = `Form validation failed: ${validationResult.errors
          .map(error => error.message)
          .join(', ')}`;
        announceMessage(errorMessage);
        return;
      }

      // Save form changes
      await updateField('lastSaved', new Date().toISOString());
      setLastSavedMessage('All changes saved');
      announceMessage('Form changes saved successfully');
    } catch (error) {
      console.error('Save error:', error);
      setLastSavedMessage('Failed to save changes');
      announceMessage('Error saving form changes');
    } finally {
      setIsSaving(false);
    }
  }, [validateForm, updateField]);

  /**
   * Announces messages for screen readers
   */
  const announceMessage = useCallback((message: string) => {
    const announcement = document.createElement('div');
    announcement.setAttribute('role', 'alert');
    announcement.setAttribute('aria-live', 'polite');
    announcement.textContent = message;
    document.body.appendChild(announcement);
    setTimeout(() => document.body.removeChild(announcement), 3000);
  }, []);

  /**
   * Updates last saved message when form is saved
   */
  useEffect(() => {
    if (lastSaved) {
      const timeAgo = Math.floor((Date.now() - new Date(lastSaved).getTime()) / 1000);
      setLastSavedMessage(
        timeAgo < 60 
          ? 'Last saved less than a minute ago'
          : `Last saved ${Math.floor(timeAgo / 60)} minutes ago`
      );
    }
  }, [lastSaved]);

  // Show loading state while form data is being fetched
  if (!formState) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader size={40} />
      </div>
    );
  }

  return (
    <main
      className="form-edit-page"
      role="main"
      aria-label="Form Editor"
    >
      <div className="form-edit-container">
        {/* Form Builder Section */}
        <section
          className="form-builder-section"
          role="region"
          aria-label="Form Builder"
        >
          <FormBuilder
            formId={id}
            className="h-full"
            theme={formState.theme}
            errorBoundary={{
              onError: (error) => {
                console.error('Form builder error:', error);
                announceMessage('Error in form builder');
              },
              fallback: <div>Error loading form builder</div>
            }}
          />
        </section>

        {/* Form Settings Section */}
        <section
          className="form-settings-section"
          role="complementary"
          aria-label="Form Settings"
        >
          <FormSettings
            formId={id}
            onSave={handleSave}
          />
          
          {/* Save Status */}
          <div 
            className="save-status"
            aria-live="polite"
          >
            {isSaving ? (
              <span className="text-neutral-600">Saving changes...</span>
            ) : (
              <span className="text-neutral-600">{lastSavedMessage}</span>
            )}
          </div>
        </section>
      </div>

      {/* Error Messages */}
      {formError && (
        <div
          role="alert"
          className="error-message"
          aria-live="assertive"
        >
          {formError.map((error, index) => (
            <p key={index} className="text-error-500">
              {error.message}
            </p>
          ))}
        </div>
      )}

      <style jsx>{`
        .form-edit-page {
          min-height: 100vh;
          background-color: #F9FAFB;
        }

        .form-edit-container {
          display: grid;
          grid-template-columns: 1fr 300px;
          gap: 24px;
          padding: 24px;
          height: calc(100vh - 64px);
        }

        .form-builder-section {
          background: #FFFFFF;
          border-radius: 8px;
          padding: 24px;
          overflow: auto;
        }

        .form-settings-section {
          background: #FFFFFF;
          border-radius: 8px;
          padding: 24px;
          border: 1px solid #E5E7EB;
        }

        .save-status {
          margin-top: 16px;
          padding: 8px;
          text-align: center;
          font-size: 0.875rem;
        }

        .error-message {
          position: fixed;
          bottom: 24px;
          right: 24px;
          background: #FEF2F2;
          border: 1px solid #EF4444;
          border-radius: 8px;
          padding: 12px 16px;
          max-width: 400px;
          box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
        }
      `}</style>
    </main>
  );
};

export default FormEditPage;