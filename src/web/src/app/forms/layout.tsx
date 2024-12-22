'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { ErrorBoundary } from 'react-error-boundary';
import clsx from 'clsx';

import Header from '../../components/layout/Header';
import Sidebar from '../../components/layout/Sidebar';
import Loader from '../../components/shared/Loader';
import { useAuth } from '../../hooks/useAuth';
import { UserRole, UserPermission } from '../../types/auth';

/**
 * Props interface for FormsLayout component with enhanced security and accessibility
 */
interface FormsLayoutProps {
  children: React.ReactNode;
  requireAuth?: boolean;
  role?: string;
  'aria-label'?: string;
}

/**
 * Error fallback component for handling React errors
 */
const ErrorFallback: React.FC<{ error: Error }> = ({ error }) => (
  <div className="flex flex-col items-center justify-center min-h-screen bg-red-50 p-4" role="alert">
    <h2 className="text-lg font-semibold text-red-800 mb-2">Something went wrong</h2>
    <p className="text-sm text-red-600 mb-4">{error.message}</p>
    <button 
      onClick={() => window.location.reload()}
      className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500"
    >
      Reload Page
    </button>
  </div>
);

/**
 * Enhanced layout component for forms section with security, accessibility, and error handling
 */
const FormsLayout: React.FC<FormsLayoutProps> = ({
  children,
  requireAuth = true,
  role = 'main',
  'aria-label': ariaLabel = 'Forms section'
}) => {
  // Authentication and routing hooks
  const { user, isAuthenticated, validateSession } = useAuth();
  const router = useRouter();
  
  // Navigation state
  const [isNavCollapsed, setIsNavCollapsed] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  /**
   * Validates user access and permissions
   */
  const validateAccess = useCallback(async () => {
    if (requireAuth) {
      const isValid = await validateSession();
      
      if (!isValid || !isAuthenticated) {
        router.push('/auth/login?redirect=' + encodeURIComponent(router.asPath));
        return false;
      }

      // Verify form management permissions
      if (!user?.permissions.includes(UserPermission.MANAGE_FORMS)) {
        router.push('/dashboard');
        return false;
      }
    }
    return true;
  }, [requireAuth, validateSession, isAuthenticated, router, user]);

  /**
   * Handle navigation toggle with state persistence
   */
  const handleNavToggle = useCallback(() => {
    setIsNavCollapsed(prev => {
      const newState = !prev;
      localStorage.setItem('navCollapsed', String(newState));
      return newState;
    });
  }, []);

  // Initial setup and access validation
  useEffect(() => {
    const initializeLayout = async () => {
      setIsLoading(true);
      
      // Restore navigation state
      const savedState = localStorage.getItem('navCollapsed');
      if (savedState) {
        setIsNavCollapsed(savedState === 'true');
      }

      // Validate access
      await validateAccess();
      
      setIsLoading(false);
    };

    initializeLayout();
  }, [validateAccess]);

  // Periodic session validation
  useEffect(() => {
    if (requireAuth) {
      const interval = setInterval(validateAccess, 60000); // Check every minute
      return () => clearInterval(interval);
    }
  }, [requireAuth, validateAccess]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader size="lg" center aria-label="Loading forms section" />
      </div>
    );
  }

  return (
    <ErrorBoundary FallbackComponent={ErrorFallback}>
      <div className="min-h-screen bg-gray-50">
        {/* Skip Navigation Link for Accessibility */}
        <a 
          href="#main-content"
          className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 focus:px-4 focus:py-2 focus:bg-white focus:border-2 focus:border-primary-500 focus:rounded"
        >
          Skip to main content
        </a>

        {/* Main Layout Structure */}
        <div className="flex h-screen overflow-hidden">
          {/* Sidebar Navigation */}
          <Sidebar 
            isCollapsed={isNavCollapsed}
            onToggle={handleNavToggle}
            className="flex-shrink-0"
          />

          {/* Main Content Area */}
          <div className="flex-1 flex flex-col overflow-hidden">
            {/* Header */}
            <Header 
              isNavCollapsed={isNavCollapsed}
              onNavToggle={handleNavToggle}
            />

            {/* Main Content */}
            <main
              id="main-content"
              role={role}
              aria-label={ariaLabel}
              className={clsx(
                'flex-1 overflow-y-auto focus:outline-none',
                'bg-gray-50 p-6',
                'transition-all duration-200 ease-in-out'
              )}
              tabIndex={-1}
            >
              {children}
            </main>
          </div>
        </div>
      </div>
    </ErrorBoundary>
  );
};

export default FormsLayout;