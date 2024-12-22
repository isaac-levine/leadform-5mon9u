import http from 'http';
import { config } from './config';
import app from './app';
import { Logger } from '../../shared/utils/logger';

// Initialize logger for the Form Service
const logger = new Logger('FormService', 'form-service');

// Health status tracking
const healthStatus = {
  isShuttingDown: false,
  startupTime: 0
};

// Constants for server configuration
const SHUTDOWN_TIMEOUT = 10000; // 10 seconds
const ERROR_THRESHOLD = 50; // 50 errors before triggering shutdown
const HEALTH_CHECK_INTERVAL = 5000; // 5 seconds
const MAX_CONNECTIONS = 1000;

/**
 * Initializes and starts the HTTP server for the Form Service
 * with comprehensive error handling and health monitoring
 */
async function startServer(): Promise<void> {
  try {
    // Create HTTP server with configured timeouts
    const server = http.createServer(app);
    server.timeout = config.monitoring.healthCheck.timeout;
    server.keepAliveTimeout = 65000; // Slightly higher than ALB idle timeout
    server.maxHeadersCount = 100;
    server.maxConnections = MAX_CONNECTIONS;

    // Track connections for graceful shutdown
    let connections = new Set<any>();
    server.on('connection', connection => {
      connections.add(connection);
      connection.on('close', () => connections.delete(connection));
    });

    // Handle server errors
    server.on('error', (error: Error) => {
      logger.error('Server error occurred', error, {
        port: config.port,
        host: config.host
      });
      process.exit(1);
    });

    // Start server
    await new Promise<void>((resolve, reject) => {
      server.listen(config.port, config.host, () => {
        healthStatus.startupTime = Date.now();
        logger.info('Form Service started successfully', {
          port: config.port,
          host: config.host,
          env: config.env,
          startupTime: new Date().toISOString()
        });
        resolve();
      });

      server.once('error', reject);
    });

    // Set up health monitoring
    monitorServerHealth();

    // Handle process termination signals
    process.on('SIGTERM', () => gracefulShutdown('SIGTERM', server, connections));
    process.on('SIGINT', () => gracefulShutdown('SIGINT', server, connections));
    process.on('SIGUSR2', () => gracefulShutdown('SIGUSR2', server, connections));

    // Set up global error handlers
    handleProcessErrors();

  } catch (error) {
    logger.error('Failed to start Form Service', error as Error, {
      port: config.port,
      host: config.host
    });
    process.exit(1);
  }
}

/**
 * Sets up comprehensive global process error handlers
 * with correlation IDs and circuit breaker implementation
 */
function handleProcessErrors(): void {
  let errorCount = 0;
  const errorResetInterval = setInterval(() => {
    errorCount = 0;
  }, 60000); // Reset error count every minute

  // Handle uncaught exceptions
  process.on('uncaughtException', (error: Error) => {
    logger.error('Uncaught exception', error, {
      type: 'uncaughtException',
      timestamp: new Date().toISOString()
    });

    errorCount++;
    if (errorCount > ERROR_THRESHOLD) {
      logger.error('Error threshold exceeded, initiating shutdown', error, {
        errorCount,
        threshold: ERROR_THRESHOLD
      });
      clearInterval(errorResetInterval);
      process.exit(1);
    }
  });

  // Handle unhandled promise rejections
  process.on('unhandledRejection', (reason: any) => {
    logger.error('Unhandled promise rejection', reason instanceof Error ? reason : new Error(String(reason)), {
      type: 'unhandledRejection',
      timestamp: new Date().toISOString()
    });

    errorCount++;
    if (errorCount > ERROR_THRESHOLD) {
      logger.error('Error threshold exceeded, initiating shutdown', reason, {
        errorCount,
        threshold: ERROR_THRESHOLD
      });
      clearInterval(errorResetInterval);
      process.exit(1);
    }
  });
}

/**
 * Manages graceful shutdown of the server with connection draining
 */
async function gracefulShutdown(
  signal: string,
  server: http.Server,
  connections: Set<any>
): Promise<void> {
  logger.info('Received shutdown signal', {
    signal,
    timestamp: new Date().toISOString()
  });

  healthStatus.isShuttingDown = true;

  try {
    // Stop accepting new connections
    server.close(() => {
      logger.info('HTTP server closed', {
        signal,
        timestamp: new Date().toISOString()
      });
    });

    // Close existing connections
    const connectionClosingPromises = Array.from(connections).map(connection => {
      return new Promise<void>((resolve) => {
        if (!connection.destroyed) {
          connection.end(() => {
            connection.destroy();
            resolve();
          });
        } else {
          resolve();
        }
      });
    });

    // Wait for connections to close with timeout
    await Promise.race([
      Promise.all(connectionClosingPromises),
      new Promise(resolve => setTimeout(resolve, SHUTDOWN_TIMEOUT))
    ]);

    logger.info('Graceful shutdown completed', {
      signal,
      timestamp: new Date().toISOString()
    });

    process.exit(0);

  } catch (error) {
    logger.error('Error during graceful shutdown', error as Error, {
      signal,
      timestamp: new Date().toISOString()
    });
    process.exit(1);
  }
}

/**
 * Implements health monitoring and metrics collection
 */
function monitorServerHealth(): void {
  setInterval(() => {
    const metrics = {
      uptime: process.uptime(),
      memoryUsage: process.memoryUsage(),
      cpuUsage: process.cpuUsage(),
      timestamp: new Date().toISOString(),
      isShuttingDown: healthStatus.isShuttingDown
    };

    // Log health metrics
    logger.info('Health check metrics', metrics);

    // Check memory usage thresholds
    const memoryUsagePercent = (metrics.memoryUsage.heapUsed / metrics.memoryUsage.heapTotal) * 100;
    if (memoryUsagePercent > 90) {
      logger.warn('High memory usage detected', {
        memoryUsagePercent,
        threshold: 90
      });
    }
  }, HEALTH_CHECK_INTERVAL);
}

// Start the server
startServer().catch(error => {
  logger.error('Fatal error starting server', error as Error);
  process.exit(1);
});