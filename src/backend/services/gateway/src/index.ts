/**
 * @fileoverview API Gateway Service Entry Point
 * @version 1.0.0
 * 
 * Initializes and manages the API Gateway service with:
 * - High availability (99.9% uptime requirement)
 * - Enhanced error handling and monitoring
 * - Graceful shutdown capabilities
 * - Connection tracking and management
 */

import http from 'http'; // v1.0.0
import app from './app';
import config from './config';
import { Logger } from '../../shared/utils/logger';

// Initialize logger for the gateway service
const logger = new Logger('GatewayServer', 'ApiGateway');

// Server instance and state tracking
let server: http.Server;
const activeConnections = new Set<string>();
let isShuttingDown = false;

// Constants for server configuration
const SHUTDOWN_TIMEOUT = 30000; // 30 seconds
const MAX_CONNECTIONS = 10000;
const HEALTH_CHECK_INTERVAL = 5000; // 5 seconds
const CONNECTION_TIMEOUT = 120000; // 2 minutes

/**
 * Tracks active connections for graceful shutdown
 * @param connectionId Unique identifier for the connection
 */
function trackConnection(connectionId: string): void {
  if (isShuttingDown) {
    logger.warn('Connection rejected - server is shutting down', { connectionId });
    return;
  }

  if (activeConnections.size >= MAX_CONNECTIONS) {
    logger.error('Maximum connections reached', {
      maxConnections: MAX_CONNECTIONS,
      activeConnections: activeConnections.size
    });
    return;
  }

  activeConnections.add(connectionId);
  logger.debug('Connection tracked', {
    connectionId,
    activeConnections: activeConnections.size
  });
}

/**
 * Handles server errors with correlation IDs
 * @param error Error object
 * @param correlationId Request correlation ID
 */
function handleServerError(error: Error, correlationId: string): void {
  logger.error('Server error occurred', error, {
    correlationId,
    activeConnections: activeConnections.size,
    isShuttingDown
  });

  if (!isShuttingDown) {
    // Initiate graceful shutdown if error is unrecoverable
    if (error.message.includes('EADDRINUSE') || error.message.includes('EACCES')) {
      gracefulShutdown('Unrecoverable server error');
    }
  }
}

/**
 * Performs graceful server shutdown
 * @param reason Shutdown reason
 */
async function gracefulShutdown(reason: string): Promise<void> {
  if (isShuttingDown) {
    logger.warn('Shutdown already in progress');
    return;
  }

  logger.info('Initiating graceful shutdown', { reason });
  isShuttingDown = true;

  // Stop accepting new connections
  server.close(() => {
    logger.info('Server stopped accepting new connections');
  });

  try {
    // Wait for active connections to complete
    const shutdownTimeout = setTimeout(() => {
      logger.warn('Forced shutdown due to timeout', {
        activeConnections: activeConnections.size
      });
      process.exit(1);
    }, SHUTDOWN_TIMEOUT);

    // Wait for active connections to finish
    while (activeConnections.size > 0) {
      logger.info('Waiting for connections to close', {
        remainingConnections: activeConnections.size
      });
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    clearTimeout(shutdownTimeout);
    logger.info('Graceful shutdown completed');
    process.exit(0);
  } catch (error) {
    logger.error('Error during shutdown', error as Error);
    process.exit(1);
  }
}

/**
 * Starts the HTTP server with monitoring and health checks
 */
async function startServer(): Promise<void> {
  try {
    // Create HTTP server
    server = http.createServer(app);

    // Configure connection tracking
    server.on('connection', socket => {
      const connectionId = `${socket.remoteAddress}:${socket.remotePort}`;
      trackConnection(connectionId);

      // Set connection timeout
      socket.setTimeout(CONNECTION_TIMEOUT);

      socket.on('close', () => {
        activeConnections.delete(connectionId);
        logger.debug('Connection closed', { connectionId });
      });
    });

    // Configure error handling
    server.on('error', (error: Error) => {
      handleServerError(error, 'server');
    });

    // Start listening
    server.listen(config.server.port, () => {
      logger.info('API Gateway started', {
        port: config.server.port,
        environment: config.server.env,
        maxConnections: MAX_CONNECTIONS
      });
    });

    // Health check monitoring
    setInterval(() => {
      const metrics = {
        activeConnections: activeConnections.size,
        uptime: process.uptime(),
        memoryUsage: process.memoryUsage(),
        isShuttingDown
      };

      logger.info('Health check', metrics);
    }, HEALTH_CHECK_INTERVAL);

    // Handle process signals
    process.on('SIGTERM', () => gracefulShutdown('SIGTERM received'));
    process.on('SIGINT', () => gracefulShutdown('SIGINT received'));
    process.on('uncaughtException', (error: Error) => {
      handleServerError(error, 'uncaught');
      gracefulShutdown('Uncaught exception');
    });
    process.on('unhandledRejection', (reason: unknown) => {
      handleServerError(reason as Error, 'unhandled');
      gracefulShutdown('Unhandled rejection');
    });

  } catch (error) {
    logger.error('Failed to start server', error as Error);
    process.exit(1);
  }
}

// Start the server
startServer().catch(error => {
  logger.error('Server startup failed', error as Error);
  process.exit(1);
});