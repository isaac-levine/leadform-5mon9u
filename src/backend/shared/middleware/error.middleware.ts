import { Request, Response, NextFunction } from 'express'; // ^4.18.0
import { StatusCodes } from 'http-status-codes'; // ^2.2.0
import correlator from 'express-correlation-id'; // ^2.0.0
import CircuitBreaker from 'circuit-breaker-js'; // ^0.2.0
import { handleError } from '../utils/error-handler';
import { Logger } from '../utils/logger';
import { ERROR_THRESHOLDS } from '../constants';

/**
 * Configuration options for error middleware
 */
export interface ErrorMiddlewareConfig {
  includeStack: boolean;
  logLevel: string;
  maxErrorRate: number;
  circuitBreakerThreshold: number;
  errorCooldownPeriod: number;
  enableMetrics: boolean;
  enableTracing: boolean;
}

/**
 * Standardized error response structure
 */
export interface ErrorResponse {
  code: string;
  message: string;
  correlationId: string;
  details?: Record<string, any>;
  stack?: string;
}

/**
 * Default configuration for error middleware
 */
const DEFAULT_ERROR_CONFIG: ErrorMiddlewareConfig = {
  includeStack: false,
  logLevel: 'error',
  maxErrorRate: 100, // errors per minute
  circuitBreakerThreshold: 50, // percentage
  errorCooldownPeriod: 60000, // 1 minute
  enableMetrics: true,
  enableTracing: true
};

// Initialize logger
const logger = new Logger('ErrorMiddleware', 'api-service');

// Initialize circuit breaker
const breaker = new CircuitBreaker({
  windowDuration: ERROR_THRESHOLDS.RECOVERY_TIME,
  volumeThreshold: ERROR_THRESHOLDS.MAX_CONSECUTIVE_FAILURES,
  errorThreshold: ERROR_THRESHOLDS.ERROR_RATE_THRESHOLD * 100
});

// Error count tracking
let errorCount = 0;
let lastErrorReset = Date.now();

/**
 * Express error handling middleware with enhanced monitoring and circuit breaking
 * 
 * @param error - Error object to be handled
 * @param req - Express request object
 * @param res - Express response object
 * @param next - Express next function
 */
export const errorMiddleware = (
  error: Error,
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const startTime = process.hrtime();
  
  // Get or generate correlation ID
  const correlationId = correlator.getId() || 'unknown';

  // Check circuit breaker state
  if (breaker.isOpen()) {
    logger.warn('Circuit breaker is open - service may be degraded', {
      correlationId,
      path: req.path
    });
  }

  try {
    // Track error rate
    errorCount++;
    const now = Date.now();
    if (now - lastErrorReset > DEFAULT_ERROR_CONFIG.errorCooldownPeriod) {
      const errorRate = errorCount / (DEFAULT_ERROR_CONFIG.errorCooldownPeriod / 1000);
      if (errorRate > DEFAULT_ERROR_CONFIG.maxErrorRate) {
        breaker.trip();
        logger.error('Error rate threshold exceeded - circuit breaker tripped', error, {
          correlationId,
          errorRate,
          threshold: DEFAULT_ERROR_CONFIG.maxErrorRate
        });
      }
      errorCount = 0;
      lastErrorReset = now;
    }

    // Process error with error handler utility
    const errorResponse = handleError(error, {
      path: req.path,
      method: req.method,
      headers: req.headers,
      query: req.query,
      body: req.body
    });

    // Add correlation ID to response headers
    res.setHeader('X-Correlation-ID', correlationId);

    // Calculate response time
    const [seconds, nanoseconds] = process.hrtime(startTime);
    const responseTime = seconds * 1000 + nanoseconds / 1000000;

    // Log error with context
    logger.error('Request error occurred', error, {
      correlationId,
      path: req.path,
      method: req.method,
      statusCode: errorResponse.status,
      responseTime,
      userId: req.user?.id
    });

    // Format response based on configuration
    const response: ErrorResponse = {
      code: errorResponse.code,
      message: errorResponse.message,
      correlationId: errorResponse.correlationId,
      details: {
        timestamp: errorResponse.timestamp,
        path: req.path,
        method: req.method
      }
    };

    // Include stack trace if configured and not in production
    if (DEFAULT_ERROR_CONFIG.includeStack && process.env.NODE_ENV !== 'production') {
      response.stack = errorResponse.stack;
    }

    // Record error metrics if enabled
    if (DEFAULT_ERROR_CONFIG.enableMetrics) {
      // Increment error counter by type
      const errorType = error.constructor.name;
      const errorMetrics = {
        type: errorType,
        path: req.path,
        method: req.method,
        statusCode: errorResponse.status,
        responseTime
      };
      logger.debug('Error metrics recorded', { metrics: errorMetrics });
    }

    // Send error response
    res.status(errorResponse.status).json(response);

  } catch (handlingError) {
    // Fallback error handling if primary error handling fails
    logger.error('Error handling failed', handlingError as Error, {
      correlationId,
      originalError: error
    });

    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      code: 'ERROR_HANDLING_FAILED',
      message: 'An unexpected error occurred while processing the error',
      correlationId
    });
  }
};

export default errorMiddleware;