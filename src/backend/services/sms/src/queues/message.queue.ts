/**
 * @fileoverview Enhanced message queue implementation for SMS processing with circuit breaking,
 * intelligent routing, and comprehensive monitoring capabilities.
 * @version 1.0.0
 */

import { injectable, inject } from 'inversify';
import Queue from 'bull'; // ^4.12.0
import Redis from 'ioredis'; // ^5.3.0
import CircuitBreaker from 'opossum'; // ^7.1.0
import { Counter, Gauge, Histogram } from 'prom-client'; // ^14.2.0
import { Message, MessageStatus } from '../../../shared/types/sms.types';

// Queue configuration constants
const QUEUE_NAME = 'sms-messages';
const MAX_RETRIES = 3;
const RETRY_DELAY = 60000; // 1 minute
const QUEUE_CONCURRENCY = 5;
const CIRCUIT_BREAKER_THRESHOLD = 0.5;
const HEALTH_CHECK_INTERVAL = 30000; // 30 seconds
const METRICS_PREFIX = 'sms_queue';
const PROVIDER_TIMEOUT = 5000; // 5 seconds

/**
 * Decorator for monitoring class methods
 */
function monitored() {
    return function (target: any) {
        return target;
    };
}

@injectable()
@monitored()
export class MessageQueue {
    private messageQueue: Queue.Queue;
    private redisClient: Redis.Redis;
    private twilioBreaker: CircuitBreaker;
    private messageBirdBreaker: CircuitBreaker;
    
    // Prometheus metrics
    private messageCounter: Counter;
    private queueLatency: Gauge;
    private processingTime: Histogram;
    private providerErrors: Counter;
    private queueSize: Gauge;

    constructor(
        @inject('TwilioService') private twilioService: any,
        @inject('MessageBirdService') private messageBirdService: any,
        @inject('RedisConfig') private redisConfig: any,
        @inject('QueueConfig') private queueConfig: any
    ) {
        this.initializeRedis();
        this.initializeQueue();
        this.initializeCircuitBreakers();
        this.initializeMetrics();
        this.setupQueueListeners();
        this.startHealthCheck();
    }

    /**
     * Initialize Redis client with cluster support
     */
    private initializeRedis(): void {
        this.redisClient = new Redis.Cluster(this.redisConfig.nodes, {
            redisOptions: {
                enableReadyCheck: true,
                maxRetriesPerRequest: 3,
            },
            ...this.redisConfig.options
        });
    }

    /**
     * Initialize Bull queue with advanced configuration
     */
    private initializeQueue(): void {
        this.messageQueue = new Queue(QUEUE_NAME, {
            redis: this.redisClient,
            defaultJobOptions: {
                attempts: MAX_RETRIES,
                backoff: {
                    type: 'exponential',
                    delay: RETRY_DELAY
                },
                removeOnComplete: true,
                removeOnFail: false
            }
        });

        this.messageQueue.process(QUEUE_CONCURRENCY, this.processMessage.bind(this));
    }

    /**
     * Initialize circuit breakers for SMS providers
     */
    private initializeCircuitBreakers(): void {
        const breakerOptions = {
            timeout: PROVIDER_TIMEOUT,
            errorThresholdPercentage: CIRCUIT_BREAKER_THRESHOLD * 100,
            resetTimeout: 30000
        };

        this.twilioBreaker = new CircuitBreaker(
            this.twilioService.sendMessage.bind(this.twilioService),
            breakerOptions
        );

        this.messageBirdBreaker = new CircuitBreaker(
            this.messageBirdService.sendMessage.bind(this.messageBirdService),
            breakerOptions
        );
    }

    /**
     * Initialize Prometheus metrics
     */
    private initializeMetrics(): void {
        this.messageCounter = new Counter({
            name: `${METRICS_PREFIX}_messages_total`,
            help: 'Total number of messages processed'
        });

        this.queueLatency = new Gauge({
            name: `${METRICS_PREFIX}_latency_seconds`,
            help: 'Message queue latency in seconds'
        });

        this.processingTime = new Histogram({
            name: `${METRICS_PREFIX}_processing_duration_seconds`,
            help: 'Message processing duration in seconds'
        });

        this.providerErrors = new Counter({
            name: `${METRICS_PREFIX}_provider_errors_total`,
            help: 'Total number of provider errors',
            labelNames: ['provider']
        });

        this.queueSize = new Gauge({
            name: `${METRICS_PREFIX}_size`,
            help: 'Current size of the message queue'
        });
    }

    /**
     * Set up queue event listeners for monitoring
     */
    private setupQueueListeners(): void {
        this.messageQueue.on('error', (error) => {
            console.error('Queue error:', error);
            // Increment error metrics
            this.providerErrors.inc({ type: 'queue' });
        });

        this.messageQueue.on('waiting', (jobId) => {
            this.queueSize.inc();
        });

        this.messageQueue.on('completed', (job) => {
            this.queueSize.dec();
        });
    }

    /**
     * Start periodic health check
     */
    private startHealthCheck(): void {
        setInterval(async () => {
            const health = await this.getQueueHealth();
            this.queueLatency.set(health.latency);
        }, HEALTH_CHECK_INTERVAL);
    }

    /**
     * Add message to queue with validation and monitoring
     * @param message Message to be queued
     */
    public async addToQueue(message: Message): Promise<void> {
        const startTime = Date.now();

        try {
            // Validate message
            if (!message.content || !message.id) {
                throw new Error('Invalid message format');
            }

            // Add to queue with metadata
            await this.messageQueue.add(
                {
                    ...message,
                    status: MessageStatus.QUEUED,
                    addedAt: startTime
                },
                {
                    priority: this.calculatePriority(message),
                    jobId: message.id.toString()
                }
            );

            // Update metrics
            this.messageCounter.inc();
            this.queueLatency.set((Date.now() - startTime) / 1000);

        } catch (error) {
            console.error('Error adding message to queue:', error);
            throw error;
        }
    }

    /**
     * Process message with circuit breaking and monitoring
     * @param job Queue job containing message
     */
    private async processMessage(job: Queue.Job): Promise<void> {
        const processingTimer = this.processingTime.startTimer();
        const message = job.data as Message;

        try {
            // Update message status
            message.status = MessageStatus.PROCESSING;

            // Select provider based on circuit breaker status
            const provider = this.selectProvider();
            const breaker = provider === 'twilio' ? this.twilioBreaker : this.messageBirdBreaker;

            // Attempt message delivery
            await breaker.fire(message);

            // Update message status on success
            message.status = MessageStatus.SENT;
            processingTimer({ success: 'true' });

        } catch (error) {
            console.error('Error processing message:', error);
            
            // Handle failure
            message.status = MessageStatus.FAILED;
            message.lastError = error.message;
            
            // Update metrics
            this.providerErrors.inc({ provider: message.provider });
            processingTimer({ success: 'false' });

            // Throw error for retry handling
            throw error;
        }
    }

    /**
     * Select provider based on circuit breaker status and load
     */
    private selectProvider(): 'twilio' | 'messagebird' {
        const twilioStatus = this.twilioBreaker.status;
        const messageBirdStatus = this.messageBirdBreaker.status;

        if (twilioStatus.isOpen && messageBirdStatus.isOpen) {
            throw new Error('All providers are unavailable');
        }

        return twilioStatus.isClosed ? 'twilio' : 'messagebird';
    }

    /**
     * Calculate message priority based on content and metadata
     */
    private calculatePriority(message: Message): number {
        // Priority calculation logic
        return 1;
    }

    /**
     * Get queue health metrics
     */
    public async getQueueHealth(): Promise<{ size: number; latency: number }> {
        const size = await this.messageQueue.count();
        const waiting = await this.messageQueue.getWaiting();
        const latency = waiting.length > 0 ? 
            Date.now() - waiting[0].timestamp : 0;

        return { size, latency };
    }

    /**
     * Get queue metrics for monitoring
     */
    public getQueueMetrics(): Record<string, any> {
        return {
            messageCount: this.messageCounter.get(),
            queueLatency: this.queueLatency.get(),
            processingTime: this.processingTime.get(),
            providerErrors: this.providerErrors.get(),
            queueSize: this.queueSize.get()
        };
    }
}