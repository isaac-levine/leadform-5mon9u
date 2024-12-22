/**
 * @fileoverview Enhanced message controller for SMS operations with performance monitoring,
 * validation, and intelligent routing capabilities.
 * @version 1.0.0
 */

import { Request, Response } from 'express'; // ^4.18.0
import { injectable } from 'tsyringe'; // ^4.8.0
import { Logger } from 'winston'; // ^3.11.0
import { CircuitBreaker } from 'opossum'; // ^6.0.0
import { parsePhoneNumber, PhoneNumber } from 'libphonenumber-js'; // ^1.10.0

import { MessageModel } from '../models/message.model';
import { Message, MessageDirection, MessageStatus } from '../../../shared/types/sms.types';
import { MessageQueue } from '../queues/message.queue';

// Performance thresholds
const RESPONSE_TIME_THRESHOLD = 500; // 500ms per technical spec
const AI_CONFIDENCE_THRESHOLD = 0.8;
const RATE_LIMIT_WINDOW = 3600000; // 1 hour
const MAX_MESSAGES_PER_HOUR = 100;

/**
 * Decorator for performance monitoring
 */
function monitor() {
    return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
        const originalMethod = descriptor.value;
        descriptor.value = async function (...args: any[]) {
            const start = Date.now();
            try {
                const result = await originalMethod.apply(this, args);
                const duration = Date.now() - start;
                this.metricsCollector.recordLatency(propertyKey, duration);
                return result;
            } catch (error) {
                this.metricsCollector.recordError(propertyKey);
                throw error;
            }
        };
        return descriptor;
    };
}

@injectable()
export class MessageController {
    private rateLimitCache: Map<string, number> = new Map();

    constructor(
        private messageQueue: MessageQueue,
        private logger: Logger,
        private circuitBreaker: CircuitBreaker,
        private metricsCollector: any
    ) {
        this.initializeCircuitBreaker();
    }

    /**
     * Initialize circuit breaker for SMS operations
     */
    private initializeCircuitBreaker(): void {
        this.circuitBreaker.fallback(async () => {
            this.logger.warn('Circuit breaker fallback activated');
            return { status: 'degraded', message: 'Service temporarily degraded' };
        });

        this.circuitBreaker.on('success', () => {
            this.metricsCollector.recordSuccess('sms_operation');
        });

        this.circuitBreaker.on('failure', () => {
            this.metricsCollector.recordFailure('sms_operation');
        });
    }

    /**
     * Validates phone number format and messaging regulations
     */
    private validatePhoneNumber(phoneNumber: string): PhoneNumber {
        try {
            const parsedNumber = parsePhoneNumber(phoneNumber);
            if (!parsedNumber?.isValid()) {
                throw new Error('Invalid phone number format');
            }
            return parsedNumber;
        } catch (error) {
            this.logger.error('Phone number validation failed:', error);
            throw new Error('Invalid phone number');
        }
    }

    /**
     * Enforces rate limiting for message sending
     */
    private checkRateLimit(phoneNumber: string): void {
        const currentCount = this.rateLimitCache.get(phoneNumber) || 0;
        if (currentCount >= MAX_MESSAGES_PER_HOUR) {
            throw new Error('Rate limit exceeded');
        }
        this.rateLimitCache.set(phoneNumber, currentCount + 1);
    }

    /**
     * Sends a new SMS message with validation and monitoring
     */
    @monitor()
    public async sendMessage(req: Request, res: Response): Promise<Response> {
        const startTime = Date.now();

        try {
            const { phoneNumber, content, metadata = {} } = req.body;

            // Validate request
            if (!phoneNumber || !content) {
                return res.status(400).json({
                    error: 'Missing required fields'
                });
            }

            // Validate phone number
            const parsedNumber = this.validatePhoneNumber(phoneNumber);
            
            // Check rate limits
            this.checkRateLimit(parsedNumber.number);

            // Create message
            const message: Partial<Message> = {
                content,
                direction: MessageDirection.OUTBOUND,
                status: MessageStatus.QUEUED,
                metadata: {
                    ...metadata,
                    phoneNumber: parsedNumber.number,
                    region: parsedNumber.country,
                    timestamp: new Date().toISOString()
                }
            };

            // Add to queue with monitoring
            await this.messageQueue.addToQueue(message as Message);

            // Check performance threshold
            const duration = Date.now() - startTime;
            if (duration > RESPONSE_TIME_THRESHOLD) {
                this.logger.warn(`Message processing exceeded threshold: ${duration}ms`);
            }

            return res.status(202).json({
                status: 'queued',
                messageId: message.id,
                processingTime: duration
            });

        } catch (error) {
            this.logger.error('Error sending message:', error);
            return res.status(500).json({
                error: 'Failed to send message',
                details: error.message
            });
        }
    }

    /**
     * Retrieves message status with enhanced metrics
     */
    @monitor()
    public async getMessageStatus(req: Request, res: Response): Promise<Response> {
        try {
            const { messageId } = req.params;
            const message = await MessageModel.findByPk(messageId);

            if (!message) {
                return res.status(404).json({
                    error: 'Message not found'
                });
            }

            return res.status(200).json({
                ...message.toJSON(),
                metrics: {
                    processingTime: message.metadata.processingMetrics?.duration,
                    aiConfidence: message.aiConfidence,
                    deliveryAttempts: message.metadata.deliveryAttempts
                }
            });

        } catch (error) {
            this.logger.error('Error retrieving message status:', error);
            return res.status(500).json({
                error: 'Failed to retrieve message status'
            });
        }
    }

    /**
     * Updates message status with validation and tracking
     */
    @monitor()
    public async updateMessageStatus(req: Request, res: Response): Promise<Response> {
        try {
            const { messageId } = req.params;
            const { status } = req.body;

            const message = await MessageModel.findByPk(messageId);
            if (!message) {
                return res.status(404).json({
                    error: 'Message not found'
                });
            }

            await message.updateStatus(status);

            return res.status(200).json({
                status: 'updated',
                message: message.toJSON()
            });

        } catch (error) {
            this.logger.error('Error updating message status:', error);
            return res.status(500).json({
                error: 'Failed to update message status'
            });
        }
    }

    /**
     * Updates AI confidence score with validation
     */
    @monitor()
    public async updateAIConfidence(req: Request, res: Response): Promise<Response> {
        try {
            const { messageId } = req.params;
            const { confidence } = req.body;

            const message = await MessageModel.findByPk(messageId);
            if (!message) {
                return res.status(404).json({
                    error: 'Message not found'
                });
            }

            await message.updateAIConfidence(confidence);

            // Track low confidence scores
            if (confidence < AI_CONFIDENCE_THRESHOLD) {
                this.logger.warn(`Low AI confidence for message ${messageId}: ${confidence}`);
                this.metricsCollector.recordLowConfidence();
            }

            return res.status(200).json({
                status: 'updated',
                confidence,
                message: message.toJSON()
            });

        } catch (error) {
            this.logger.error('Error updating AI confidence:', error);
            return res.status(500).json({
                error: 'Failed to update AI confidence'
            });
        }
    }

    /**
     * Retrieves queue health metrics
     */
    @monitor()
    public async getQueueHealth(req: Request, res: Response): Promise<Response> {
        try {
            const health = await this.messageQueue.getQueueHealth();
            const metrics = this.messageQueue.getQueueMetrics();

            return res.status(200).json({
                status: 'healthy',
                health,
                metrics,
                timestamp: new Date().toISOString()
            });

        } catch (error) {
            this.logger.error('Error retrieving queue health:', error);
            return res.status(500).json({
                error: 'Failed to retrieve queue health'
            });
        }
    }
}

export default MessageController;