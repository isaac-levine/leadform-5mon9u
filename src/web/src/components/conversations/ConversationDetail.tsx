/**
 * @fileoverview Enhanced conversation detail component with real-time updates,
 * offline support, and accessibility features for SMS lead management
 * @version 1.0.0
 */

import React, { useEffect, useCallback, useState, useRef } from 'react'; // ^18.0.0
import { ErrorBoundary } from 'react-error-boundary'; // ^4.0.0
import { useVirtualizer } from '@tanstack/react-virtual'; // ^3.0.0

// Internal imports
import { Conversation, ConversationStatus, Message } from '../../types/conversation';
import { MessageInput } from './MessageInput';
import { useConversation } from '../../hooks/useConversation';
import Button from '../shared/Button';
import { AI_CONFIDENCE_THRESHOLDS } from '../../lib/constants/messages';

// Types
interface ConversationDetailProps {
  /** UUID of the conversation to display */
  conversationId: string;
  /** Optional CSS class name */
  className?: string;
  /** Error callback handler */
  onError?: (error: Error) => void;
}

/**
 * Enhanced error fallback component for conversation errors
 */
const ErrorFallback: React.FC<{ error: Error; resetErrorBoundary: () => void }> = ({
  error,
  resetErrorBoundary
}) => (
  <div className="conversation-error" role="alert">
    <h3>Something went wrong</h3>
    <pre>{error.message}</pre>
    <Button 
      variant="primary" 
      onClick={resetErrorBoundary}
      ariaLabel="Retry loading conversation"
    >
      Try again
    </Button>
  </div>
);

/**
 * Message timestamp formatter with localization support
 */
const formatMessageTime = (timestamp: Date): string => {
  return new Intl.DateTimeFormat('en-US', {
    hour: 'numeric',
    minute: 'numeric',
    hour12: true
  }).format(timestamp);
};

/**
 * Enhanced conversation detail component with virtualization and offline support
 */
const ConversationDetail: React.FC<ConversationDetailProps> = ({
  conversationId,
  className,
  onError
}) => {
  // State and refs
  const containerRef = useRef<HTMLDivElement>(null);
  const [isScrolledToBottom, setIsScrolledToBottom] = useState(true);
  const [isHumanTakeover, setIsHumanTakeover] = useState(false);

  // Custom hooks
  const {
    currentConversation,
    loading,
    error,
    takeoverConversation,
    loadMore,
    isOffline
  } = useConversation({
    conversationId,
    onError
  });

  // Virtualized message list for performance
  const rowVirtualizer = useVirtualizer({
    count: currentConversation?.messages.length || 0,
    getScrollElement: () => containerRef.current,
    estimateSize: () => 100,
    overscan: 5
  });

  /**
   * Handles human takeover with retry logic
   */
  const handleTakeover = useCallback(async () => {
    try {
      await takeoverConversation();
      setIsHumanTakeover(true);
    } catch (err) {
      onError?.(err as Error);
    }
  }, [takeoverConversation, onError]);

  /**
   * Handles scroll events for infinite loading
   */
  const handleScroll = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;

    const { scrollTop, scrollHeight, clientHeight } = container;
    const isBottom = scrollHeight - scrollTop === clientHeight;
    setIsScrolledToBottom(isBottom);

    // Load more messages when near top
    if (scrollTop < 100) {
      loadMore();
    }
  }, [loadMore]);

  // Scroll to bottom on new messages
  useEffect(() => {
    if (isScrolledToBottom && containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [currentConversation?.messages.length, isScrolledToBottom]);

  // Loading state
  if (loading) {
    return (
      <div className="conversation-detail conversation-detail--loading">
        <div className="loading-skeleton" aria-busy="true">
          <div className="loading-header" />
          <div className="loading-messages">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="loading-message" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  // Error state
  if (error || !currentConversation) {
    return (
      <div className="conversation-detail conversation-detail--error">
        <ErrorFallback 
          error={error || new Error('Conversation not found')} 
          resetErrorBoundary={() => window.location.reload()} 
        />
      </div>
    );
  }

  return (
    <div 
      className={`conversation-detail ${className || ''}`}
      data-testid="conversation-detail"
    >
      {/* Offline indicator */}
      {isOffline && (
        <div 
          className="offline-indicator" 
          role="status" 
          aria-live="polite"
        >
          Working offline - Messages will be sent when connection is restored
        </div>
      )}

      {/* Conversation header */}
      <header className="conversation-header">
        <div className="conversation-info">
          <h2>{currentConversation.phoneNumber}</h2>
          <span className="conversation-status">
            {currentConversation.status}
          </span>
        </div>
        {!isHumanTakeover && (
          <Button
            variant="primary"
            onClick={handleTakeover}
            disabled={isOffline}
            ariaLabel="Take over conversation"
          >
            Take Over
          </Button>
        )}
      </header>

      {/* Virtualized message list */}
      <div 
        ref={containerRef}
        className="conversation-content"
        onScroll={handleScroll}
      >
        <div
          style={{
            height: `${rowVirtualizer.getTotalSize()}px`,
            width: '100%',
            position: 'relative'
          }}
        >
          {rowVirtualizer.getVirtualItems().map((virtualRow) => {
            const message = currentConversation.messages[virtualRow.index];
            return (
              <div
                key={message.id}
                data-index={virtualRow.index}
                ref={rowVirtualizer.measureElement}
                className={`message-item ${message.direction.toLowerCase()}`}
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  transform: `translateY(${virtualRow.start}px)`
                }}
              >
                <div className="message-content">
                  {message.content}
                  {message.aiConfidence !== undefined && (
                    <div 
                      className="ai-confidence"
                      title={`AI Confidence: ${Math.round(message.aiConfidence * 100)}%`}
                    >
                      <div 
                        className="confidence-indicator"
                        style={{
                          width: `${message.aiConfidence * 100}%`,
                          backgroundColor: message.aiConfidence > AI_CONFIDENCE_THRESHOLDS.HIGH 
                            ? '#10B981' 
                            : '#F59E0B'
                        }}
                      />
                    </div>
                  )}
                </div>
                <time className="message-time">
                  {formatMessageTime(message.timestamp)}
                </time>
              </div>
            );
          })}
        </div>
      </div>

      {/* Message input */}
      <footer className="conversation-footer">
        <MessageInput
          conversationId={conversationId}
          isHumanTakeover={isHumanTakeover}
          isOffline={isOffline}
          disabled={currentConversation.status === ConversationStatus.CLOSED}
        />
      </footer>
    </div>
  );
};

/**
 * Wrapped component with error boundary and accessibility enhancements
 */
const EnhancedConversationDetail: React.FC<ConversationDetailProps> = (props) => (
  <ErrorBoundary
    FallbackComponent={ErrorFallback}
    onError={props.onError}
    resetKeys={[props.conversationId]}
  >
    <ConversationDetail {...props} />
  </ErrorBoundary>
);

export default EnhancedConversationDetail;

// CSS styles
const styles = `
.conversation-detail {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: var(--background-color);
  position: relative;
}

.conversation-header {
  padding: 16px;
  border-bottom: 1px solid var(--border-color);
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: var(--header-background);
}

.conversation-content {
  flex: 1;
  overflow-y: auto;
  padding: 16px;
  scroll-behavior: smooth;
}

.conversation-footer {
  border-top: 1px solid var(--border-color);
  padding: 16px;
  background: var(--footer-background);
}

.offline-indicator {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  background: var(--warning-color);
  color: white;
  text-align: center;
  padding: 4px;
}

.message-item {
  margin: 8px 0;
  max-width: 80%;
}

.message-item.inbound {
  margin-right: auto;
}

.message-item.outbound {
  margin-left: auto;
}

.message-content {
  padding: 12px;
  border-radius: 8px;
  background: var(--message-background);
  position: relative;
}

.ai-confidence {
  height: 4px;
  background: var(--neutral-200);
  border-radius: 2px;
  margin-top: 8px;
  overflow: hidden;
}

.confidence-indicator {
  height: 100%;
  transition: width 0.3s ease;
}

.message-time {
  font-size: 0.75rem;
  color: var(--text-secondary);
  margin-top: 4px;
  display: block;
}

.loading-skeleton {
  padding: 16px;
}

.loading-header {
  height: 24px;
  background: var(--skeleton-color);
  border-radius: 4px;
  margin-bottom: 16px;
}

.loading-message {
  height: 80px;
  background: var(--skeleton-color);
  border-radius: 8px;
  margin: 8px 0;
  animation: pulse 1.5s infinite;
}

@keyframes pulse {
  0% { opacity: 0.6; }
  50% { opacity: 0.8; }
  100% { opacity: 0.6; }
}
`;