/**
 * @fileoverview API client module for SMS conversations and messages
 * Provides comprehensive functions for conversation management with offline support
 * @version 1.0.0
 */

import axios, { AxiosInstance, AxiosRequestConfig } from 'axios'; // ^1.6.0
import { io, Socket } from 'socket.io-client'; // ^4.7.0
import localforage from 'localforage'; // ^1.10.0

import { 
  Conversation, 
  Message, 
  ConversationStatus, 
  MessageDirection, 
  MessageStatus 
} from '../../types/conversation';
import { MESSAGE_MAX_LENGTH } from '../../lib/constants/messages';

// API configuration
const API_CONFIG = {
  baseURL: process.env.NEXT_PUBLIC_API_URL,
  timeout: 10000,
  retries: 3,
  cacheTTL: 5 * 60 * 1000, // 5 minutes
};

// Response types
interface CursorPaginatedResponse<T> {
  data: T[];
  nextCursor: string | null;
  total: number;
}

interface ConversationFilters {
  status?: ConversationStatus[];
  search?: string;
  tags?: string[];
  priority?: number;
  aiConfidenceRange?: {
    min: number;
    max: number;
  };
}

// Initialize API client with interceptors
const apiClient: AxiosInstance = axios.create({
  baseURL: API_CONFIG.baseURL,
  timeout: API_CONFIG.timeout,
});

// Initialize WebSocket connection
let socket: Socket | null = null;

/**
 * Namespace containing all conversation-related API operations
 */
export namespace ConversationAPI {
  /**
   * Retrieves a paginated list of conversations with filtering
   * @param params - Pagination and filter parameters
   * @returns Promise resolving to paginated conversation list
   */
  export async function getConversations(params: {
    cursor?: string;
    limit?: number;
    status?: ConversationStatus[];
    search?: string;
    tags?: string[];
    priority?: number;
    aiConfidenceRange?: { min: number; max: number };
  }): Promise<CursorPaginatedResponse<Conversation>> {
    const cacheKey = `conversations:${JSON.stringify(params)}`;
    const cached = await localforage.getItem<CursorPaginatedResponse<Conversation>>(cacheKey);

    if (cached) {
      return cached;
    }

    const response = await apiClient.get('/conversations', { params });
    await localforage.setItem(cacheKey, response.data, { ttl: API_CONFIG.cacheTTL });
    
    return response.data;
  }

  /**
   * Retrieves a single conversation by ID
   * @param id - Conversation UUID
   * @returns Promise resolving to conversation details
   */
  export async function getConversationById(id: string): Promise<Conversation> {
    const cacheKey = `conversation:${id}`;
    const cached = await localforage.getItem<Conversation>(cacheKey);

    if (cached) {
      return cached;
    }

    const response = await apiClient.get(`/conversations/${id}`);
    await localforage.setItem(cacheKey, response.data);
    
    return response.data;
  }

  /**
   * Sends a new message in a conversation with offline support
   * @param conversationId - Target conversation UUID
   * @param content - Message content
   * @param options - Additional message options
   * @returns Promise resolving to created message
   */
  export async function sendMessage(
    conversationId: string,
    content: string,
    options: {
      priority?: number;
      retryAttempts?: number;
      timeout?: number;
    } = {}
  ): Promise<Message> {
    if (!content || content.length > MESSAGE_MAX_LENGTH) {
      throw new Error(`Message content must be between 1 and ${MESSAGE_MAX_LENGTH} characters`);
    }

    const messageData = {
      content,
      direction: MessageDirection.OUTBOUND,
      priority: options.priority,
      timestamp: new Date(),
    };

    // Queue message if offline
    if (!navigator.onLine) {
      await localforage.setItem(`message:queue:${Date.now()}`, {
        conversationId,
        messageData,
        options,
      });
      throw new Error('Message queued for sending when online');
    }

    const config: AxiosRequestConfig = {
      timeout: options.timeout || API_CONFIG.timeout,
      retries: options.retryAttempts || API_CONFIG.retries,
    };

    const response = await apiClient.post(
      `/conversations/${conversationId}/messages`,
      messageData,
      config
    );

    socket?.emit('message:sent', response.data);
    return response.data;
  }

  /**
   * Initiates human takeover of a conversation
   * @param conversationId - Target conversation UUID
   * @returns Promise resolving to updated conversation
   */
  export async function takeoverConversation(conversationId: string): Promise<Conversation> {
    const response = await apiClient.post(`/conversations/${conversationId}/takeover`);
    socket?.emit('conversation:takeover', response.data);
    return response.data;
  }

  /**
   * Releases human control of a conversation back to AI
   * @param conversationId - Target conversation UUID
   * @returns Promise resolving to updated conversation
   */
  export async function releaseConversation(conversationId: string): Promise<Conversation> {
    const response = await apiClient.post(`/conversations/${conversationId}/release`);
    socket?.emit('conversation:release', response.data);
    return response.data;
  }

  /**
   * Closes a conversation
   * @param conversationId - Target conversation UUID
   * @param reason - Optional closure reason
   * @returns Promise resolving to closed conversation
   */
  export async function closeConversation(
    conversationId: string,
    reason?: string
  ): Promise<Conversation> {
    const response = await apiClient.post(`/conversations/${conversationId}/close`, { reason });
    socket?.emit('conversation:closed', response.data);
    return response.data;
  }

  /**
   * Performs batch updates on multiple conversations
   * @param conversationIds - Array of conversation UUIDs
   * @param updates - Update payload
   * @returns Promise resolving to updated conversations
   */
  export async function batchUpdateConversations(
    conversationIds: string[],
    updates: Partial<Conversation>
  ): Promise<Conversation[]> {
    const response = await apiClient.patch('/conversations/batch', {
      ids: conversationIds,
      updates,
    });
    return response.data;
  }

  /**
   * Exports conversations to specified format
   * @param filters - Export filters
   * @param format - Export format (csv/json)
   * @returns Promise resolving to export URL
   */
  export async function exportConversations(
    filters: ConversationFilters,
    format: 'csv' | 'json' = 'csv'
  ): Promise<string> {
    const response = await apiClient.post('/conversations/export', {
      filters,
      format,
    });
    return response.data.url;
  }

  /**
   * Subscribes to real-time conversation updates
   * @param handlers - Event handlers for updates
   * @returns Cleanup function
   */
  export function subscribeToUpdates(handlers: {
    onMessage?: (message: Message) => void;
    onStatusChange?: (conversation: Conversation) => void;
    onError?: (error: Error) => void;
  }): () => void {
    if (!socket) {
      socket = io(API_CONFIG.baseURL, {
        path: '/ws',
        transports: ['websocket'],
      });
    }

    if (handlers.onMessage) {
      socket.on('message:new', handlers.onMessage);
    }
    if (handlers.onStatusChange) {
      socket.on('conversation:updated', handlers.onStatusChange);
    }
    if (handlers.onError) {
      socket.on('error', handlers.onError);
    }

    return () => {
      if (handlers.onMessage) {
        socket?.off('message:new', handlers.onMessage);
      }
      if (handlers.onStatusChange) {
        socket?.off('conversation:updated', handlers.onStatusChange);
      }
      if (handlers.onError) {
        socket?.off('error', handlers.onError);
      }
    };
  }
}

// Add response interceptor for error handling
apiClient.interceptors.response.use(
  response => response,
  async error => {
    const config = error.config;
    
    // Retry failed requests
    if (config.retries > 0) {
      config.retries--;
      return apiClient(config);
    }
    
    return Promise.reject(error);
  }
);

// Initialize offline queue processor
if (typeof window !== 'undefined') {
  window.addEventListener('online', async () => {
    const keys = await localforage.keys();
    const queuedMessages = keys.filter(key => key.startsWith('message:queue:'));
    
    for (const key of queuedMessages) {
      const { conversationId, messageData, options } = await localforage.getItem(key);
      try {
        await sendMessage(conversationId, messageData.content, options);
        await localforage.removeItem(key);
      } catch (error) {
        console.error('Failed to send queued message:', error);
      }
    }
  });
}

export default ConversationAPI;