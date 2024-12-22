/**
 * @fileoverview Entry point for SMS microservice with enhanced monitoring,
 * error handling, and graceful shutdown capabilities.
 * @version 1.0.0
 */

import 'reflect-metadata'; // v0.1.13 - Required for dependency injection
import { container } from 'tsyringe'; // v4.8.0 - Dependency injection
import { v4 as uuid } from 'uuid'; // v9.0.0 - Correlation IDs
import * as promClient from 'prom-client'; // v14.0.0 - Metrics collection
import winston from 'winston'; // v3.8.0 - Logging

import { App } from './app';
import { config } from './config';
import { Logger } from '../../shared/utils/logger';
import { ENVIRONMENT, ERROR_THRESHOLDS } from '../../shared/constants';

// Initialize structured logger
const logger = new Logger('SMSService', 'sms-service');

// Initialize Prometheus metrics registry
const metricsRegistry = new promClient.Registry();
promClient.collectDefaultMetrics({ register: metricsRegistry });

// Custom metrics
const errorCounter = new promClient.Counter({
  name: 'sms_service_errors_total',
  help: 'Total number of errors in SMS service',
  labelNames: ['type', 'severity']
});

const shutdownGauge = new promClient.Gauge({
  name: 'sms_service_shutdown_status',
  help: 'Shutdown status of SMS service (1 = shutting down, 0 = running)'
});

/**
 * Bootstraps the SMS service with comprehensive initialization
 */
async function bootstrap(): Promise<void> {
  const correlationId = uuid();
  logger.info('Starting SMS service', { correlationId });

  try {
    // Validate environment configuration
    if (!config.env || !Object.values(ENVIRONMENT).includes(config.env)) {
      throw new Error('Invalid environment configuration');
    }

    // Register dependencies
    container.register('Logger', { useValue: logger });
    container.register('MetricsRegistry', { useValue: metricsRegistry });
    container.register('Config', { useValue: config });

    // Initialize and start application
    const app = container.resolve(App);
    await app.start();

    logger.info('SMS service started successfully', {
      correlationId,
      port: config.port,
      environment: config.env
    });

  } catch (error) {
    logger.error('Failed to start SMS service', error as Error, { correlationId });
    await handleError(error as Error, correlationId);
    process.exit(1);
  }
}

/**
 * Enhanced error handler with correlation tracking
 */
async function handleError(error: Error, correlationId: string): Promise<void> {
  try {
    // Increment error counter
    errorCounter.inc({ type: error.name, severity: 'critical' });

    // Log error with context
    logger.error('Critical service error', error, {
      correlationId,
      errorType: error.name,
      errorMessage: error.message
    });

    // Check error thresholds
    if (errorCounter.get() > ERROR_THRESHOLDS.MAX_CONSECUTIVE_FAILURES) {
      logger.error('Error threshold exceeded, initiating shutdown', error, {
        correlationId,
        threshold: ERROR_THRESHOLDS.MAX_CONSECUTIVE_FAILURES
      });
      await handleGracefulShutdown('ERROR_THRESHOLD_EXCEEDED');
    }

  } catch (handlingError) {
    // Fallback error logging if error handling fails
    console.error('Error handling failed:', handlingError);
    console.error('Original error:', error);
  }
}

/**
 * Manages graceful shutdown of the service
 */
async function handleGracefulShutdown(signal: string): Promise<void> {
  logger.info('Initiating graceful shutdown', { signal });
  shutdownGauge.set(1);

  try {
    // Set shutdown flag
    const isShuttingDown = true;

    // Stop accepting new connections
    if (container.isRegistered(App)) {
      const app = container.resolve(App);
      await app.shutdown();
    }

    // Wait for existing connections to drain
    const drainTimeout = config.shutdownTimeout || 10000;
    await new Promise(resolve => setTimeout(resolve, drainTimeout));

    // Final cleanup
    await Promise.all([
      metricsRegistry.clear(),
      new Promise(resolve => logger.on('finish', resolve))
    ]);

    logger.info('Graceful shutdown completed', { signal });
    process.exit(0);

  } catch (error) {
    logger.error('Error during shutdown', error as Error, { signal });
    process.exit(1);
  }
}

// Register global error handlers
process.on('uncaughtException', (error) => handleError(error, uuid()));
process.on('unhandledRejection', (error) => handleError(error as Error, uuid()));

// Register shutdown handlers
process.on('SIGTERM', () => handleGracefulShutdown('SIGTERM'));
process.on('SIGINT', () => handleGracefulShutdown('SIGINT'));

// Start the service
bootstrap().catch((error) => handleError(error, uuid()));