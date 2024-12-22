/**
 * @fileoverview MessageList component for displaying SMS conversation threads
 * Features virtualization, infinite scrolling, and real-time updates
 * @version 1.0.0
 */

// External imports with versions
import React, { useRef, useEffect, useMemo, useCallback } from 'react'; // ^18.0.0
import { FixedSizeList as VirtualList } from 'react-window'; // ^1.8.9
import { format, formatRelative } from 'date-fns'; // ^2.30.0
import clsx from 'clsx'; // ^2.0.0
import { debounce } from 'lodash'; // ^4.17.21

// Internal imports
import { Message, MessageDirection, MessageStatus } from '../../types/conversation';
import Badge from '../shared/Badge';

/**
 * Configuration options for list virtualization
 */
interface VirtualizeOptions {
  itemHeight: number;
  overscanCount?: number;
  initialScrollOffset?: number;
}

/**
 * Error state configuration
 */
interface ErrorState {
  hasError: boolean;
  message?: string;
}

/**
 * Props interface for MessageList component
 */
interface MessageListProps {
  messages: Message[];
  loading: boolean;
  onLoadMore?: () => Promise<void>;
  className?: string;
  virtualizeOptions?: VirtualizeOptions;
  errorState?: ErrorState;
}

/**
 * Formats message timestamp with relative time for recent messages
 * and absolute time for older messages
 */
const formatMessageTime = (timestamp: Date): string => {
  const now = new Date();
  const messageDate = new Date(timestamp);
  
  // Use relative time for messages within last 24 hours
  if (now.getTime() - messageDate.getTime() < 24 * 60 * 60 * 1000) {
    return formatRelative(messageDate, now);
  }
  
  // Use absolute time for older messages
  return format(messageDate, 'MMM d, h:mm a');
};

/**
 * Renders AI confidence indicator for outbound messages
 */
const AIConfidenceIndicator: React.FC<{ confidence: number }> = ({ confidence }) => {
  const variant = useMemo(() => {
    if (confidence >= 0.8) return 'success';
    if (confidence >= 0.6) return 'primary';
    return 'error';
  }, [confidence]);

  return (
    <Badge 
      variant={variant} 
      size="sm" 
      className="ml-2"
    >
      {`${Math.round(confidence * 100)}%`}
    </Badge>
  );
};

/**
 * Individual message item renderer for virtualization
 */
const MessageItem: React.FC<{ 
  message: Message; 
  style: React.CSSProperties;
}> = React.memo(({ message, style }) => {
  const isInbound = message.direction === MessageDirection.INBOUND;
  
  return (
    <div 
      style={style}
      className={clsx(
        'message',
        'p-4 rounded-lg shadow-sm',
        {
          'inbound bg-gray-100': isInbound,
          'outbound bg-blue-600 text-white': !isInbound,
        }
      )}
    >
      <div className="flex items-center justify-between">
        <div className="flex-1">{message.content}</div>
        {!isInbound && message.aiConfidence !== undefined && (
          <AIConfidenceIndicator confidence={message.aiConfidence} />
        )}
      </div>
      <div 
        className={clsx(
          'timestamp text-xs mt-2',
          isInbound ? 'text-gray-500' : 'text-blue-100'
        )}
      >
        {formatMessageTime(message.timestamp)}
        {message.status === MessageStatus.FAILED && (
          <Badge variant="error" size="sm" className="ml-2">
            Failed
          </Badge>
        )}
      </div>
    </div>
  );
});

/**
 * MessageList component - Renders a virtualized, infinite-scrolling list of SMS messages
 */
export const MessageList: React.FC<MessageListProps> = ({
  messages,
  loading,
  onLoadMore,
  className,
  virtualizeOptions = { itemHeight: 100, overscanCount: 5 },
  errorState = { hasError: false }
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const lastScrollTop = useRef(0);
  const isLoadingRef = useRef(loading);

  // Memoize virtualization configuration
  const listConfig = useMemo(() => ({
    height: containerRef.current?.clientHeight || window.innerHeight,
    itemCount: messages.length,
    itemSize: virtualizeOptions.itemHeight,
    overscanCount: virtualizeOptions.overscanCount,
    initialScrollOffset: virtualizeOptions.initialScrollOffset,
  }), [messages.length, virtualizeOptions]);

  /**
   * Scroll handler for infinite loading with debouncing
   */
  const handleScroll = useCallback(debounce((event: React.UIEvent<HTMLDivElement>) => {
    if (!onLoadMore || isLoadingRef.current) return;

    const target = event.target as HTMLDivElement;
    const scrollTop = target.scrollTop;
    const scrollingUp = scrollTop < lastScrollTop.current;
    
    // Load more when scrolling up and near top
    if (scrollingUp && scrollTop < 100) {
      isLoadingRef.current = true;
      onLoadMore().finally(() => {
        isLoadingRef.current = false;
      });
    }
    
    lastScrollTop.current = scrollTop;
  }, 150), [onLoadMore]);

  /**
   * Auto-scroll to bottom on new messages
   */
  useEffect(() => {
    if (!containerRef.current) return;
    
    const shouldAutoScroll = 
      containerRef.current.scrollHeight - 
      containerRef.current.scrollTop === 
      containerRef.current.clientHeight;

    if (shouldAutoScroll) {
      containerRef.current.scrollTo({
        top: containerRef.current.scrollHeight,
        behavior: 'smooth'
      });
    }
  }, [messages]);

  // Update loading ref when prop changes
  useEffect(() => {
    isLoadingRef.current = loading;
  }, [loading]);

  return (
    <div 
      ref={containerRef}
      className={clsx(
        'flex flex-col h-full overflow-y-auto',
        'scroll-smooth touch-pan-y',
        className
      )}
      onScroll={handleScroll}
    >
      {/* Loading indicator */}
      {loading && (
        <div className="loader flex justify-center py-4">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600" />
        </div>
      )}

      {/* Error state */}
      {errorState.hasError && (
        <div className="error mx-4 my-2">
          <Badge variant="error" size="md">
            {errorState.message || 'Error loading messages'}
          </Badge>
        </div>
      )}

      {/* Virtualized message list */}
      <VirtualList
        {...listConfig}
        className="messages-container"
      >
        {({ index, style }) => (
          <MessageItem
            message={messages[index]}
            style={style}
          />
        )}
      </VirtualList>
    </div>
  );
};

export default MessageList;

// Type exports for consumers
export type { MessageListProps, VirtualizeOptions, ErrorState };