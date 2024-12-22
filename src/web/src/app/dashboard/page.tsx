'use client';

import React, { useEffect, useCallback, useState } from 'react';
import { redirect } from 'next/navigation';
import { ErrorBoundary, useErrorBoundary } from 'react-error-boundary';

// Internal imports
import { MetricsOverview } from '../../components/analytics/MetricsOverview';
import { ConversationList } from '../../components/conversations/ConversationList';
import { useAuth } from '../../hooks/useAuth';

/**
 * Error fallback component for graceful error handling
 */
const ErrorFallback = ({ error, resetErrorBoundary }: { error: Error, resetErrorBoundary: () => void }) => (
  <div 
    className="p-4 bg-red-50 border border-red-200 rounded-lg"
    role="alert"
    aria-label="Error message"
  >
    <h3 className="text-lg font-semibold text-red-700 mb-2">
      Something went wrong
    </h3>
    <p className="text-red-600 mb-4">{error.message}</p>
    <button
      onClick={resetErrorBoundary}
      className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 transition-colors"
    >
      Try again
    </button>
  </div>
);

/**
 * Loading component for visual feedback during data fetching
 */
const LoadingSpinner = () => (
  <div 
    className="flex items-center justify-center min-h-screen"
    role="progressbar"
    aria-label="Loading dashboard"
  >
    <div className="animate-spin rounded-full h-12 w-12 border-4 border-primary-500 border-t-transparent" />
  </div>
);

/**
 * Main dashboard page component with real-time updates and error handling
 */
const DashboardPage = () => {
  const { user, isAuthenticated, isLoading } = useAuth();
  const { showBoundary } = useErrorBoundary();
  const [refreshKey, setRefreshKey] = useState(0);

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      redirect('/login');
    }
  }, [isLoading, isAuthenticated]);

  // Error handlers for child components
  const handleMetricsError = useCallback((error: Error) => {
    console.error('Metrics Error:', error);
    showBoundary(error);
  }, [showBoundary]);

  const handleConversationsError = useCallback((error: Error) => {
    console.error('Conversations Error:', error);
    showBoundary(error);
  }, [showBoundary]);

  // Retry handler for error boundary
  const handleRetry = useCallback(() => {
    setRefreshKey(prev => prev + 1);
  }, []);

  // Show loading state while checking authentication
  if (isLoading) {
    return <LoadingSpinner />;
  }

  // Main dashboard layout
  return (
    <main className="p-6 max-w-7xl mx-auto">
      {/* Welcome header */}
      <header className="mb-8">
        <h1 className="text-3xl font-semibold text-gray-900 dark:text-white">
          Welcome back, {user?.firstName || 'User'}
        </h1>
        <p className="mt-2 text-gray-600 dark:text-gray-300">
          Here's an overview of your lead engagement metrics and recent conversations.
        </p>
      </header>

      {/* Metrics section */}
      <section 
        className="mb-8"
        aria-label="Performance metrics"
      >
        <h2 className="text-xl font-semibold text-gray-800 dark:text-white mb-4">
          Performance Overview
        </h2>
        <ErrorBoundary 
          FallbackComponent={ErrorFallback}
          onReset={handleRetry}
          key={`metrics-${refreshKey}`}
        >
          <MetricsOverview
            className="w-full"
            refreshInterval={30000} // 30 seconds refresh
            onError={handleMetricsError}
          />
        </ErrorBoundary>
      </section>

      {/* Conversations section */}
      <section 
        className="mb-8"
        aria-label="Recent conversations"
      >
        <h2 className="text-xl font-semibold text-gray-800 dark:text-white mb-4">
          Recent Conversations
        </h2>
        <ErrorBoundary 
          FallbackComponent={ErrorFallback}
          onReset={handleRetry}
          key={`conversations-${refreshKey}`}
        >
          <ConversationList
            className="w-full"
            refreshInterval={10000} // 10 seconds refresh
            onError={handleConversationsError}
            virtualListConfig={{
              itemHeight: 100,
              overscan: 5
            }}
          />
        </ErrorBoundary>
      </section>
    </main>
  );
};

// Add display name for debugging
DashboardPage.displayName = 'DashboardPage';

export default DashboardPage;