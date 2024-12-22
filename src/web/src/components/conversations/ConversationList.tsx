/**
 * @fileoverview Enhanced conversation list component with real-time updates and virtualization
 * Supports human takeover, AI confidence indicators, and accessibility features
 * @version 1.0.0
 */

import React, { useCallback, useMemo, useState } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { formatDistanceToNow } from 'date-fns';

// Internal imports
import { Conversation, ConversationStatus } from '../../types/conversation';
import { useConversation } from '../../hooks/useConversation';
import {
  CONVERSATION_STATUS_COLORS,
  CONVERSATION_STATUS_LABELS,
  AI_CONFIDENCE_THRESHOLDS
} from '../../lib/constants/messages';

// Component interfaces
interface ConversationListProps {
  className?: string;
  virtualListConfig?: {
    itemHeight: number;
    overscan: number;
  };
  onRetryError?: () => void;
  filterOptions?: {
    status: ConversationStatus[];
    searchTerm: string;
  };
}

interface ConversationItemProps {
  conversation: Conversation;
  isSelected: boolean;
  onSelect: (id: string) => void;
  style: React.CSSProperties;
}

// Custom hooks for conversation management
const useConversationFilter = (
  conversations: Conversation[],
  filterOptions?: ConversationListProps['filterOptions']
): Conversation[] => {
  return useMemo(() => {
    if (!filterOptions) return conversations;

    return conversations.filter(conversation => {
      const statusMatch = !filterOptions.status?.length || 
        filterOptions.status.includes(conversation.status);
      
      const searchMatch = !filterOptions.searchTerm || 
        conversation.phoneNumber.includes(filterOptions.searchTerm);

      return statusMatch && searchMatch;
    }).sort((a, b) => b.lastActivity.getTime() - a.lastActivity.getTime());
  }, [conversations, filterOptions]);
};

// Conversation item component with memoization
const ConversationItem = React.memo(({ 
  conversation, 
  isSelected, 
  onSelect,
  style 
}: ConversationItemProps) => {
  const handleClick = useCallback(() => {
    onSelect(conversation.id);
  }, [conversation.id, onSelect]);

  const lastMessage = conversation.messages[conversation.messages.length - 1];
  const aiConfidenceLevel = conversation.aiConfidence >= AI_CONFIDENCE_THRESHOLDS.HIGH ? 
    'high' : conversation.aiConfidence >= AI_CONFIDENCE_THRESHOLDS.MEDIUM ? 
    'medium' : 'low';

  return (
    <div
      role="button"
      tabIndex={0}
      className={`conversation-item ${isSelected ? 'selected' : ''}`}
      onClick={handleClick}
      onKeyPress={(e) => e.key === 'Enter' && handleClick()}
      style={style}
      aria-selected={isSelected}
      aria-label={`Conversation with ${conversation.phoneNumber}`}
    >
      <div className="conversation-header">
        <span className="phone-number">{conversation.phoneNumber}</span>
        <span 
          className={`status-badge ${conversation.status.toLowerCase()}`}
          style={{ backgroundColor: CONVERSATION_STATUS_COLORS[conversation.status] }}
          aria-label={CONVERSATION_STATUS_LABELS[conversation.status]}
        >
          {CONVERSATION_STATUS_LABELS[conversation.status]}
        </span>
      </div>

      <div className="conversation-content">
        <p className="last-message" aria-label="Last message">
          {lastMessage?.content || 'No messages'}
        </p>
        <span className="timestamp" aria-label="Last activity">
          {formatDistanceToNow(conversation.lastActivity, { addSuffix: true })}
        </span>
      </div>

      <div className="conversation-footer">
        <div 
          className={`ai-confidence ${aiConfidenceLevel}`}
          aria-label={`AI confidence: ${Math.round(conversation.aiConfidence * 100)}%`}
        >
          <div 
            className="confidence-bar"
            style={{ width: `${conversation.aiConfidence * 100}%` }}
          />
        </div>
        {conversation.status === ConversationStatus.HUMAN_TAKEOVER && (
          <span className="agent-badge" aria-label="Human agent active">
            👤 Agent Active
          </span>
        )}
      </div>
    </div>
  );
});

ConversationItem.displayName = 'ConversationItem';

// Error boundary component
class ConversationListErrorBoundary extends React.Component<
  { children: React.ReactNode; onRetry?: () => void },
  { hasError: boolean }
> {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: Error) {
    console.error('ConversationList Error:', error);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="error-container" role="alert">
          <h3>Unable to load conversations</h3>
          <button 
            onClick={() => {
              this.setState({ hasError: false });
              this.props.onRetry?.();
            }}
          >
            Retry
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

// Main conversation list component
export const ConversationList: React.FC<ConversationListProps> = ({
  className = '',
  virtualListConfig = { itemHeight: 100, overscan: 5 },
  onRetryError,
  filterOptions
}) => {
  const { conversations, loading, error } = useConversation();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  
  const filteredConversations = useConversationFilter(conversations, filterOptions);

  const parentRef = React.useRef<HTMLDivElement>(null);
  
  const rowVirtualizer = useVirtualizer({
    count: filteredConversations.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => virtualListConfig.itemHeight,
    overscan: virtualListConfig.overscan
  });

  if (loading) {
    return (
      <div className="loading-container" aria-busy="true">
        <div className="loading-spinner" role="progressbar" />
        <span>Loading conversations...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="error-container" role="alert">
        <p>Error: {error}</p>
        <button onClick={onRetryError}>Retry</button>
      </div>
    );
  }

  return (
    <ConversationListErrorBoundary onRetry={onRetryError}>
      <div 
        ref={parentRef}
        className={`conversation-list ${className}`}
        role="listbox"
        aria-label="Conversations"
      >
        <div
          style={{
            height: `${rowVirtualizer.getTotalSize()}px`,
            width: '100%',
            position: 'relative'
          }}
        >
          {rowVirtualizer.getVirtualItems().map((virtualRow) => (
            <ConversationItem
              key={filteredConversations[virtualRow.index].id}
              conversation={filteredConversations[virtualRow.index]}
              isSelected={selectedId === filteredConversations[virtualRow.index].id}
              onSelect={setSelectedId}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: `${virtualRow.size}px`,
                transform: `translateY(${virtualRow.start}px)`
              }}
            />
          ))}
        </div>
      </div>
    </ConversationListErrorBoundary>
  );
};

// Default export with display name
ConversationList.displayName = 'ConversationList';
export default ConversationList;

// Styles
const styles = {
  base: {
    display: 'flex',
    flexDirection: 'column',
    gap: '1rem',
    height: '100%',
    overflowY: 'auto',
    position: 'relative'
  },
  virtualList: {
    height: '100%',
    width: '100%',
    overflowY: 'auto',
    willChange: 'transform'
  },
  errorContainer: {
    padding: '2rem',
    textAlign: 'center',
    background: '#FEF2F2',
    borderRadius: '0.5rem',
    color: '#DC2626'
  }
} as const;