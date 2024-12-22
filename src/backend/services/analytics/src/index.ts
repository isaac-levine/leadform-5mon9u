/**
 * Analytics Service Entry Point
 * Initializes and manages the analytics service with comprehensive monitoring,
 * error handling, and graceful shutdown capabilities.
 * @version 1.0.0
 */

import { app } from './app';
import { Logger } from '../../shared/utils/logger';
import { createError, handleError } from '../../shared/utils/error-handler';
import { ERROR_THRESHOLDS, HEALTH_CHECK_CONFIG } from '../../shared/constants';
import { Server } from 'http';

// Initialize logger for the analytics service
const logger = new Logger('AnalyticsService', 'analytics-service');

// Server instance
let server: Server;

// Graceful shutdown timeout (5 seconds)
const SHUTDOWN_TIMEOUT = 5000;

/**
 * Handles uncaught exceptions with correlation IDs and structured logging
 * @param error - Uncaught error
 */
const handleUncaughtException = (error: Error): void => {
  logger.error('Uncaught exception detected', error, {
    correlationId: process.env.CORRELATION_ID,
    type: 'UNCAUGHT_EXCEPTION'
  });

  // Attempt graceful shutdown
  gracefulShutdown('UNCAUGHT_EXCEPTION')
    .catch(shutdownError => {
      logger.error('Failed to shutdown gracefully after uncaught exception', shutdownError, {
        originalError: error
      });
      process.exit(1);
    });
};

/**
 * Handles unhandled promise rejections with detailed error tracking
 * @param error - Unhandled rejection error
 */
const handleUnhandledRejection = (error: Error): void => {
  logger.error('Unhandled rejection detected', error, {
    correlationId: process.env.CORRELATION_ID,
    type: 'UNHANDLED_REJECTION'
  });

  // Attempt graceful shutdown
  gracefulShutdown('UNHANDLED_REJECTION')
    .catch(shutdownError => {
      logger.error('Failed to shutdown gracefully after unhandled rejection', shutdownError, {
        originalError: error
      });
      process.exit(1);
    });
};

/**
 * Performs graceful shutdown with configurable timeout and resource cleanup
 * @param signal - Shutdown signal type
 */
const gracefulShutdown = async (signal: string): Promise<void> => {
  logger.info('Initiating graceful shutdown', {
    signal,
    timeout: SHUTDOWN_TIMEOUT
  });

  let shutdownTimeout: NodeJS.Timeout;

  try {
    // Create a timeout promise
    const timeoutPromise = new Promise((_, reject) => {
      shutdownTimeout = setTimeout(() => {
        reject(new Error(`Shutdown timed out after ${SHUTDOWN_TIMEOUT}ms`));
      }, SHUTDOWN_TIMEOUT);
    });

    // Create a shutdown promise
    const shutdownPromise = new Promise<void>(async (resolve) => {
      if (server) {
        // Stop accepting new connections
        server.close(async () => {
          try {
            // Additional cleanup tasks here (e.g., close database connections)
            logger.info('Server shutdown completed successfully');
            resolve();
          } catch (error) {
            logger.error('Error during server shutdown', error as Error);
            resolve();
          }
        });
      } else {
        resolve();
      }
    });

    // Wait for shutdown or timeout
    await Promise.race([shutdownPromise, timeoutPromise]);
    
    // Clear timeout if shutdown was successful
    clearTimeout(shutdownTimeout);
    
    logger.info('Graceful shutdown completed', { signal });
    process.exit(0);
  } catch (error) {
    logger.error('Graceful shutdown failed', error as Error, { signal });
    process.exit(1);
  }
};

/**
 * Initializes and starts the analytics service with comprehensive health checks
 */
const startServer = async (): Promise<void> => {
  try {
    // Register global error handlers
    process.on('uncaughtException', handleUncaughtException);
    process.on('unhandledRejection', handleUnhandledRejection);
    
    // Register shutdown handlers
    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));

    // Initialize health check monitoring
    let consecutiveFailures = 0;
    const healthCheck = setInterval(() => {
      if (server?.listening) {
        consecutiveFailures = 0;
      } else {
        consecutiveFailures++;
        logger.warn('Health check failed', {
          consecutiveFailures,
          threshold: HEALTH_CHECK_CONFIG.FAILURE_THRESHOLD
        });

        if (consecutiveFailures >= HEALTH_CHECK_CONFIG.FAILURE_THRESHOLD) {
          logger.error('Health check threshold exceeded', new Error('Service unhealthy'));
          gracefulShutdown('HEALTH_CHECK_FAILURE')
            .catch(error => {
              logger.error('Failed to shutdown after health check failure', error);
              process.exit(1);
            });
        }
      }
    }, HEALTH_CHECK_CONFIG.INTERVAL);

    // Start the server
    server = await app.startServer();

    logger.info('Analytics service started successfully', {
      port: process.env.PORT || 3000,
      environment: process.env.NODE_ENV,
      nodeVersion: process.version
    });

  } catch (error) {
    logger.error('Failed to start analytics service', error as Error);
    throw error;
  }
};

// Start the server if this file is run directly
if (require.main === module) {
  startServer().catch((error) => {
    logger.error('Fatal error during service startup', error as Error);
    process.exit(1);
  });
}

// Export for testing
export {
  startServer,
  gracefulShutdown,
  handleUncaughtException,
  handleUnhandledRejection
};