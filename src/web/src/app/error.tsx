'use client';

import React, { useEffect } from 'react';
import * as Sentry from '@sentry/nextjs'; // ^7.0.0
import Alert, { AlertType } from '../../components/shared/Alert';
import Button from '../../components/shared/Button';

// Interface for error component props
interface ErrorProps {
  error: Error;
  reset: () => void;
  errorCode?: string;
}

/**
 * Global error page component for handling and displaying runtime errors
 * with proper error monitoring, logging, and user recovery options.
 */
const Error: React.FC<ErrorProps> = ({ error, reset, errorCode }) => {
  // Track error occurrence in Sentry
  useEffect(() => {
    // Send error to Sentry with additional context
    Sentry.captureException(error, {
      tags: {
        errorCode,
        errorType: error.name,
        errorLocation: 'client',
      },
      extra: {
        errorMessage: error.message,
        errorStack: error.stack,
      },
    });
  }, [error, errorCode]);

  // Sanitize error message for display
  const getSanitizedErrorMessage = (): string => {
    // Default user-friendly message
    const defaultMessage = 'An unexpected error occurred. Please try again.';

    // Only show actual error message in development
    if (process.env.NODE_ENV === 'development') {
      return error.message || defaultMessage;
    }

    // Map known error codes to user-friendly messages
    const errorMessages: Record<string, string> = {
      'NETWORK_ERROR': 'Unable to connect to the server. Please check your internet connection.',
      'AUTH_ERROR': 'Your session has expired. Please sign in again.',
      'RATE_LIMIT': 'Too many requests. Please try again in a few minutes.',
      'API_ERROR': 'Service is temporarily unavailable. Please try again later.',
    };

    return errorMessages[errorCode || ''] || defaultMessage;
  };

  // Get appropriate alert type based on error
  const getAlertType = (): AlertType => {
    if (error.name === 'NetworkError' || errorCode === 'NETWORK_ERROR') {
      return 'warning';
    }
    if (error.name === 'AuthError' || errorCode === 'AUTH_ERROR') {
      return 'info';
    }
    return 'error';
  };

  return (
    <div
      className="min-h-screen flex items-center justify-center px-4 py-16 sm:px-6 sm:py-24 md:grid md:place-items-center lg:px-8"
      role="alert"
      aria-live="assertive"
    >
      <div className="max-w-max mx-auto">
        <main className="sm:flex">
          <div className="sm:ml-6">
            <div className="sm:border-l sm:border-gray-200 sm:pl-6">
              <Alert
                type={getAlertType()}
                message={getSanitizedErrorMessage()}
                dismissible={false}
              >
                <div className="mt-4 flex space-x-4">
                  <Button
                    variant="primary"
                    onClick={() => reset()}
                    ariaLabel="Try again"
                    className="sm:order-2"
                  >
                    Try again
                  </Button>
                  <Button
                    variant="ghost"
                    onClick={() => window.location.href = '/dashboard'}
                    ariaLabel="Return to dashboard"
                    className="sm:order-1"
                  >
                    Return to dashboard
                  </Button>
                </div>
                {process.env.NODE_ENV === 'development' && (
                  <div className="mt-4 text-sm text-gray-500">
                    <details>
                      <summary className="cursor-pointer">Error details</summary>
                      <pre className="mt-2 whitespace-pre-wrap">
                        {error.stack}
                      </pre>
                    </details>
                  </div>
                )}
              </Alert>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
};

export default Error;