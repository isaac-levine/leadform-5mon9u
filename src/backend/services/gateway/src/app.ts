/**
 * @fileoverview API Gateway Main Application Configuration
 * @version 1.0.0
 * 
 * Configures and initializes the API Gateway service with:
 * - Security middleware (helmet, cors, rate limiting)
 * - Monitoring and observability (Prometheus, OpenTelemetry)
 * - Service routing and load balancing
 * - Error handling and logging
 */

import express, { Express, Request, Response, NextFunction } from 'express'; // v4.18.2
import cors from 'cors'; // v2.8.5
import helmet from 'helmet'; // v7.1.0
import compression from 'compression'; // v1.7.4
import morgan from 'morgan'; // v1.10.0
import { register as prometheusRegister } from 'prom-client'; // v14.2.0
import { trace, context, propagation } from '@opentelemetry/api'; // v1.4.0
import { StatusCodes } from 'http-status-codes'; // v2.2.0
import { v4 as uuidv4 } from 'uuid'; // v9.0.0

// Internal imports
import config from './config';
import { authenticate } from './middleware/auth.middleware';
import { rateLimitMiddleware } from './middleware/ratelimit.middleware';
import { Logger } from '../../shared/utils/logger';
import { handleError, CustomError } from '../../shared/utils/error-handler';

// Initialize logger
const logger = new Logger('ApiGateway', 'Gateway');

// Constants for security configuration
const CORS_OPTIONS = {
  origin: config.server.corsOrigins,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Correlation-ID'],
  credentials: true,
  maxAge: 86400
};

const HELMET_OPTIONS = {
  contentSecurityPolicy: {
    directives: {
      'default-src': ["'self'"],
      'script-src': ["'self'"],
      'style-src': ["'self'"],
      'img-src': ["'self'", 'data:', 'https:'],
      'connect-src': ["'self'"]
    }
  },
  crossOriginEmbedderPolicy: true,
  crossOriginOpenerPolicy: true,
  crossOriginResourcePolicy: true,
  dnsPrefetchControl: true,
  frameguard: true,
  hidePoweredBy: true,
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true
  },
  ieNoOpen: true,
  noSniff: true,
  referrerPolicy: true,
  xssFilter: true
};

/**
 * Initializes Express application with security middleware and monitoring
 */
function initializeMiddleware(app: Express): void {
  // Security middleware
  app.use(helmet(HELMET_OPTIONS));
  app.use(cors(CORS_OPTIONS));
  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: true, limit: '1mb' }));
  
  // Performance middleware
  app.use(compression());

  // Correlation ID middleware
  app.use((req: Request, res: Response, next: NextFunction) => {
    const correlationId = req.headers['x-correlation-id'] || uuidv4();
    context.with(
      context.active().setValue('correlationId', correlationId),
      () => next()
    );
  });

  // Structured logging middleware
  app.use(morgan('combined', {
    stream: {
      write: (message: string) => {
        logger.info('HTTP Request', {
          message,
          correlationId: context.active().getValue('correlationId')
        });
      }
    }
  }));

  // Rate limiting
  app.use(rateLimitMiddleware);

  // Request tracking metrics
  app.use((req: Request, res: Response, next: NextFunction) => {
    const startTime = Date.now();
    res.on('finish', () => {
      const duration = Date.now() - startTime;
      prometheusRegister.getSingleMetric('http_request_duration_ms')
        ?.observe({ path: req.path, method: req.method, status: res.statusCode }, duration);
    });
    next();
  });
}

/**
 * Configures API routes with authentication and monitoring
 */
function initializeRoutes(app: Express): void {
  // Health check endpoint
  app.get('/health', (req: Request, res: Response) => {
    res.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      version: process.env.npm_package_version
    });
  });

  // Metrics endpoint for Prometheus
  app.get('/metrics', async (req: Request, res: Response) => {
    try {
      res.set('Content-Type', prometheusRegister.contentType);
      res.end(await prometheusRegister.metrics());
    } catch (error) {
      res.status(StatusCodes.INTERNAL_SERVER_ERROR).json(
        handleError(error as Error)
      );
    }
  });

  // API routes with authentication
  app.use('/api/v1/forms', authenticate, require('./routes/form.routes'));
  app.use('/api/v1/sms', authenticate, require('./routes/sms.routes'));
  app.use('/api/v1/ai', authenticate, require('./routes/ai.routes'));
  app.use('/api/v1/analytics', authenticate, require('./routes/analytics.routes'));

  // 404 handler
  app.use((req: Request, res: Response) => {
    const error = new CustomError(
      'Resource not found',
      StatusCodes.NOT_FOUND,
      'NOT_FOUND'
    );
    res.status(StatusCodes.NOT_FOUND).json(handleError(error));
  });

  // Global error handler
  app.use((error: Error, req: Request, res: Response, next: NextFunction) => {
    const errorResponse = handleError(error, {
      path: req.path,
      method: req.method,
      correlationId: context.active().getValue('correlationId')
    });
    res.status(errorResponse.status).json(errorResponse);
  });
}

/**
 * Handles graceful shutdown of the application
 */
async function gracefulShutdown(app: Express, server: any): Promise<void> {
  logger.info('Initiating graceful shutdown');

  // Stop accepting new requests
  server.close(() => {
    logger.info('HTTP server closed');
  });

  try {
    // Close database connections and cleanup
    await Promise.all([
      // Add cleanup tasks here
    ]);

    logger.info('Graceful shutdown completed');
    process.exit(0);
  } catch (error) {
    logger.error('Error during shutdown', error as Error);
    process.exit(1);
  }
}

// Initialize Express application
const app = express();

// Configure middleware and routes
initializeMiddleware(app);
initializeRoutes(app);

// Start server
const server = app.listen(config.server.port, () => {
  logger.info(`API Gateway listening on port ${config.server.port}`, {
    environment: config.server.env
  });
});

// Handle graceful shutdown
process.on('SIGTERM', () => gracefulShutdown(app, server));
process.on('SIGINT', () => gracefulShutdown(app, server));

export default app;