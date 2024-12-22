'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import clsx from 'clsx';
import { useForm } from '../../../hooks/useForm';
import { FormBuilder } from '../../../components/forms/FormBuilder';
import { Button } from '../../../components/shared/Button';
import { useAnalytics } from '../../../hooks/useAnalytics';
import { Card } from '../../../components/shared/Card';
import { FormState } from '../../../types/form';
import { TimeRange } from '../../../types/analytics';

/**
 * Forms page component that displays a list of created forms and provides
 * form management functionality with analytics integration.
 */
const FormsPage: React.FC = () => {
  // Hooks
  const router = useRouter();
  const { formState, loading, error, pagination } = useForm();
  const { trackEvent } = useAnalytics(TimeRange.DAY);
  
  // Local state
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedForm, setSelectedForm] = useState<string | null>(null);

  /**
   * Handles form creation with analytics tracking
   */
  const handleCreateForm = useCallback(async () => {
    try {
      trackEvent('form_create_initiated', {
        source: 'forms_page'
      });

      router.push('/forms/create');
    } catch (error) {
      console.error('Error navigating to form creation:', error);
    }
  }, [router, trackEvent]);

  /**
   * Handles form editing with validation
   */
  const handleEditForm = useCallback(async (formId: string) => {
    try {
      if (!formId) return;

      trackEvent('form_edit_initiated', {
        formId,
        source: 'forms_page'
      });

      router.push(`/forms/${formId}/edit`);
    } catch (error) {
      console.error('Error navigating to form edit:', error);
    }
  }, [router, trackEvent]);

  /**
   * Handles form deletion with confirmation
   */
  const handleDeleteForm = useCallback(async (formId: string) => {
    try {
      if (!formId || !window.confirm('Are you sure you want to delete this form?')) {
        return;
      }

      trackEvent('form_delete_initiated', {
        formId,
        source: 'forms_page'
      });

      // Form deletion logic will be handled by the useForm hook
      // await deleteForm(formId);

      setSelectedForm(null);
    } catch (error) {
      console.error('Error deleting form:', error);
    }
  }, [trackEvent]);

  return (
    <div className="forms-page">
      {/* Page Header */}
      <div className="forms-page__header">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-semibold text-gray-900">Forms</h1>
          <Button
            variant="primary"
            onClick={handleCreateForm}
            isLoading={loading}
            ariaLabel="Create new form"
          >
            Create Form
          </Button>
        </div>

        {/* Search and Filters */}
        <div className="flex items-center gap-4 mb-6">
          <input
            type="search"
            placeholder="Search forms..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full max-w-md px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
            aria-label="Search forms"
          />
        </div>
      </div>

      {/* Error State */}
      {error && (
        <div 
          className="bg-error-50 border border-error-200 rounded-md p-4 mb-6"
          role="alert"
        >
          <p className="text-error-800">{error}</p>
        </div>
      )}

      {/* Forms Grid */}
      <div className="forms-page__grid">
        {loading ? (
          // Loading State
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {Array.from({ length: 6 }).map((_, index) => (
              <Card
                key={`skeleton-${index}`}
                className="animate-pulse h-48"
                variant="default"
              >
                <div className="h-4 bg-gray-200 rounded w-3/4 mb-4" />
                <div className="h-4 bg-gray-200 rounded w-1/2" />
              </Card>
            ))}
          </div>
        ) : formState?.fields?.length ? (
          // Forms List
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {formState.fields.map((form) => (
              <Card
                key={form.id}
                className="hover:shadow-md transition-shadow duration-200"
                variant="default"
              >
                <div className="p-6">
                  <h3 className="text-lg font-medium text-gray-900 mb-2">
                    {form.label}
                  </h3>
                  <div className="flex items-center justify-between mt-4">
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => handleEditForm(form.id)}
                      ariaLabel={`Edit form ${form.label}`}
                    >
                      Edit
                    </Button>
                    <Button
                      variant="error"
                      size="sm"
                      onClick={() => handleDeleteForm(form.id)}
                      ariaLabel={`Delete form ${form.label}`}
                    >
                      Delete
                    </Button>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        ) : (
          // Empty State
          <div className="text-center py-12">
            <h2 className="text-xl font-medium text-gray-900 mb-2">
              No forms created yet
            </h2>
            <p className="text-gray-500 mb-6">
              Create your first form to start capturing leads
            </p>
            <Button
              variant="primary"
              onClick={handleCreateForm}
              ariaLabel="Create your first form"
            >
              Create Form
            </Button>
          </div>
        )}
      </div>

      {/* Pagination */}
      {pagination && (
        <div className="forms-page__pagination mt-6 flex justify-center">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => pagination.prevPage()}
            isDisabled={!pagination.hasPrevPage}
            ariaLabel="Previous page"
          >
            Previous
          </Button>
          <span className="mx-4 text-gray-700">
            Page {pagination.currentPage} of {pagination.totalPages}
          </span>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => pagination.nextPage()}
            isDisabled={!pagination.hasNextPage}
            ariaLabel="Next page"
          >
            Next
          </Button>
        </div>
      )}

      <style jsx>{`
        .forms-page {
          padding: 24px;
          max-width: 1280px;
          margin: 0 auto;
        }

        .forms-page__grid {
          min-height: 400px;
        }

        @media (max-width: 768px) {
          .forms-page {
            padding: 16px;
          }
        }
      `}</style>
    </div>
  );
};

export default FormsPage;