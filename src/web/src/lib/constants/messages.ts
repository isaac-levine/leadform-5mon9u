/**
 * @fileoverview Constants and configuration values for message handling, conversation states, and UI text
 * Provides standardized labels, colors, and thresholds for the messaging interface
 * @version 1.0.0
 */

import { 
  MessageDirection, 
  MessageStatus, 
  ConversationStatus 
} from '../types/conversation';

/**
 * Maximum length for SMS messages to ensure provider compatibility
 * Standard SMS length limit with buffer for encoding
 */
export const MESSAGE_MAX_LENGTH = 2000;

/**
 * Delay in milliseconds for typing indicator
 * Provides natural conversation flow in UI
 */
export const MESSAGE_TYPING_DELAY = 1000;

/**
 * Number of retry attempts for failed message delivery
 * Balances delivery reliability with system resources
 */
export const MESSAGE_RETRY_ATTEMPTS = 3;

/**
 * Human-readable labels for message delivery states
 * WCAG 2.1 AA compliant for accessibility
 */
export const MESSAGE_STATUS_LABELS: Record<MessageStatus, string> = {
  [MessageStatus.QUEUED]: 'Queued for Delivery',
  [MessageStatus.SENT]: 'Message Sent',
  [MessageStatus.DELIVERED]: 'Successfully Delivered',
  [MessageStatus.FAILED]: 'Delivery Failed'
};

/**
 * Clear, accessible labels for conversation states
 * Emphasizes human takeover scenarios for clarity
 */
export const CONVERSATION_STATUS_LABELS: Record<ConversationStatus, string> = {
  [ConversationStatus.ACTIVE]: 'Active Conversation',
  [ConversationStatus.PAUSED]: 'Conversation Paused',
  [ConversationStatus.CLOSED]: 'Conversation Ended',
  [ConversationStatus.HUMAN_TAKEOVER]: 'Agent Assistance Active'
};

/**
 * Directional labels for message flow visualization
 * Used in UI to distinguish between incoming and outgoing messages
 */
export const MESSAGE_DIRECTION_LABELS: Record<MessageDirection, string> = {
  [MessageDirection.INBOUND]: 'Received',
  [MessageDirection.OUTBOUND]: 'Sent'
};

/**
 * WCAG AA compliant color codes for message status visualization
 * Supports both light and dark mode with sufficient contrast ratios
 */
export const MESSAGE_STATUS_COLORS: Record<MessageStatus, string> = {
  [MessageStatus.QUEUED]: '#6B7280',     // Gray-500
  [MessageStatus.SENT]: '#3B82F6',       // Blue-500
  [MessageStatus.DELIVERED]: '#10B981',   // Green-500
  [MessageStatus.FAILED]: '#EF4444'      // Red-500
};

/**
 * Accessible color codes for conversation states
 * Distinct colors for clear status identification
 */
export const CONVERSATION_STATUS_COLORS: Record<ConversationStatus, string> = {
  [ConversationStatus.ACTIVE]: '#10B981',    // Green-500
  [ConversationStatus.PAUSED]: '#F59E0B',    // Yellow-500
  [ConversationStatus.CLOSED]: '#6B7280',    // Gray-500
  [ConversationStatus.HUMAN_TAKEOVER]: '#3B82F6'  // Blue-500
};

/**
 * Configurable thresholds for AI response confidence levels
 * Used to determine routing behavior and visual indicators
 */
export const AI_CONFIDENCE_THRESHOLDS = {
  /** High confidence threshold - AI can respond automatically */
  HIGH: 0.85,
  
  /** Medium confidence threshold - AI can suggest responses */
  MEDIUM: 0.70,
  
  /** Low confidence threshold - Requires human review */
  LOW: 0.50
} as const;