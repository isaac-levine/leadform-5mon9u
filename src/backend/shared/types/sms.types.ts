/**
 * @fileoverview TypeScript type definitions for SMS and conversation related functionality
 * @version 1.0.0
 * 
 * This file defines the core types for the SMS messaging system including:
 * - Message and conversation data structures
 * - Provider-agnostic SMS integration
 * - AI-driven conversation management
 * - Human intervention support
 */

import { UUID } from 'crypto'; // Latest version

/**
 * Base interface providing common fields for all database entities
 */
export interface BaseEntity {
  id: UUID;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Enum defining possible message directions for SMS communication
 */
export enum MessageDirection {
  INBOUND = 'INBOUND',   // Messages received from leads
  OUTBOUND = 'OUTBOUND'  // Messages sent to leads
}

/**
 * Enum defining detailed message delivery statuses
 * Supports comprehensive tracking across different providers
 */
export enum MessageStatus {
  QUEUED = 'QUEUED',       // Message queued for sending
  SENT = 'SENT',          // Message sent to provider
  DELIVERED = 'DELIVERED', // Message delivered to recipient
  READ = 'READ',          // Message read by recipient (if supported by provider)
  FAILED = 'FAILED',      // Message failed to deliver
  BLOCKED = 'BLOCKED',    // Message blocked by carrier/provider
  EXPIRED = 'EXPIRED'     // Message expired before delivery
}

/**
 * Enum defining conversation states including AI and human handling phases
 */
export enum ConversationStatus {
  ACTIVE = 'ACTIVE',               // Ongoing conversation
  PAUSED = 'PAUSED',              // Temporarily paused
  CLOSED = 'CLOSED',              // Conversation ended
  HUMAN_TAKEOVER = 'HUMAN_TAKEOVER', // Human agent handling
  AI_PROCESSING = 'AI_PROCESSING',    // AI generating response
  WAITING_RESPONSE = 'WAITING_RESPONSE', // Awaiting lead response
  OPTED_OUT = 'OPTED_OUT'         // Lead opted out of messages
}

/**
 * Enum defining supported SMS providers for provider-agnostic implementation
 */
export enum SMSProvider {
  TWILIO = 'TWILIO',           // Twilio SMS provider
  MESSAGEBIRD = 'MESSAGEBIRD', // MessageBird SMS provider
  MOCK_PROVIDER = 'MOCK_PROVIDER' // Mock provider for testing
}

/**
 * Interface defining the structure of an SMS message with AI integration
 * Extends BaseEntity for common database fields
 */
export interface Message extends BaseEntity {
  id: UUID;
  conversationId: UUID;
  content: string;
  direction: MessageDirection;
  status: MessageStatus;
  aiConfidence: number;         // AI confidence score for generated responses
  providerMessageId: string;    // Provider-specific message identifier
  provider: SMSProvider;        // SMS provider used for this message
  metadata: Record<string, any>; // Additional provider-specific data
}

/**
 * Interface defining the structure of an SMS conversation
 * Supports both AI-driven and human agent interactions
 */
export interface Conversation extends BaseEntity {
  id: UUID;
  leadId: UUID;                  // Associated lead identifier
  status: ConversationStatus;
  phoneNumber: string;           // Lead's phone number
  assignedAgent: UUID | null;    // Human agent identifier if assigned
  lastActivity: Date;            // Timestamp of last message
  averageAiConfidence: number;   // Average AI confidence across messages
  isOptedOut: boolean;           // Whether lead has opted out
  metadata: Record<string, any>; // Additional conversation data
}