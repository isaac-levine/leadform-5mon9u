/**
 * @fileoverview Twilio SMS provider integration service with comprehensive reliability features
 * @version 1.0.0
 */

import { injectable } from 'inversify'; // ^6.0.1
import { Twilio, MessageInstance } from 'twilio'; // ^4.19.0
import CircuitBreaker from 'opossum'; // ^7.1.0
import { Counter, Histogram } from 'prom-client'; // ^14.2.0
import { Logger } from 'winston'; // ^3.11.0
import { RateLimiterRedis } from 'rate-limiter-flexible'; // ^4.1.0

import { Message, MessageStatus } from '../../../shared/types/sms.types';
import { MessageModel } from '../models/message.model';
import { config } from '../config';

/**
 * Interface for Twilio webhook payload
 */
interface WebhookData {
  MessageSid: string;
  MessageStatus: string;
  To: string;
  From: string;
  Timestamp: string;
  Signature: string;
}

/**
 * Interface for service health check response
 */
interface HealthStatus {
  healthy: boolean;
  details: {
    circuitBreaker: string;
    rateLimiter: string;
    twilioApi: string;
  };
  message: string;
}

/**
 * Enhanced Twilio service implementation with comprehensive reliability features
 */
@injectable()
export class TwilioService {
  private readonly client: Twilio;
  private readonly logger: Logger;
  private readonly phoneNumber: string;
  private readonly circuitBreaker: CircuitBreaker;
  private readonly rateLimiter: RateLimiterRedis;
  
  // Prometheus metrics
  private readonly messageCounter: Counter;
  private readonly messageLatency: Histogram;

  constructor() {
    // Initialize Twilio client with credentials from config
    const { accountSid, authToken, phoneNumber } = config.smsProviders.twilio;
    this.client = new Twilio(accountSid, authToken);
    this.phoneNumber = phoneNumber;

    // Initialize logger
    this.logger = new Logger({
      level: 'info',
      defaultMeta: { service: 'TwilioService' }
    });

    // Initialize circuit breaker
    this.circuitBreaker = new CircuitBreaker(
      async (message: Message) => this.sendMessageToTwilio(message),
      {
        timeout: config.smsProviders.twilio.timeout,
        errorThresholdPercentage: 50,
        resetTimeout: 30000,
        name: 'twilioCircuitBreaker'
      }
    );

    // Initialize rate limiter
    this.rateLimiter = new RateLimiterRedis({
      storeClient: redisClient,
      keyPrefix: config.rateLimit.keyPrefix,
      points: config.rateLimit.max,
      duration: config.rateLimit.window,
      blockDuration: config.rateLimit.blockDuration
    });

    // Initialize metrics
    this.messageCounter = new Counter({
      name: `${config.metrics.prefix}_messages_total`,
      help: 'Total messages processed by status',
      labelNames: ['status']
    });

    this.messageLatency = new Histogram({
      name: `${config.metrics.prefix}_message_latency_seconds`,
      help: 'Message processing latency in seconds',
      buckets: [0.1, 0.3, 0.5, 0.7, 1, 2, 5]
    });

    // Setup circuit breaker event handlers
    this.setupCircuitBreakerEvents();
  }

  /**
   * Sends an SMS message using Twilio with comprehensive error handling and monitoring
   * @param message Message to send
   * @returns Updated message with delivery status
   */
  public async sendMessage(message: Message): Promise<Message> {
    const timer = this.messageLatency.startTimer();

    try {
      // Check rate limits
      await this.rateLimiter.consume(message.id);

      // Validate message
      this.validateMessage(message);

      // Attempt to send message through circuit breaker
      const twilioResponse = await this.circuitBreaker.fire(message);

      // Update message status and metrics
      await MessageModel.updateStatus(message.id, MessageStatus.SENT);
      this.messageCounter.inc({ status: 'sent' });

      // Update message with provider details
      message.metadata.providerMessageId = twilioResponse.sid;
      message.metadata.providerResponse = twilioResponse;
      message.metadata.processingTime = timer();

      return message;

    } catch (error) {
      this.handleSendError(error, message);
      throw error;
    }
  }

  /**
   * Processes Twilio status callback webhooks
   * @param webhookData Webhook payload from Twilio
   */
  public async handleStatusWebhook(webhookData: WebhookData): Promise<void> {
    try {
      // Validate webhook signature
      this.validateWebhookSignature(webhookData);

      // Map Twilio status to internal status
      const status = this.mapTwilioStatus(webhookData.MessageStatus);

      // Update message status
      const message = await MessageModel.findOne({
        where: { 'metadata.providerMessageId': webhookData.MessageSid }
      });

      if (message) {
        await message.updateStatus(status);
        this.messageCounter.inc({ status });
      }

    } catch (error) {
      this.logger.error('Webhook processing error:', error);
      throw error;
    }
  }

  /**
   * Performs health check of the Twilio service
   * @returns Health status object
   */
  public async healthCheck(): Promise<HealthStatus> {
    try {
      // Check Twilio API connectivity
      await this.client.api.v2010.accounts(config.smsProviders.twilio.accountSid).fetch();

      return {
        healthy: true,
        details: {
          circuitBreaker: this.circuitBreaker.status,
          rateLimiter: 'healthy',
          twilioApi: 'connected'
        },
        message: 'Service is healthy'
      };

    } catch (error) {
      return {
        healthy: false,
        details: {
          circuitBreaker: this.circuitBreaker.status,
          rateLimiter: 'unknown',
          twilioApi: 'error'
        },
        message: `Health check failed: ${error.message}`
      };
    }
  }

  /**
   * Sends message directly to Twilio API
   * @private
   */
  private async sendMessageToTwilio(message: Message): Promise<MessageInstance> {
    return this.client.messages.create({
      body: message.content,
      to: message.metadata.recipient,
      from: this.phoneNumber,
      statusCallback: `${config.host}/webhooks/twilio/status`
    });
  }

  /**
   * Validates message before sending
   * @private
   */
  private validateMessage(message: Message): void {
    if (!message.content || message.content.length > 1600) {
      throw new Error('Invalid message content length');
    }
    if (!message.metadata.recipient?.match(/^\+[1-9]\d{1,14}$/)) {
      throw new Error('Invalid recipient phone number');
    }
  }

  /**
   * Maps Twilio status to internal message status
   * @private
   */
  private mapTwilioStatus(twilioStatus: string): MessageStatus {
    const statusMap: Record<string, MessageStatus> = {
      'queued': MessageStatus.QUEUED,
      'sent': MessageStatus.SENT,
      'delivered': MessageStatus.DELIVERED,
      'failed': MessageStatus.FAILED,
      'undelivered': MessageStatus.FAILED
    };
    return statusMap[twilioStatus.toLowerCase()] || MessageStatus.FAILED;
  }

  /**
   * Sets up circuit breaker event handlers
   * @private
   */
  private setupCircuitBreakerEvents(): void {
    this.circuitBreaker.on('open', () => {
      this.logger.warn('Circuit breaker opened');
    });

    this.circuitBreaker.on('halfOpen', () => {
      this.logger.info('Circuit breaker half-open');
    });

    this.circuitBreaker.on('close', () => {
      this.logger.info('Circuit breaker closed');
    });
  }

  /**
   * Handles errors during message sending
   * @private
   */
  private async handleSendError(error: any, message: Message): Promise<void> {
    this.logger.error('Message send error:', error);
    this.messageCounter.inc({ status: 'failed' });

    if (error.name === 'RateLimiterError') {
      await MessageModel.updateStatus(message.id, MessageStatus.RATE_LIMITED);
    } else {
      await MessageModel.updateStatus(message.id, MessageStatus.FAILED);
    }

    message.metadata.error = {
      code: error.code,
      message: error.message,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Validates Twilio webhook signature
   * @private
   */
  private validateWebhookSignature(webhookData: WebhookData): void {
    // Implement Twilio webhook signature validation
    // This is a placeholder for the actual implementation
    if (!webhookData.Signature) {
      throw new Error('Invalid webhook signature');
    }
  }
}

export default TwilioService;