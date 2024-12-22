/**
 * Analytics Service Application Setup
 * Configures Express server with comprehensive middleware stack, security,
 * monitoring, and database connections for the analytics service.
 * @version 1.0.0
 */

import express, { Express, Request, Response } from 'express'; // ^4.18.2
import cors from 'cors'; // ^2.8.5
import helmet from 'helmet'; // ^7.0.0
import compression from 'compression'; // ^1.7.4
import promClient from 'prom-client'; // ^14.2.0
import { createServer, Server } from 'http';
import { config } from './config';
import { configureMetricsRoutes } from './routes/metrics.routes';
import { errorMiddleware } from '../../shared/middleware/error.middleware';
import { requestLoggingMiddleware } from '../../shared/middleware/logging.middleware';
import { Logger } from '../../shared/utils/logger';
import { ENVIRONMENT, ERROR_THRESHOLDS } from '../../shared/constants';

// Initialize logger
const logger = new Logger('AnalyticsApp', 'analytics-service');

// Initialize Prometheus metrics
const register = new promClient.Registry();
promClient.collectDefaultMetrics({ register });

// Custom metrics
const httpRequestDurationMicroseconds = new promClient.Histogram({
  name: 'http_request_duration_ms',
  help: 'Duration of HTTP requests in ms',
  labelNames: ['method', 'route', 'status_code'],
  buckets: [5, 10, 25, 50, 100, 250, 500, 1000]
});
register.registerMetric(httpRequestDurationMicroseconds);

/**
 * Configures Express application middleware stack
 * @param app Express application instance
 */
function configureMiddleware(app: Express): void {
  // Security middleware
  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", 'data:', 'https:'],
        connectSrc: ["'self'"],
        fontSrc: ["'self'"],
        objectSrc: ["'none'"],
        mediaSrc: ["'self'"],
        frameSrc: ["'none'"]
      }
    },
    crossOriginEmbedderPolicy: true,
    crossOriginOpenerPolicy: true,
    crossOriginResourcePolicy: { policy: "same-site" },
    dnsPrefetchControl: true,
    frameguard: { action: 'deny' },
    hidePoweredBy: true,
    hsts: true,
    ieNoOpen: true,
    noSniff: true,
    referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
    xssFilter: true
  }));

  // CORS configuration
  app.use(cors({
    origin: process.env.ALLOWED_ORIGINS?.split(',') || '*',
    methods: ['GET', 'POST'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    exposedHeaders: ['X-Request-ID', 'X-Correlation-ID'],
    credentials: true,
    maxAge: 600 // 10 minutes
  }));

  // Request parsing
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));

  // Compression
  app.use(compression({
    filter: (req, res) => {
      if (req.headers['x-no-compression']) {
        return false;
      }
      return compression.filter(req, res);
    },
    level: 6,
    threshold: 1024
  }));

  // Request logging and tracking
  app.use(requestLoggingMiddleware);

  // Prometheus metrics endpoint
  app.get('/metrics', async (req: Request, res: Response) => {
    try {
      res.set('Content-Type', register.contentType);
      res.end(await register.metrics());
    } catch (error) {
      res.status(500).end(error);
    }
  });

  // Health check endpoint
  app.get('/health', (req: Request, res: Response) => {
    res.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      version: process.env.npm_package_version
    });
  });
}

/**
 * Configures API routes with validation and monitoring
 * @param app Express application instance
 */
function configureRoutes(app: Express): void {
  // API routes
  app.use('/api/v1/analytics', configureMetricsRoutes());

  // 404 handler
  app.use((req: Request, res: Response) => {
    res.status(404).json({
      error: 'Not Found',
      message: `Path ${req.path} not found`
    });
  });

  // Error handling
  app.use(errorMiddleware);
}

/**
 * Initializes and starts the Express server
 * @returns Promise<Server>
 */
async function startServer(): Promise<Server> {
  try {
    const app = express();
    const server = createServer(app);

    // Configure middleware and routes
    configureMiddleware(app);
    configureRoutes(app);

    // Graceful shutdown handler
    const shutdown = async () => {
      logger.info('Shutting down server gracefully...');
      
      server.close(async () => {
        try {
          // Close database connections and cleanup
          logger.info('Server shutdown complete');
          process.exit(0);
        } catch (error) {
          logger.error('Error during shutdown', error as Error);
          process.exit(1);
        }
      });

      // Force shutdown after timeout
      setTimeout(() => {
        logger.error('Forced shutdown due to timeout');
        process.exit(1);
      }, ERROR_THRESHOLDS.RECOVERY_TIME);
    };

    // Register shutdown handlers
    process.on('SIGTERM', shutdown);
    process.on('SIGINT', shutdown);

    // Start server
    return new Promise((resolve) => {
      server.listen(config.port, () => {
        logger.info(`Analytics service started`, {
          port: config.port,
          environment: config.env,
          nodeVersion: process.version
        });
        resolve(server);
      });
    });
  } catch (error) {
    logger.error('Failed to start server', error as Error);
    throw error;
  }
}

// Export app for testing
export const app = {
  startServer
};

// Start server if running directly
if (require.main === module) {
  startServer().catch((error) => {
    logger.error('Server startup failed', error as Error);
    process.exit(1);
  });
}