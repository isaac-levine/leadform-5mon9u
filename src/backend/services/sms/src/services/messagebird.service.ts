/**
 * @fileoverview MessageBird service implementation for SMS message delivery and tracking
 * @version 1.0.0
 */

import messagebird from 'messagebird'; // v3.0.0
import { StatusCodes } from 'http-status-codes'; // v2.2.0
import { injectable } from 'inversify'; // v6.0.0
import { Message, MessageStatus } from '../../../shared/types/sms.types';
import { MessageModel } from '../models/message.model';
import { Logger } from '../../../shared/utils/logger';
import { createError } from '../../../shared/utils/error-handler';
import { SMS_CONFIG, VALIDATION_RULES } from '../../../shared/constants';

// Constants for MessageBird service configuration
const MESSAGEBIRD_TIMEOUT = 30000; // 30 seconds
const MAX_RETRIES = 3;
const RETRY_DELAY = 1000; // 1 second
const MAX_MESSAGE_LENGTH = 1600;
const MIN_MESSAGE_LENGTH = 1;

/**
 * MessageBird service implementation for handling SMS operations
 * Includes retry logic, validation, and comprehensive tracking
 */
@injectable()
export class MessageBirdService {
  private client: messagebird.Client;
  private logger: Logger;
  private readonly maxRetries: number;
  private readonly retryDelay: number;
  private readonly phoneNumberValidator: RegExp;

  /**
   * Initializes MessageBird service with configuration
   */
  constructor(
    apiKey: string,
    maxRetries: number = MAX_RETRIES,
    retryDelay: number = RETRY_DELAY
  ) {
    if (!apiKey) {
      throw createError(
        'MessageBird API key is required',
        StatusCodes.INTERNAL_SERVER_ERROR,
        'INVALID_CONFIG'
      );
    }

    this.client = messagebird(apiKey, {
      timeout: MESSAGEBIRD_TIMEOUT
    });

    this.logger = new Logger('MessageBirdService', 'sms-service');
    this.maxRetries = maxRetries;
    this.retryDelay = retryDelay;
    this.phoneNumberValidator = VALIDATION_RULES.PHONE_REGEX;

    this.logger.info('MessageBird service initialized', {
      maxRetries,
      retryDelay,
      timeout: MESSAGEBIRD_TIMEOUT
    });
  }

  /**
   * Sends SMS message with retry logic and comprehensive tracking
   */
  public async sendMessage(
    message: Message,
    recipientNumber: string,
    senderNumber: string
  ): Promise<Message> {
    // Validate message content
    if (!this.validateMessageContent(message.content)) {
      throw createError(
        'Invalid message content',
        StatusCodes.BAD_REQUEST,
        'INVALID_MESSAGE'
      );
    }

    // Validate phone numbers
    if (!this.validatePhoneNumber(recipientNumber) || !this.validatePhoneNumber(senderNumber)) {
      throw createError(
        'Invalid phone number format',
        StatusCodes.BAD_REQUEST,
        'INVALID_PHONE_NUMBER'
      );
    }

    let attempts = 0;
    let lastError: Error | null = null;

    while (attempts < this.maxRetries) {
      try {
        const messagebirdResponse = await this.client.messages.create({
          originator: senderNumber,
          recipients: [recipientNumber],
          body: message.content,
          reportUrl: process.env.MESSAGEBIRD_WEBHOOK_URL,
          reference: message.id.toString()
        });

        // Update message with provider details
        await MessageModel.updateStatus(message.id, MessageStatus.SENT);
        message.status = MessageStatus.SENT;
        message.metadata = {
          ...message.metadata,
          providerId: messagebirdResponse.id,
          deliveryStatus: messagebirdResponse.status,
          sentAt: new Date().toISOString(),
          attempts: attempts + 1
        };

        this.logger.info('Message sent successfully', {
          messageId: message.id,
          providerId: messagebirdResponse.id,
          attempts: attempts + 1
        });

        return message;

      } catch (error) {
        lastError = error as Error;
        attempts++;

        this.logger.warn('Message send attempt failed', {
          messageId: message.id,
          attempt: attempts,
          error: lastError.message
        });

        if (attempts < this.maxRetries) {
          await new Promise(resolve => setTimeout(resolve, this.retryDelay));
        }
      }
    }

    // All retries failed
    await MessageModel.updateStatus(message.id, MessageStatus.FAILED);
    message.status = MessageStatus.FAILED;
    message.metadata = {
      ...message.metadata,
      lastError: lastError?.message,
      failedAt: new Date().toISOString(),
      attempts
    };

    this.logger.error('Message sending failed after retries', lastError as Error, {
      messageId: message.id,
      attempts
    });

    throw createError(
      'Failed to send message after multiple attempts',
      StatusCodes.SERVICE_UNAVAILABLE,
      'SENDING_FAILED'
    );
  }

  /**
   * Handles delivery status updates from MessageBird webhooks
   */
  public async handleDeliveryReport(
    messageId: string,
    status: string,
    metadata: Record<string, any>
  ): Promise<void> {
    try {
      const message = await MessageModel.findById(messageId);
      if (!message) {
        throw createError(
          'Message not found',
          StatusCodes.NOT_FOUND,
          'MESSAGE_NOT_FOUND'
        );
      }

      // Map MessageBird status to internal status
      const internalStatus = this.mapMessageBirdStatus(status);
      await message.updateStatus(internalStatus);

      this.logger.info('Delivery status updated', {
        messageId,
        status: internalStatus,
        metadata
      });

    } catch (error) {
      this.logger.error('Failed to process delivery report', error as Error, {
        messageId,
        status,
        metadata
      });
      throw error;
    }
  }

  /**
   * Validates phone number format
   */
  private validatePhoneNumber(phoneNumber: string): boolean {
    return this.phoneNumberValidator.test(phoneNumber);
  }

  /**
   * Validates message content length and format
   */
  private validateMessageContent(content: string): boolean {
    return content.length >= MIN_MESSAGE_LENGTH && 
           content.length <= MAX_MESSAGE_LENGTH;
  }

  /**
   * Maps MessageBird status to internal message status
   */
  private mapMessageBirdStatus(messagebirdStatus: string): MessageStatus {
    const statusMap: Record<string, MessageStatus> = {
      'delivered': MessageStatus.DELIVERED,
      'delivery_failed': MessageStatus.FAILED,
      'sent': MessageStatus.SENT,
      'buffered': MessageStatus.QUEUED,
      'expired': MessageStatus.FAILED
    };

    return statusMap[messagebirdStatus] || MessageStatus.FAILED;
  }
}