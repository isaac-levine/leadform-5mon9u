/**
 * @fileoverview Redux slice for managing SMS conversation state
 * Handles conversation data, messages, real-time updates, and human takeover
 * @version 1.0.0
 */

import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit'; // ^2.0.0
import { 
  Conversation, 
  Message, 
  ConversationStatus,
  MessageDirection 
} from '../../types/conversation';
import { 
  getConversations, 
  sendMessage, 
  takeoverConversation 
} from '../../lib/api/conversations';
import { MESSAGE_MAX_LENGTH } from '../../lib/constants/messages';

// State interface with enhanced tracking
interface ConversationState {
  conversations: Record<string, Conversation>;
  activeConversationId: string | null;
  loading: boolean;
  error: {
    message: string;
    code: string;
    retryable: boolean;
  } | null;
  optimisticUpdates: Record<string, {
    type: string;
    data: any;
    timestamp: number;
  }>;
  socketConnected: boolean;
  lastUpdated: Record<string, number>;
}

// Initial state with proper typing
const initialState: ConversationState = {
  conversations: {},
  activeConversationId: null,
  loading: false,
  error: null,
  optimisticUpdates: {},
  socketConnected: false,
  lastUpdated: {}
};

// Enhanced async thunk for fetching conversations with retry logic
export const fetchConversations = createAsyncThunk(
  'conversations/fetch',
  async (params: {
    page?: number;
    limit?: number;
    status?: ConversationStatus[];
    retryCount?: number;
  }, { rejectWithValue }) => {
    try {
      const response = await getConversations({
        cursor: params.page?.toString(),
        limit: params.limit,
        status: params.status
      });
      
      return response.data;
    } catch (error: any) {
      return rejectWithValue({
        message: error.message,
        code: error.code,
        retryable: params.retryCount ? params.retryCount < 3 : true
      });
    }
  }
);

// Enhanced async thunk for sending messages with optimistic updates
export const sendNewMessage = createAsyncThunk(
  'conversations/sendMessage',
  async (payload: {
    conversationId: string;
    content: string;
    optimisticId: string;
  }, { rejectWithValue }) => {
    if (!payload.content || payload.content.length > MESSAGE_MAX_LENGTH) {
      return rejectWithValue({
        message: `Message must be between 1 and ${MESSAGE_MAX_LENGTH} characters`,
        code: 'INVALID_LENGTH',
        retryable: false
      });
    }

    try {
      const response = await sendMessage(
        payload.conversationId,
        payload.content,
        { retryAttempts: 2 }
      );
      return {
        message: response,
        optimisticId: payload.optimisticId
      };
    } catch (error: any) {
      return rejectWithValue({
        message: error.message,
        code: error.code,
        retryable: true,
        optimisticId: payload.optimisticId
      });
    }
  }
);

// Enhanced async thunk for human takeover
export const initiateHumanTakeover = createAsyncThunk(
  'conversations/takeover',
  async (conversationId: string, { rejectWithValue }) => {
    try {
      return await takeoverConversation(conversationId);
    } catch (error: any) {
      return rejectWithValue({
        message: error.message,
        code: error.code,
        retryable: true
      });
    }
  }
);

// Create the conversation slice with enhanced features
const conversationSlice = createSlice({
  name: 'conversations',
  initialState,
  reducers: {
    // Set active conversation with validation
    setActiveConversation(state, action: PayloadAction<string>) {
      const conversationId = action.payload;
      if (state.conversations[conversationId]) {
        state.activeConversationId = conversationId;
        state.lastUpdated[conversationId] = Date.now();
      }
    },

    // Handle WebSocket connection status
    setSocketConnected(state, action: PayloadAction<boolean>) {
      state.socketConnected = action.payload;
    },

    // Handle real-time message updates
    handleWebSocketMessage(state, action: PayloadAction<Message>) {
      const message = action.payload;
      const conversation = state.conversations[message.conversationId];
      
      if (conversation) {
        conversation.messages.push(message);
        conversation.lastActivity = new Date();
        state.lastUpdated[message.conversationId] = Date.now();
      }
    },

    // Clear optimistic updates older than 5 minutes
    cleanupOptimisticUpdates(state) {
      const fiveMinutesAgo = Date.now() - 5 * 60 * 1000;
      Object.keys(state.optimisticUpdates).forEach(key => {
        if (state.optimisticUpdates[key].timestamp < fiveMinutesAgo) {
          delete state.optimisticUpdates[key];
        }
      });
    }
  },
  extraReducers: (builder) => {
    // Handle fetch conversations lifecycle
    builder
      .addCase(fetchConversations.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchConversations.fulfilled, (state, action) => {
        state.loading = false;
        action.payload.forEach(conversation => {
          state.conversations[conversation.id] = conversation;
          state.lastUpdated[conversation.id] = Date.now();
        });
      })
      .addCase(fetchConversations.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as any;
      })

    // Handle send message lifecycle with optimistic updates
    builder
      .addCase(sendNewMessage.pending, (state, action) => {
        const { conversationId, content, optimisticId } = action.meta.arg;
        const conversation = state.conversations[conversationId];
        
        if (conversation) {
          const optimisticMessage: Message = {
            id: optimisticId as any,
            conversationId,
            content,
            direction: MessageDirection.OUTBOUND,
            timestamp: new Date(),
            metadata: { optimistic: true }
          } as Message;

          conversation.messages.push(optimisticMessage);
          state.optimisticUpdates[optimisticId] = {
            type: 'message',
            data: optimisticMessage,
            timestamp: Date.now()
          };
        }
      })
      .addCase(sendNewMessage.fulfilled, (state, action) => {
        const { message, optimisticId } = action.payload;
        const conversation = state.conversations[message.conversationId];
        
        if (conversation) {
          const optimisticIndex = conversation.messages.findIndex(
            m => m.id === optimisticId
          );
          if (optimisticIndex !== -1) {
            conversation.messages[optimisticIndex] = message;
          }
          delete state.optimisticUpdates[optimisticId];
          state.lastUpdated[message.conversationId] = Date.now();
        }
      })
      .addCase(sendNewMessage.rejected, (state, action: any) => {
        const { optimisticId } = action.meta.arg;
        const update = state.optimisticUpdates[optimisticId];
        
        if (update && update.type === 'message') {
          const conversation = state.conversations[update.data.conversationId];
          if (conversation) {
            conversation.messages = conversation.messages.filter(
              m => m.id !== optimisticId
            );
          }
          delete state.optimisticUpdates[optimisticId];
        }
        
        state.error = action.payload;
      })

    // Handle human takeover lifecycle
    builder
      .addCase(initiateHumanTakeover.fulfilled, (state, action) => {
        const conversation = action.payload;
        state.conversations[conversation.id] = conversation;
        state.lastUpdated[conversation.id] = Date.now();
      });
  }
});

// Export actions and reducer
export const {
  setActiveConversation,
  setSocketConnected,
  handleWebSocketMessage,
  cleanupOptimisticUpdates
} = conversationSlice.actions;

export default conversationSlice.reducer;