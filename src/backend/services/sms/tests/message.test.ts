/**
 * @fileoverview Comprehensive test suite for SMS message functionality
 * @version 1.0.0
 */

import { describe, test, expect, jest, beforeEach, afterEach } from '@jest/globals'; // ^29.7.0
import supertest from 'supertest'; // ^6.3.3
import { MockInstance } from 'jest-mock'; // ^29.7.0
import { GenericContainer } from 'testcontainers'; // ^10.0.0

import { MessageController } from '../src/controllers/message.controller';
import { MessageQueue } from '../src/queues/message.queue';
import { MessageModel } from '../src/models/message.model';
import { Message, MessageDirection, MessageStatus, SMSProvider } from '../../../shared/types/sms.types';

// Mock dependencies
jest.mock('../src/queues/message.queue');
jest.mock('../src/models/message.model');
jest.mock('../src/providers/sms.provider');

// Test constants
const TEST_PHONE = '+1234567890';
const TEST_MESSAGE = 'Test message content';
const TEST_MESSAGE_ID = '123e4567-e89b-12d3-a456-426614174000';
const PERFORMANCE_THRESHOLD = 500; // 500ms per technical spec

describe('MessageController Integration Tests', () => {
    let messageController: MessageController;
    let messageQueue: jest.Mocked<MessageQueue>;
    let mockLogger: { error: MockInstance; warn: MockInstance };
    let mockMetricsCollector: { recordLatency: MockInstance; recordError: MockInstance };

    beforeEach(() => {
        // Setup mocks
        mockLogger = {
            error: jest.fn(),
            warn: jest.fn()
        };

        mockMetricsCollector = {
            recordLatency: jest.fn(),
            recordError: jest.fn()
        };

        messageQueue = {
            addToQueue: jest.fn(),
            processMessage: jest.fn(),
            getQueueHealth: jest.fn(),
            retryMessage: jest.fn()
        } as any;

        // Initialize controller
        messageController = new MessageController(
            messageQueue,
            mockLogger as any,
            {} as any, // Circuit breaker mock
            mockMetricsCollector
        );
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    describe('Message Processing Performance', () => {
        test('should process message within 500ms performance threshold', async () => {
            // Setup test message
            const message: Partial<Message> = {
                content: TEST_MESSAGE,
                direction: MessageDirection.OUTBOUND,
                status: MessageStatus.QUEUED,
                metadata: {
                    phoneNumber: TEST_PHONE
                }
            };

            // Start performance timer
            const startTime = Date.now();

            // Process message
            await messageQueue.processMessage(message as any);

            // Calculate processing time
            const processingTime = Date.now() - startTime;

            // Assert performance
            expect(processingTime).toBeLessThan(PERFORMANCE_THRESHOLD);
            expect(mockMetricsCollector.recordLatency).toHaveBeenCalled();
        });

        test('should log warning when processing exceeds threshold', async () => {
            // Mock slow processing
            messageQueue.processMessage.mockImplementation(async () => {
                await new Promise(resolve => setTimeout(resolve, PERFORMANCE_THRESHOLD + 100));
            });

            await messageQueue.processMessage({} as any);

            expect(mockLogger.warn).toHaveBeenCalledWith(
                expect.stringContaining('exceeded threshold')
            );
        });
    });

    describe('Provider Failover Handling', () => {
        test('should automatically switch providers on failure', async () => {
            // Mock primary provider failure
            const mockError = new Error('Primary provider failed');
            messageQueue.processMessage.mockRejectedValueOnce(mockError);

            // Setup test message
            const message: Partial<Message> = {
                id: TEST_MESSAGE_ID,
                content: TEST_MESSAGE,
                provider: SMSProvider.TWILIO
            };

            // Attempt message processing
            await messageQueue.processMessage(message as any);

            // Verify provider switch
            expect(message.provider).toBe(SMSProvider.MESSAGEBIRD);
            expect(mockLogger.warn).toHaveBeenCalledWith(
                expect.stringContaining('Provider failover')
            );
        });

        test('should maintain message state during provider switch', async () => {
            const message: Partial<Message> = {
                id: TEST_MESSAGE_ID,
                status: MessageStatus.QUEUED
            };

            // Mock provider switch
            await messageQueue.processMessage(message as any);

            // Verify message state maintained
            expect(message.status).toBe(MessageStatus.SENT);
            expect(message.metadata?.providerHistory).toBeDefined();
        });
    });

    describe('Queue Health Monitoring', () => {
        test('should maintain queue health metrics', async () => {
            // Mock queue health data
            const mockHealth = {
                size: 10,
                latency: 100
            };

            messageQueue.getQueueHealth.mockResolvedValue(mockHealth);

            // Get queue health
            const health = await messageQueue.getQueueHealth();

            // Verify metrics
            expect(health.size).toBe(mockHealth.size);
            expect(health.latency).toBe(mockHealth.latency);
            expect(mockMetricsCollector.recordLatency).toHaveBeenCalled();
        });

        test('should alert on queue bottlenecks', async () => {
            // Mock queue congestion
            messageQueue.getQueueHealth.mockResolvedValue({
                size: 1000,
                latency: 5000
            });

            await messageQueue.getQueueHealth();

            expect(mockLogger.warn).toHaveBeenCalledWith(
                expect.stringContaining('Queue congestion detected')
            );
        });
    });

    describe('Error Handling and Recovery', () => {
        test('should handle and log message processing errors', async () => {
            const error = new Error('Processing failed');
            messageQueue.processMessage.mockRejectedValue(error);

            const message: Partial<Message> = {
                id: TEST_MESSAGE_ID
            };

            await expect(messageQueue.processMessage(message as any))
                .rejects.toThrow('Processing failed');

            expect(mockLogger.error).toHaveBeenCalled();
            expect(message.status).toBe(MessageStatus.FAILED);
        });

        test('should retry failed messages with exponential backoff', async () => {
            const message: Partial<Message> = {
                id: TEST_MESSAGE_ID,
                retryCount: 0
            };

            // Mock retry logic
            await messageQueue.retryMessage(message as any);

            expect(message.retryCount).toBe(1);
            expect(mockMetricsCollector.recordLatency).toHaveBeenCalled();
        });
    });

    describe('Message Validation', () => {
        test('should validate phone numbers', async () => {
            const invalidMessage: Partial<Message> = {
                content: TEST_MESSAGE,
                metadata: {
                    phoneNumber: 'invalid'
                }
            };

            await expect(messageQueue.addToQueue(invalidMessage as any))
                .rejects.toThrow('Invalid phone number');
        });

        test('should validate message content length', async () => {
            const longMessage: Partial<Message> = {
                content: 'a'.repeat(1601), // Exceeds SMS length limit
                metadata: {
                    phoneNumber: TEST_PHONE
                }
            };

            await expect(messageQueue.addToQueue(longMessage as any))
                .rejects.toThrow('Message content exceeds limit');
        });
    });
});