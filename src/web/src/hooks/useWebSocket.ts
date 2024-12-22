/**
 * @fileoverview Enhanced React hook for managing secure WebSocket connections
 * Provides robust error handling, reconnection logic, and offline message queuing
 * @version 1.0.0
 */

import { useEffect, useCallback, useRef } from 'react'; // ^18.0.0
import { useDispatch } from 'react-redux'; // ^8.0.0
import { Message } from '../types/conversation';
import { conversationActions } from '../store/slices/conversationSlice';

/**
 * WebSocket event types with enhanced error tracking
 */
export interface WebSocketEvent {
  event: string;
  data: any;
  error?: string;
  timestamp: number;
  retryCount: number;
}

/**
 * Configuration options for WebSocket connection
 */
export interface UseWebSocketOptions {
  url: string;
  reconnectAttempts: number;
  reconnectInterval: number;
  autoReconnect: boolean;
  useSSL: boolean;
  onError?: (error: Error) => void;
  heartbeatInterval: number;
  messageQueueSize: number;
}

/**
 * Default WebSocket configuration values
 */
const DEFAULT_OPTIONS: Partial<UseWebSocketOptions> = {
  reconnectAttempts: 5,
  reconnectInterval: 3000,
  autoReconnect: true,
  useSSL: true,
  heartbeatInterval: 30000,
  messageQueueSize: 1000
};

/**
 * WebSocket event types for real-time messaging
 */
export const WEBSOCKET_EVENTS = {
  NEW_MESSAGE: 'new_message',
  MESSAGE_STATUS: 'message_status',
  HUMAN_TAKEOVER: 'human_takeover',
  ERROR: 'error',
  HEARTBEAT: 'heartbeat',
  RECONNECT: 'reconnect'
} as const;

/**
 * Enhanced React hook for managing WebSocket connections with comprehensive error handling
 * @param options WebSocket configuration options
 * @returns Connection status and control functions
 */
export function useWebSocket(options: Partial<UseWebSocketOptions>) {
  const dispatch = useDispatch();
  const ws = useRef<WebSocket | null>(null);
  const reconnectAttempts = useRef(0);
  const reconnectTimeout = useRef<NodeJS.Timeout>();
  const heartbeatInterval = useRef<NodeJS.Timeout>();
  const messageQueue = useRef<Message[]>([]);

  // Merge provided options with defaults
  const config = { ...DEFAULT_OPTIONS, ...options };

  /**
   * Validates and processes incoming WebSocket messages
   */
  const handleMessage = useCallback((event: MessageEvent) => {
    try {
      const wsEvent: WebSocketEvent = JSON.parse(event.data);
      const timestamp = Date.now();

      switch (wsEvent.event) {
        case WEBSOCKET_EVENTS.NEW_MESSAGE:
          dispatch(conversationActions.addMessage({
            ...wsEvent.data,
            timestamp,
            retryCount: wsEvent.retryCount || 0
          }));
          break;

        case WEBSOCKET_EVENTS.MESSAGE_STATUS:
          dispatch(conversationActions.setCurrentConversation(wsEvent.data));
          break;

        case WEBSOCKET_EVENTS.HUMAN_TAKEOVER:
          dispatch(conversationActions.setCurrentConversation(wsEvent.data));
          break;

        case WEBSOCKET_EVENTS.ERROR:
          dispatch(conversationActions.handleMessageError({
            error: wsEvent.error,
            timestamp
          }));
          config.onError?.(new Error(wsEvent.error));
          break;
      }
    } catch (error) {
      console.error('WebSocket message parsing error:', error);
      config.onError?.(error as Error);
    }
  }, [dispatch, config.onError]);

  /**
   * Establishes WebSocket connection with security checks
   */
  const connect = useCallback(() => {
    if (!window.WebSocket) {
      throw new Error('WebSocket not supported in this browser');
    }

    const protocol = config.useSSL ? 'wss://' : 'ws://';
    ws.current = new WebSocket(`${protocol}${config.url}`);

    ws.current.onopen = () => {
      console.log('WebSocket connected');
      reconnectAttempts.current = 0;
      
      // Setup heartbeat
      heartbeatInterval.current = setInterval(() => {
        ws.current?.send(JSON.stringify({
          event: WEBSOCKET_EVENTS.HEARTBEAT,
          timestamp: Date.now()
        }));
      }, config.heartbeatInterval);

      // Process queued messages
      while (messageQueue.current.length > 0) {
        const message = messageQueue.current.shift();
        if (message) {
          dispatch(conversationActions.addMessage(message));
        }
      }
    };

    ws.current.onmessage = handleMessage;

    ws.current.onerror = (error) => {
      console.error('WebSocket error:', error);
      config.onError?.(error as Error);
    };

    ws.current.onclose = () => {
      clearInterval(heartbeatInterval.current);
      
      if (config.autoReconnect && reconnectAttempts.current < config.reconnectAttempts) {
        reconnectTimeout.current = setTimeout(() => {
          reconnectAttempts.current++;
          connect();
        }, config.reconnectInterval * Math.pow(2, reconnectAttempts.current)); // Exponential backoff
      }
    };
  }, [config, dispatch, handleMessage]);

  /**
   * Safely closes WebSocket connection and cleans up resources
   */
  const disconnect = useCallback(() => {
    clearTimeout(reconnectTimeout.current);
    clearInterval(heartbeatInterval.current);
    
    if (ws.current) {
      ws.current.close();
      ws.current = null;
    }
  }, []);

  /**
   * Queues message for offline storage
   */
  const queueMessage = useCallback((message: Message) => {
    if (messageQueue.current.length < config.messageQueueSize) {
      messageQueue.current.push(message);
      dispatch(conversationActions.queueOfflineMessage(message));
    } else {
      console.warn('Message queue full, dropping message');
    }
  }, [dispatch, config.messageQueueSize]);

  // Setup connection and cleanup
  useEffect(() => {
    connect();
    
    // Handle offline/online events
    const handleOnline = () => {
      if (!ws.current || ws.current.readyState === WebSocket.CLOSED) {
        connect();
      }
    };
    
    const handleOffline = () => {
      disconnect();
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      disconnect();
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [connect, disconnect]);

  return {
    isConnected: ws.current?.readyState === WebSocket.OPEN,
    connect,
    disconnect,
    queueMessage,
    connectionHealth: {
      reconnectAttempts: reconnectAttempts.current,
      queueSize: messageQueue.current.length
    }
  };
}

export default useWebSocket;