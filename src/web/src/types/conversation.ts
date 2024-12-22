/**
 * @fileoverview TypeScript type definitions for conversation-related components
 * Defines interfaces and types for SMS conversations, messages, and conversation management
 * @version 1.0.0
 */

// External imports
// crypto: latest
import { UUID } from 'crypto';

/**
 * Enum defining possible message directions in an SMS conversation
 * Used to track whether messages are incoming from leads or outgoing from the system/agents
 */
export enum MessageDirection {
  INBOUND = 'INBOUND',   // Messages received from leads
  OUTBOUND = 'OUTBOUND'  // Messages sent by system or agents
}

/**
 * Enum defining possible message delivery statuses
 * Tracks the lifecycle of a message from queuing to final delivery state
 */
export enum MessageStatus {
  QUEUED = 'QUEUED',         // Message is queued for sending
  SENT = 'SENT',            // Message has been sent to provider
  DELIVERED = 'DELIVERED',   // Message confirmed delivered to recipient
  FAILED = 'FAILED'         // Message failed to deliver
}

/**
 * Enum defining possible conversation states
 * Controls conversation flow and determines system behavior
 */
export enum ConversationStatus {
  ACTIVE = 'ACTIVE',               // Conversation is ongoing
  PAUSED = 'PAUSED',              // Temporarily paused
  CLOSED = 'CLOSED',              // Conversation has ended
  HUMAN_TAKEOVER = 'HUMAN_TAKEOVER' // Agent has taken control
}

/**
 * Interface defining the structure of an SMS message
 * Includes AI confidence scoring and metadata for advanced processing
 */
export interface Message {
  /** Unique identifier for the message */
  id: UUID;
  
  /** Reference to parent conversation */
  conversationId: UUID;
  
  /** Actual message content */
  content: string;
  
  /** Direction of message flow */
  direction: MessageDirection;
  
  /** Current delivery status */
  status: MessageStatus;
  
  /** AI confidence score for automated responses (0-1) */
  aiConfidence: number;
  
  /** Message timestamp */
  timestamp: Date;
  
  /** Additional metadata for message processing and tracking */
  metadata: Record<string, any>;
}

/**
 * Interface defining the structure of an SMS conversation
 * Supports both AI-driven and human agent interactions
 */
export interface Conversation {
  /** Unique identifier for the conversation */
  id: UUID;
  
  /** Reference to the associated lead */
  leadId: UUID;
  
  /** Reference to the originating form */
  formId: UUID;
  
  /** Current conversation status */
  status: ConversationStatus;
  
  /** Lead's phone number */
  phoneNumber: string;
  
  /** Currently assigned human agent, if any */
  assignedAgent: UUID | null;
  
  /** Timestamp of last message or status change */
  lastActivity: Date;
  
  /** Array of all messages in the conversation */
  messages: Message[];
  
  /** Additional conversation metadata */
  metadata: Record<string, any>;
  
  /** Flag indicating if AI assistance is enabled */
  aiEnabled: boolean;
  
  /** Conversation language code (e.g., 'en-US') */
  language: string;
  
  /** Array of conversation categorization tags */
  tags: string[];
}