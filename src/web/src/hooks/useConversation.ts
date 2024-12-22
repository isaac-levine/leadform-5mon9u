/**
 * @fileoverview Enhanced React hook for managing SMS conversations with comprehensive features
 * Provides real-time updates, offline support, message queuing, and intelligent error handling
 * @version 1.0.0
 */

import { useEffect, useCallback, useRef } from 'react'; // ^18.0.0
import { useWebSocket } from './useWebSocket';
import { 
  Conversation, 
  Message, 
  ConversationStatus, 
  MessageDirection,
  MessageStatus 
} from '../types/conversation';
import { ConversationAPI } from '../lib/api/conversations';
import { 
  MESSAGE_MAX_LENGTH, 
  MESSAGE_RETRY_ATTEMPTS,
  AI_CONFIDENCE_THRESHOLDS 
} from '../lib/constants/messages';

/**
 * Configuration options for conversation management
 */
interface UseConversationConfig {
  autoConnect?: boolean;
  pageSize?: number;
  retryAttempts?: number;
  retryDelay?: number;
  queueSize?: number;
  syncInterval?: number;
}

/**
 * Connection status enum for WebSocket state
 */
enum ConnectionStatus {
  CONNECTED = 'CONNECTED',
  DISCONNECTED = 'DISCONNECTED',
  CONNECTING = 'CONNECTING',
  ERROR = 'ERROR'
}

/**
 * Queue status for message handling
 */
interface QueueStatus {
  size: number;
  processing: boolean;
  error: Error | null;
}

/**
 * Return type for useConversation hook
 */
interface UseConversationReturn {
  conversations: Conversation[];
  currentConversation: Conversation | null;
  loading: boolean;
  error: Error | null;
  connectionStatus: ConnectionStatus;
  queueStatus: QueueStatus;
  sendMessage: (content: string) => Promise<void>;
  retryMessage: (messageId: string) => Promise<void>;
  takeoverConversation: () => Promise<void>;
  syncMessages: () => Promise<void>;
  clearQueue: () => void;
}

/**
 * Default configuration values
 */
const DEFAULT_CONFIG: Required<UseConversationConfig> = {
  autoConnect: true,
  pageSize: 20,
  retryAttempts: MESSAGE_RETRY_ATTEMPTS,
  retryDelay: 3000,
  queueSize: 1000,
  syncInterval: 30000
};

/**
 * Enhanced custom hook for managing SMS conversations
 * @param config - Configuration options
 * @returns Conversation state and control functions
 */
export function useConversation(
  config: UseConversationConfig = {}
): UseConversationReturn {
  // Merge provided config with defaults
  const finalConfig = { ...DEFAULT_CONFIG, ...config };

  // State references
  const conversationsRef = useRef<Map<string, Conversation>>(new Map());
  const currentConversationRef = useRef<string | null>(null);
  const messageQueueRef = useRef<Map<string, Message>>(new Map());
  const syncTimeoutRef = useRef<NodeJS.Timeout>();
  const loadingRef = useRef(false);
  const errorRef = useRef<Error | null>(null);

  // Initialize WebSocket connection
  const { 
    isConnected, 
    connect, 
    disconnect, 
    queueMessage,
    connectionHealth 
  } = useWebSocket({
    url: process.env.NEXT_PUBLIC_WS_URL || '',
    reconnectAttempts: finalConfig.retryAttempts,
    reconnectInterval: finalConfig.retryDelay,
    autoReconnect: finalConfig.autoConnect,
    messageQueueSize: finalConfig.queueSize
  });

  /**
   * Handles incoming WebSocket messages with deduplication
   */
  const handleWebSocketMessage = useCallback((message: Message) => {
    const conversation = conversationsRef.current.get(message.conversationId);
    if (!conversation) return;

    // Deduplicate messages
    const isDuplicate = conversation.messages.some(m => m.id === message.id);
    if (isDuplicate) return;

    // Update conversation with new message
    conversation.messages.push(message);
    conversation.lastActivity = new Date();
    conversationsRef.current.set(message.conversationId, { ...conversation });
  }, []);

  /**
   * Sends a new message with retry logic and offline support
   */
  const sendMessage = useCallback(async (content: string): Promise<void> => {
    if (!currentConversationRef.current) {
      throw new Error('No active conversation');
    }

    if (!content || content.length > MESSAGE_MAX_LENGTH) {
      throw new Error(`Message must be between 1 and ${MESSAGE_MAX_LENGTH} characters`);
    }

    const message: Message = {
      id: crypto.randomUUID(),
      conversationId: currentConversationRef.current,
      content,
      direction: MessageDirection.OUTBOUND,
      status: MessageStatus.QUEUED,
      timestamp: new Date(),
      metadata: {}
    } as Message;

    try {
      if (!navigator.onLine) {
        queueMessage(message);
        return;
      }

      const response = await ConversationAPI.sendMessage(
        currentConversationRef.current,
        content,
        { retryAttempts: finalConfig.retryAttempts }
      );

      handleWebSocketMessage(response);
    } catch (error) {
      queueMessage(message);
      errorRef.current = error as Error;
      throw error;
    }
  }, [queueMessage, handleWebSocketMessage]);

  /**
   * Retries sending a failed message
   */
  const retryMessage = useCallback(async (messageId: string): Promise<void> => {
    const message = messageQueueRef.current.get(messageId);
    if (!message) return;

    try {
      await sendMessage(message.content);
      messageQueueRef.current.delete(messageId);
    } catch (error) {
      console.error('Failed to retry message:', error);
      throw error;
    }
  }, [sendMessage]);

  /**
   * Initiates human takeover of conversation
   */
  const takeoverConversation = useCallback(async (): Promise<void> => {
    if (!currentConversationRef.current) {
      throw new Error('No active conversation');
    }

    try {
      const updatedConversation = await ConversationAPI.takeoverConversation(
        currentConversationRef.current
      );
      conversationsRef.current.set(updatedConversation.id, updatedConversation);
    } catch (error) {
      errorRef.current = error as Error;
      throw error;
    }
  }, []);

  /**
   * Synchronizes messages with server
   */
  const syncMessages = useCallback(async (): Promise<void> => {
    if (loadingRef.current || messageQueueRef.current.size === 0) return;

    loadingRef.current = true;
    try {
      for (const [id, message] of messageQueueRef.current) {
        await sendMessage(message.content);
        messageQueueRef.current.delete(id);
      }
    } catch (error) {
      console.error('Failed to sync messages:', error);
    } finally {
      loadingRef.current = false;
    }
  }, [sendMessage]);

  /**
   * Clears the message queue
   */
  const clearQueue = useCallback((): void => {
    messageQueueRef.current.clear();
  }, []);

  // Setup WebSocket connection and cleanup
  useEffect(() => {
    if (finalConfig.autoConnect) {
      connect();
    }

    return () => {
      disconnect();
      clearTimeout(syncTimeoutRef.current);
    };
  }, [connect, disconnect, finalConfig.autoConnect]);

  // Setup periodic message sync
  useEffect(() => {
    if (finalConfig.syncInterval > 0) {
      syncTimeoutRef.current = setInterval(syncMessages, finalConfig.syncInterval);
    }

    return () => {
      clearInterval(syncTimeoutRef.current);
    };
  }, [syncMessages, finalConfig.syncInterval]);

  return {
    conversations: Array.from(conversationsRef.current.values()),
    currentConversation: currentConversationRef.current 
      ? conversationsRef.current.get(currentConversationRef.current) || null 
      : null,
    loading: loadingRef.current,
    error: errorRef.current,
    connectionStatus: isConnected 
      ? ConnectionStatus.CONNECTED 
      : ConnectionStatus.DISCONNECTED,
    queueStatus: {
      size: messageQueueRef.current.size,
      processing: loadingRef.current,
      error: errorRef.current
    },
    sendMessage,
    retryMessage,
    takeoverConversation,
    syncMessages,
    clearQueue
  };
}

export default useConversation;