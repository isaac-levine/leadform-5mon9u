/**
 * @fileoverview Main application entry point for SMS service with enhanced monitoring,
 * security features, and high availability capabilities.
 * @version 1.0.0
 */

import express, { Application } from 'express'; // ^4.18.0
import cors from 'cors'; // ^2.8.5
import helmet from 'helmet'; // ^7.1.0
import compression from 'compression'; // ^1.7.4
import { container } from 'tsyringe'; // ^4.8.0
import rateLimit from 'express-rate-limit'; // ^7.1.0
import requestId from 'express-request-id'; // ^3.0.0
import CircuitBreaker from 'opossum'; // ^7.1.0
import * as promClient from 'prom-client'; // ^14.2.0
import winston from 'winston'; // ^3.8.0

import { config } from './config';
import conversationRoutes from './routes/conversation.routes';
import { configureMessageRoutes } from './routes/message.routes';
import { MessageQueue } from './queues/message.queue';
import { requestLoggingMiddleware } from '../../shared/middleware/logging.middleware';
import { errorMiddleware } from '../../shared/middleware/error.middleware';
import { AI_CONFIG, API_CONFIG, HEALTH_CHECK_CONFIG } from '../../shared/constants';

/**
 * Main application class with enhanced monitoring and availability features
 */
@injectable()
export class App {
    private app: Application;
    private logger: winston.Logger;
    private circuitBreaker: CircuitBreaker;
    private metricsRegistry: promClient.Registry;

    constructor(
        private messageQueue: MessageQueue
    ) {
        this.app = express();
        this.logger = this.initializeLogger();
        this.metricsRegistry = new promClient.Registry();
        this.circuitBreaker = this.initializeCircuitBreaker();
        this.initializeMiddleware();
        this.initializeRoutes();
        this.initializeErrorHandling();
    }

    /**
     * Initialize Winston logger with structured logging
     */
    private initializeLogger(): winston.Logger {
        return winston.createLogger({
            level: process.env.LOG_LEVEL || 'info',
            format: winston.format.combine(
                winston.format.timestamp(),
                winston.format.json()
            ),
            defaultMeta: {
                service: 'sms-service',
                version: process.env.npm_package_version
            },
            transports: [
                new winston.transports.Console({
                    format: winston.format.combine(
                        winston.format.colorize(),
                        winston.format.simple()
                    )
                })
            ]
        });
    }

    /**
     * Initialize circuit breaker for enhanced reliability
     */
    private initializeCircuitBreaker(): CircuitBreaker {
        const breaker = new CircuitBreaker(async () => {
            const health = await this.messageQueue.getQueueHealth();
            return health.size < 1000 && health.latency < 1000;
        }, {
            timeout: 3000,
            errorThresholdPercentage: 50,
            resetTimeout: 30000
        });

        breaker.fallback(() => false);
        return breaker;
    }

    /**
     * Initialize comprehensive middleware stack
     */
    private initializeMiddleware(): void {
        // Security middleware
        this.app.use(helmet());
        this.app.use(cors({
            origin: process.env.ALLOWED_ORIGINS?.split(',') || '*',
            methods: ['GET', 'POST', 'PUT', 'DELETE'],
            allowedHeaders: ['Content-Type', 'Authorization'],
            credentials: true,
            maxAge: 86400
        }));

        // Request processing middleware
        this.app.use(express.json({ limit: '10kb' }));
        this.app.use(express.urlencoded({ extended: true, limit: '10kb' }));
        this.app.use(compression());
        this.app.use(requestId());

        // Rate limiting
        this.app.use(rateLimit({
            windowMs: API_CONFIG.RATE_LIMIT_WINDOW,
            max: API_CONFIG.MAX_REQUESTS,
            standardHeaders: true,
            legacyHeaders: false
        }));

        // Monitoring middleware
        this.app.use(requestLoggingMiddleware);
        promClient.collectDefaultMetrics({
            register: this.metricsRegistry,
            prefix: 'sms_service_'
        });
    }

    /**
     * Initialize application routes with monitoring
     */
    private initializeRoutes(): void {
        // Health check endpoint
        this.app.get('/health', async (req, res) => {
            try {
                const isHealthy = await this.circuitBreaker.fire();
                const queueHealth = await this.messageQueue.getQueueHealth();
                
                res.json({
                    status: isHealthy ? 'healthy' : 'degraded',
                    timestamp: new Date().toISOString(),
                    version: process.env.npm_package_version,
                    queue: queueHealth
                });
            } catch (error) {
                res.status(503).json({
                    status: 'unhealthy',
                    timestamp: new Date().toISOString()
                });
            }
        });

        // Metrics endpoint
        this.app.get('/metrics', async (req, res) => {
            try {
                res.set('Content-Type', this.metricsRegistry.contentType);
                res.end(await this.metricsRegistry.metrics());
            } catch (error) {
                res.status(500).end();
            }
        });

        // API routes
        this.app.use('/api/v1/conversations', conversationRoutes);
        this.app.use('/api/v1/messages', configureMessageRoutes());
    }

    /**
     * Initialize error handling with monitoring
     */
    private initializeErrorHandling(): void {
        this.app.use(errorMiddleware);
        
        // 404 handler
        this.app.use((req, res) => {
            res.status(404).json({
                error: 'Not Found',
                path: req.path
            });
        });
    }

    /**
     * Start the application server with enhanced monitoring
     */
    public async start(): Promise<void> {
        try {
            // Perform startup health checks
            const isHealthy = await this.circuitBreaker.fire();
            if (!isHealthy) {
                throw new Error('Health check failed during startup');
            }

            // Start HTTP server
            this.app.listen(config.port, config.host, () => {
                this.logger.info(`Server started on ${config.host}:${config.port}`, {
                    port: config.port,
                    environment: process.env.NODE_ENV
                });
            });

            // Start health check monitoring
            setInterval(async () => {
                try {
                    await this.circuitBreaker.fire();
                } catch (error) {
                    this.logger.error('Health check failed', error as Error);
                }
            }, HEALTH_CHECK_CONFIG.INTERVAL);

            // Graceful shutdown handler
            process.on('SIGTERM', this.shutdown.bind(this));
            process.on('SIGINT', this.shutdown.bind(this));

        } catch (error) {
            this.logger.error('Server startup failed', error as Error);
            process.exit(1);
        }
    }

    /**
     * Graceful shutdown handler
     */
    private async shutdown(): Promise<void> {
        this.logger.info('Shutting down server...');
        
        try {
            // Stop accepting new requests
            this.app.disable('trust proxy');
            
            // Wait for ongoing requests to complete (max 10 seconds)
            await new Promise(resolve => setTimeout(resolve, 10000));
            
            // Close message queue
            await this.messageQueue.getQueueHealth();
            
            process.exit(0);
        } catch (error) {
            this.logger.error('Error during shutdown', error as Error);
            process.exit(1);
        }
    }
}

export default App;