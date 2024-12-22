/**
 * @fileoverview Next.js page component for SMS conversations dashboard
 * Features real-time updates, virtualized list, and human takeover capabilities
 * @version 1.0.0
 */

'use client';

import React, { useCallback, useEffect } from 'react';
import { ErrorBoundary } from 'react-error-boundary';
import { Metadata } from 'next';
import ConversationList from '../../components/conversations/ConversationList';
import Loader from '../../components/shared/Loader';
import { useConversation } from '../../hooks/useConversation';

// Enhanced metadata for SEO optimization
export const metadata: Metadata = {
  title: 'SMS Conversations | AI-Driven Lead Nurturing Platform',
  description: 'Manage and monitor SMS conversations with leads in real-time. Features AI-powered responses and human takeover capabilities.',
  openGraph: {
    title: 'SMS Conversations Dashboard',
    description: 'Real-time SMS conversation management with AI assistance',
    type: 'website',
    images: ['/images/dashboard-preview.jpg'],
  },
  robots: {
    index: true,
    follow: true,
  },
  viewport: 'width=device-width, initial-scale=1, maximum-scale=1',
  themeColor: '#2563EB',
};

// Error fallback component with retry capability
const ErrorFallback: React.FC<{ error: Error; resetErrorBoundary: () => void }> = ({
  error,
  resetErrorBoundary
}) => (
  <div className="error-container" style={styles.error} role="alert">
    <h2>Unable to load conversations</h2>
    <p>{error.message}</p>
    <button
      onClick={resetErrorBoundary}
      style={styles.retry}
      className="retry-button"
    >
      Try Again
    </button>
  </div>
);

// Main conversations page component
const ConversationsPage: React.FC = () => {
  const {
    loading,
    error,
    retry,
    connectionStatus,
    queueStatus
  } = useConversation({
    autoConnect: true,
    syncInterval: 30000,
    retryAttempts: 3
  });

  // Performance optimization for conversation list
  const handleRetry = useCallback(() => {
    retry();
  }, [retry]);

  // Monitor connection health
  useEffect(() => {
    if (connectionStatus === 'ERROR') {
      console.error('WebSocket connection error. Queue size:', queueStatus.size);
    }
  }, [connectionStatus, queueStatus]);

  // Loading state with accessible indicator
  if (loading) {
    return (
      <div style={styles.container}>
        <Loader
          size="lg"
          center
          color="primary"
          aria-label="Loading conversations"
        />
      </div>
    );
  }

  // Error state with retry option
  if (error) {
    return (
      <div style={styles.container}>
        <div style={styles.error} role="alert">
          <p>Error loading conversations: {error.message}</p>
          <button onClick={handleRetry} style={styles.retry}>
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <ErrorBoundary
      FallbackComponent={ErrorFallback}
      onReset={handleRetry}
      onError={(error) => {
        console.error('Conversations Error:', error);
        // Additional error tracking could be added here
      }}
    >
      <main style={styles.container}>
        <ConversationList
          className="conversations-list"
          virtualized={{
            itemHeight: 100,
            overscan: 5
          }}
          onRetry={handleRetry}
        />
      </main>
    </ErrorBoundary>
  );
};

// Styles object for component
const styles = {
  container: {
    padding: '1.5rem',
    height: '100%',
    display: 'flex',
    flexDirection: 'column',
    position: 'relative'
  },
  error: {
    color: '#EF4444',
    textAlign: 'center',
    padding: '1rem',
    backgroundColor: '#FEE2E2',
    borderRadius: '0.375rem',
    margin: '1rem 0'
  },
  retry: {
    marginTop: '0.5rem',
    color: '#2563EB',
    cursor: 'pointer',
    textDecoration: 'underline'
  }
} as const;

// Add display name for debugging
ConversationsPage.displayName = 'ConversationsPage';

export default ConversationsPage;