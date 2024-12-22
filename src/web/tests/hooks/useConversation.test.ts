/**
 * @fileoverview Test suite for useConversation hook
 * Tests conversation management, real-time updates, offline support, and message queuing
 * @version 1.0.0
 */

import { renderHook, act } from '@testing-library/react-hooks'; // ^8.0.1
import { waitFor } from '@testing-library/react'; // ^14.0.0
import { useConversation } from '../../src/hooks/useConversation';
import { 
  Conversation, 
  Message, 
  ConversationStatus, 
  MessageDirection,
  MessageStatus 
} from '../../src/types/conversation';
import { MESSAGE_MAX_LENGTH, AI_CONFIDENCE_THRESHOLDS } from '../../src/lib/constants/messages';

// Mock WebSocket implementation
const mockWebSocket = {
  readyState: WebSocket.OPEN,
  send: jest.fn(),
  close: jest.fn(),
  onmessage: jest.fn(),
  onclose: jest.fn(),
  onerror: jest.fn()
};

// Mock network status
const mockNetworkStatus = {
  isOnline: true,
  setOnline: (status: boolean) => {
    mockNetworkStatus.isOnline = status;
    window.dispatchEvent(new Event(status ? 'online' : 'offline'));
  }
};

// Test data
const mockConversation: Conversation = {
  id: '123e4567-e89b-12d3-a456-426614174000',
  leadId: '123e4567-e89b-12d3-a456-426614174001',
  formId: '123e4567-e89b-12d3-a456-426614174002',
  status: ConversationStatus.ACTIVE,
  phoneNumber: '+1234567890',
  assignedAgent: null,
  lastActivity: new Date(),
  messages: [],
  metadata: {},
  aiEnabled: true,
  language: 'en-US',
  tags: []
};

const mockMessage: Message = {
  id: '123e4567-e89b-12d3-a456-426614174003',
  conversationId: mockConversation.id,
  content: 'Test message',
  direction: MessageDirection.OUTBOUND,
  status: MessageStatus.QUEUED,
  aiConfidence: 0.95,
  timestamp: new Date(),
  metadata: {}
};

describe('useConversation Hook', () => {
  beforeEach(() => {
    // Reset mocks and network status
    jest.clearAllMocks();
    mockNetworkStatus.setOnline(true);
    (global as any).WebSocket = jest.fn(() => mockWebSocket);
  });

  describe('Conversation Management', () => {
    it('should initialize with empty conversations', () => {
      const { result } = renderHook(() => useConversation());
      
      expect(result.current.conversations).toEqual([]);
      expect(result.current.currentConversation).toBeNull();
      expect(result.current.loading).toBeFalsy();
      expect(result.current.error).toBeNull();
    });

    it('should handle sending messages successfully', async () => {
      const { result } = renderHook(() => useConversation());
      
      await act(async () => {
        await result.current.sendMessage(mockMessage.content);
      });

      expect(mockWebSocket.send).toHaveBeenCalledWith(
        expect.stringContaining(mockMessage.content)
      );
    });

    it('should validate message length', async () => {
      const { result } = renderHook(() => useConversation());
      const longMessage = 'a'.repeat(MESSAGE_MAX_LENGTH + 1);

      await expect(
        act(async () => {
          await result.current.sendMessage(longMessage);
        })
      ).rejects.toThrow(/Message must be between/);
    });

    it('should handle human takeover', async () => {
      const { result } = renderHook(() => useConversation());
      
      await act(async () => {
        await result.current.takeoverConversation();
      });

      expect(result.current.currentConversation?.status).toBe(
        ConversationStatus.HUMAN_TAKEOVER
      );
    });
  });

  describe('Offline Support', () => {
    it('should queue messages when offline', async () => {
      const { result } = renderHook(() => useConversation());
      
      mockNetworkStatus.setOnline(false);
      
      await act(async () => {
        await result.current.sendMessage(mockMessage.content);
      });

      expect(result.current.queueStatus.size).toBe(1);
      expect(result.current.queueStatus.processing).toBeFalsy();
    });

    it('should process queued messages when back online', async () => {
      const { result } = renderHook(() => useConversation());
      
      // Queue message while offline
      mockNetworkStatus.setOnline(false);
      await act(async () => {
        await result.current.sendMessage(mockMessage.content);
      });

      // Come back online
      mockNetworkStatus.setOnline(true);
      await waitFor(() => {
        expect(result.current.queueStatus.size).toBe(0);
      });
    });

    it('should handle retry attempts for failed messages', async () => {
      const { result } = renderHook(() => useConversation());
      
      // Simulate failed message
      mockWebSocket.send.mockRejectedValueOnce(new Error('Send failed'));
      
      await act(async () => {
        await result.current.sendMessage(mockMessage.content);
      });

      await act(async () => {
        await result.current.retryFailedMessages();
      });

      expect(mockWebSocket.send).toHaveBeenCalledTimes(2);
    });
  });

  describe('WebSocket Connection', () => {
    it('should establish WebSocket connection on mount', () => {
      renderHook(() => useConversation());
      expect(WebSocket).toHaveBeenCalled();
    });

    it('should handle WebSocket reconnection', async () => {
      const { result } = renderHook(() => useConversation());
      
      // Simulate connection drop
      mockWebSocket.onclose();
      
      await act(async () => {
        await result.current.reconnectWebSocket();
      });

      expect(WebSocket).toHaveBeenCalledTimes(2);
    });

    it('should handle real-time message updates', async () => {
      const { result } = renderHook(() => useConversation());
      
      // Simulate incoming message
      const incomingMessage = {
        ...mockMessage,
        direction: MessageDirection.INBOUND
      };

      await act(async () => {
        mockWebSocket.onmessage({
          data: JSON.stringify(incomingMessage)
        });
      });

      expect(result.current.conversations[0]?.messages).toContainEqual(
        expect.objectContaining(incomingMessage)
      );
    });
  });

  describe('Message Queue Management', () => {
    it('should respect queue size limits', async () => {
      const { result } = renderHook(() => useConversation({
        queueSize: 1
      }));

      mockNetworkStatus.setOnline(false);
      
      // Try to queue two messages
      await act(async () => {
        await result.current.sendMessage('Message 1');
        await result.current.sendMessage('Message 2');
      });

      expect(result.current.queueStatus.size).toBe(1);
    });

    it('should prioritize message processing by timestamp', async () => {
      const { result } = renderHook(() => useConversation());
      
      mockNetworkStatus.setOnline(false);
      
      // Queue messages with different timestamps
      await act(async () => {
        await result.current.sendMessage('Message 1');
        await new Promise(resolve => setTimeout(resolve, 100));
        await result.current.sendMessage('Message 2');
      });

      mockNetworkStatus.setOnline(true);
      
      // Verify processing order
      expect(mockWebSocket.send).toHaveBeenCalledWith(
        expect.stringContaining('Message 1')
      );
    });
  });

  describe('Error Handling', () => {
    it('should handle WebSocket connection errors', () => {
      const { result } = renderHook(() => useConversation());
      
      act(() => {
        mockWebSocket.onerror(new Error('Connection failed'));
      });

      expect(result.current.error).toBeTruthy();
    });

    it('should handle message send failures gracefully', async () => {
      const { result } = renderHook(() => useConversation());
      
      mockWebSocket.send.mockRejectedValueOnce(new Error('Send failed'));
      
      await act(async () => {
        await expect(
          result.current.sendMessage(mockMessage.content)
        ).rejects.toThrow('Send failed');
      });

      expect(result.current.error).toBeTruthy();
    });
  });
});