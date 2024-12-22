'use client';

import React, { useEffect } from 'react';
import { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';
import { ErrorBoundary } from 'react-error-boundary';

// Internal imports
import ConversationDetail from '../../../components/conversations/ConversationDetail';
import { useConversation } from '../../../hooks/useConversation';
import { ConversationStatus } from '../../../types/conversation';
import { MESSAGE_STATUS_LABELS } from '../../../lib/constants/messages';

// Types
interface ConversationPageProps {
  params: {
    id: string;
  };
}

/**
 * Error fallback component for conversation page errors
 */
const ErrorFallback: React.FC<{ error: Error; resetErrorBoundary: () => void }> = ({
  error,
  resetErrorBoundary
}) => (
  <div 
    className="conversation-page__error" 
    role="alert"
    aria-live="assertive"
  >
    <h2>Error Loading Conversation</h2>
    <p>{error.message}</p>
    <button 
      onClick={resetErrorBoundary}
      className="error-retry-button"
      aria-label="Retry loading conversation"
    >
      Try Again
    </button>
  </div>
);

/**
 * Loading skeleton component for conversation page
 */
const LoadingSkeleton: React.FC = () => (
  <div 
    className="conversation-page conversation-page--loading" 
    aria-busy="true"
    role="status"
  >
    <div className="loading-header" />
    <div className="loading-content">
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="loading-message" />
      ))}
    </div>
  </div>
);

/**
 * Generates metadata for the conversation page
 */
export async function generateMetadata({ params }: ConversationPageProps): Promise<Metadata> {
  try {
    const { currentConversation } = useConversation({ conversationId: params.id });
    
    if (!currentConversation) {
      return {
        title: 'Conversation Not Found',
        description: 'The requested conversation could not be found.',
        robots: { index: false, follow: false }
      };
    }

    const status = MESSAGE_STATUS_LABELS[currentConversation.status] || 'Unknown Status';
    
    return {
      title: `Conversation with ${currentConversation.phoneNumber} - ${status}`,
      description: `SMS conversation management interface for ${currentConversation.phoneNumber}`,
      robots: { index: false, follow: false },
      openGraph: {
        title: `SMS Conversation - ${status}`,
        description: `Manage SMS conversation with ${currentConversation.phoneNumber}`,
        type: 'website'
      }
    };
  } catch (error) {
    return {
      title: 'Conversation',
      description: 'SMS conversation management interface',
      robots: { index: false, follow: false }
    };
  }
}

/**
 * Main conversation page component with real-time updates and error handling
 */
const ConversationPage: React.FC<ConversationPageProps> = ({ params }) => {
  const { 
    currentConversation,
    error,
    takeoverConversation,
    sendMessage,
    connectionStatus
  } = useConversation({
    conversationId: params.id,
    autoConnect: true
  });

  // Redirect to 404 if conversation not found
  useEffect(() => {
    if (!currentConversation && !error) {
      notFound();
    }
  }, [currentConversation, error]);

  // Handle human takeover
  const handleTakeover = async () => {
    try {
      await takeoverConversation();
    } catch (err) {
      console.error('Takeover failed:', err);
    }
  };

  // Handle message sending
  const handleMessageSend = async (content: string) => {
    try {
      await sendMessage(content);
    } catch (err) {
      console.error('Message send failed:', err);
    }
  };

  return (
    <ErrorBoundary
      FallbackComponent={ErrorFallback}
      onReset={() => window.location.reload()}
      resetKeys={[params.id]}
    >
      <main className="conversation-page">
        {/* Offline indicator */}
        {connectionStatus !== 'CONNECTED' && (
          <div 
            className="conversation-page__offline"
            role="status"
            aria-live="polite"
          >
            Working offline - Updates will sync when connection is restored
          </div>
        )}

        <Suspense fallback={<LoadingSkeleton />}>
          <ConversationDetail
            conversationId={params.id}
            onTakeOver={handleTakeover}
            onMessageSend={handleMessageSend}
          />
        </Suspense>
      </main>
    </ErrorBoundary>
  );
};

export default ConversationPage;