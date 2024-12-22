import React, { useRef, useState, useCallback, KeyboardEvent } from 'react';
import clsx from 'clsx';

// Alert type definition for different alert variants
export type AlertType = 'success' | 'error' | 'warning' | 'info';

// Props interface with comprehensive type definitions
export interface AlertProps {
  type: AlertType;
  message?: string;
  dismissible?: boolean;
  onDismiss?: () => void;
  children?: React.ReactNode;
}

// Utility function to get WCAG 2.1 AA compliant alert styles
const getAlertStyles = (type: AlertType): string => {
  // Base classes for consistent layout and spacing
  const baseClasses = 'rounded-md p-4 mb-4 flex items-start justify-between';
  
  // Type-specific styles with WCAG AA compliant color contrast
  const typeStyles = {
    success: 'bg-green-50 text-green-800 border border-green-200',
    error: 'bg-red-50 text-red-800 border border-red-200',
    warning: 'bg-yellow-50 text-yellow-800 border border-yellow-200',
    info: 'bg-blue-50 text-blue-800 border border-blue-200'
  };

  // Icon background styles with proper contrast
  const iconStyles = {
    success: 'bg-green-100 text-green-600',
    error: 'bg-red-100 text-red-600',
    warning: 'bg-yellow-100 text-yellow-600',
    info: 'bg-blue-100 text-blue-600'
  };

  return clsx(baseClasses, typeStyles[type], 'focus-within:ring-2', {
    'focus-within:ring-green-500': type === 'success',
    'focus-within:ring-red-500': type === 'error',
    'focus-within:ring-yellow-500': type === 'warning',
    'focus-within:ring-blue-500': type === 'info'
  });
};

const Alert: React.FC<AlertProps> = ({
  type,
  message,
  dismissible = false,
  onDismiss,
  children
}) => {
  const [isDismissed, setIsDismissed] = useState(false);
  const alertRef = useRef<HTMLDivElement>(null);
  const dismissButtonRef = useRef<HTMLButtonElement>(null);

  // Handle alert dismissal with proper focus management
  const handleDismiss = useCallback(() => {
    setIsDismissed(true);
    onDismiss?.();

    // Return focus to the previously focused element
    const focusTarget = document.activeElement as HTMLElement;
    if (focusTarget) {
      focusTarget.focus();
    }
  }, [onDismiss]);

  // Keyboard interaction handler for accessibility
  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    if (dismissible && event.key === 'Escape') {
      event.preventDefault();
      handleDismiss();
    }
  }, [dismissible, handleDismiss]);

  // Don't render if dismissed
  if (isDismissed) {
    return null;
  }

  // Get appropriate icon based on alert type
  const getIcon = () => {
    switch (type) {
      case 'success':
        return (
          <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
          </svg>
        );
      case 'error':
        return (
          <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
          </svg>
        );
      case 'warning':
        return (
          <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
          </svg>
        );
      case 'info':
        return (
          <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
          </svg>
        );
    }
  };

  return (
    <div
      ref={alertRef}
      role="alert"
      aria-live="polite"
      className={getAlertStyles(type)}
      onKeyDown={handleKeyDown}
      tabIndex={-1}
    >
      <div className="flex">
        <div className={clsx('flex-shrink-0', 'mr-3')}>
          <div className={clsx('h-5 w-5', `text-${type}-600`)}>
            {getIcon()}
          </div>
        </div>
        <div className="flex-1 pt-0.5">
          {message && (
            <p className="text-sm font-medium">
              {message}
            </p>
          )}
          {children && (
            <div className="text-sm mt-2">
              {children}
            </div>
          )}
        </div>
      </div>
      
      {dismissible && (
        <button
          ref={dismissButtonRef}
          type="button"
          className={clsx(
            'ml-4 flex-shrink-0 inline-flex rounded-md focus:outline-none focus:ring-2',
            'transition-opacity duration-150',
            'hover:opacity-75',
            {
              'focus:ring-green-500': type === 'success',
              'focus:ring-red-500': type === 'error',
              'focus:ring-yellow-500': type === 'warning',
              'focus:ring-blue-500': type === 'info'
            }
          )}
          onClick={handleDismiss}
          aria-label="Dismiss alert"
        >
          <span className="sr-only">Dismiss</span>
          <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
          </svg>
        </button>
      )}
    </div>
  );
};

export default Alert;