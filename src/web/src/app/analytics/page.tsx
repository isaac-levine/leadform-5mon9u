'use client';

import React, { memo, useCallback, useEffect } from 'react';
import { ErrorBoundary } from 'react-error-boundary'; // ^4.0.0
import { Suspense } from 'react';

// Internal component imports
import MetricsOverview from '../../components/analytics/MetricsOverview';
import AIPerformanceMetrics from '../../components/analytics/AIPerformanceMetrics';
import ConversionChart from '../../components/analytics/ConversionChart';
import LeadQualityChart from '../../components/analytics/LeadQualityChart';
import ResponseTimeChart from '../../components/analytics/ResponseTimeChart';

// Hook imports
import { useWebSocket } from '../../hooks/useWebSocket';

/**
 * Error fallback component for graceful error handling
 */
const ErrorFallback = ({ error, resetErrorBoundary }) => (
  <div 
    role="alert" 
    className="p-4 bg-red-50 border border-red-200 rounded-lg"
  >
    <h2 className="text-lg font-semibold text-red-700 mb-2">
      Error Loading Analytics
    </h2>
    <p className="text-red-600 mb-4">{error.message}</p>
    <button
      onClick={resetErrorBoundary}
      className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 focus:ring-2 focus:ring-red-500 focus:ring-offset-2"
    >
      Retry
    </button>
  </div>
);

/**
 * Loading component for Suspense fallback
 */
const LoadingState = () => (
  <div 
    role="status"
    className="animate-pulse space-y-6"
    aria-label="Loading analytics dashboard"
  >
    <div className="h-48 bg-gray-200 rounded-lg" />
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <div className="h-64 bg-gray-200 rounded-lg" />
      <div className="h-64 bg-gray-200 rounded-lg" />
    </div>
  </div>
);

/**
 * Main analytics dashboard page component
 * Displays comprehensive metrics and charts with real-time updates
 */
const AnalyticsPage = memo(() => {
  // Initialize WebSocket connection for real-time updates
  const { sendMessage } = useWebSocket({
    url: `${process.env.NEXT_PUBLIC_WS_URL}/analytics`,
    reconnectAttempts: 5,
    reconnectInterval: 3000,
    autoReconnect: true,
    useSSL: true
  });

  // Handle WebSocket cleanup on unmount
  useEffect(() => {
    return () => {
      sendMessage(JSON.stringify({ type: 'unsubscribe', target: 'analytics' }));
    };
  }, [sendMessage]);

  // Error handler for analytics components
  const handleError = useCallback((error: Error) => {
    console.error('Analytics Error:', error);
    // Additional error handling logic (e.g., error reporting)
  }, []);

  return (
    <main 
      className="p-6 space-y-6 focus-visible:outline-none"
      tabIndex={-1}
    >
      {/* Skip link for keyboard navigation */}
      <a 
        href="#main-content" 
        className="sr-only focus:not-sr-only focus:absolute focus:p-4"
      >
        Skip to main content
      </a>

      {/* Page header */}
      <header className="mb-8">
        <h1 
          className="text-2xl font-bold text-gray-900 focus:ring-2"
          tabIndex={0}
        >
          Analytics Dashboard
        </h1>
        <p className="text-sm text-gray-600 mt-1">
          Monitor lead capture and SMS engagement performance metrics
        </p>
      </header>

      {/* Main content area */}
      <div id="main-content">
        {/* Metrics Overview Section */}
        <ErrorBoundary 
          FallbackComponent={ErrorFallback}
          onError={handleError}
        >
          <Suspense fallback={<LoadingState />}>
            <MetricsOverview 
              className="mb-8"
              refreshInterval={30000}
              onError={handleError}
            />
          </Suspense>
        </ErrorBoundary>

        {/* AI Performance Section */}
        <ErrorBoundary 
          FallbackComponent={ErrorFallback}
          onError={handleError}
        >
          <Suspense fallback={<LoadingState />}>
            <AIPerformanceMetrics 
              className="mb-8"
              updateInterval={5000}
            />
          </Suspense>
        </ErrorBoundary>

        {/* Charts Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
          {/* Conversion Rate Chart */}
          <ErrorBoundary 
            FallbackComponent={ErrorFallback}
            onError={handleError}
          >
            <Suspense fallback={<LoadingState />}>
              <ConversionChart 
                height={400}
                className="w-full"
                ariaLabel="Conversion rate trends over time"
              />
            </Suspense>
          </ErrorBoundary>

          {/* Lead Quality Chart */}
          <ErrorBoundary 
            FallbackComponent={ErrorFallback}
            onError={handleError}
          >
            <Suspense fallback={<LoadingState />}>
              <LeadQualityChart 
                height={400}
                className="w-full"
                ariaLabel="Lead quality score distribution"
              />
            </Suspense>
          </ErrorBoundary>

          {/* Response Time Chart */}
          <ErrorBoundary 
            FallbackComponent={ErrorFallback}
            onError={handleError}
          >
            <Suspense fallback={<LoadingState />}>
              <ResponseTimeChart 
                height={400}
                className="w-full"
                showSLA={true}
              />
            </Suspense>
          </ErrorBoundary>
        </div>
      </div>
    </main>
  );
});

// Display name for debugging
AnalyticsPage.displayName = 'AnalyticsPage';

// Export with metadata for Next.js
export const metadata = {
  title: 'Analytics Dashboard | AI-SMS Lead Platform',
  description: 'Monitor lead capture and SMS engagement performance metrics'
};

// Force dynamic rendering for real-time data
export const dynamic = 'force-dynamic';
export const revalidate = 60; // Revalidate page every minute

export default AnalyticsPage;