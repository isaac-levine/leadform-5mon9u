/**
 * @fileoverview Express middleware for comprehensive request/response logging
 * @version 1.0.0
 * 
 * Provides enterprise-grade request logging with:
 * - Structured logging with correlation IDs
 * - Performance monitoring and thresholds
 * - Distributed tracing support
 * - Data sanitization
 * - Error tracking
 */

import { Request, Response, NextFunction } from 'express'; // v4.18.2
import { v4 as uuidv4 } from 'uuid'; // v9.0.0
import { Logger } from '../utils/logger';
import { ENVIRONMENT } from '../constants';

// Request tracking headers
const REQUEST_ID_HEADER = 'X-Request-ID';
const CORRELATION_ID_HEADER = 'X-Correlation-ID';
const SERVICE_NAME = 'AI-SMS-Platform';
const PERFORMANCE_THRESHOLD_MS = 1000;

/**
 * Extended Express Request interface with tracking metadata
 */
export interface RequestWithId extends Request {
  requestId: string;
  correlationId: string;
  startTime: number;
}

/**
 * Structured metadata for comprehensive request logging
 */
interface RequestLogMetadata {
  requestId: string;
  correlationId: string;
  method: string;
  path: string;
  userAgent: string;
  ip: string;
  userId?: string;
  serviceName: string;
  duration: number;
  statusCode: number;
  contentLength: number;
  error?: Error;
}

/**
 * Creates structured metadata object for request logging
 * @param req - Extended request object with tracking IDs
 * @param res - Express response object
 * @returns Structured metadata for logging
 */
const createRequestMetadata = (req: RequestWithId, res: Response): RequestLogMetadata => {
  const duration = Date.now() - req.startTime;
  
  return {
    requestId: req.requestId,
    correlationId: req.correlationId,
    method: req.method,
    path: req.path,
    userAgent: req.get('user-agent') || 'unknown',
    ip: req.ip,
    userId: (req.user as any)?.id, // Type assertion for user object
    serviceName: SERVICE_NAME,
    duration,
    statusCode: res.statusCode,
    contentLength: parseInt(res.get('content-length') || '0', 10)
  };
};

/**
 * Express middleware for comprehensive request/response logging
 * Implements distributed tracing and performance monitoring
 */
export const requestLoggingMiddleware = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const logger = new Logger('RequestLogging', SERVICE_NAME);
  
  // Generate or extract request tracking IDs
  const requestId = req.get(REQUEST_ID_HEADER) || uuidv4();
  const correlationId = req.get(CORRELATION_ID_HEADER) || requestId;
  
  // Extend request with tracking metadata
  const extendedReq = req as RequestWithId;
  extendedReq.requestId = requestId;
  extendedReq.correlationId = correlationId;
  extendedReq.startTime = Date.now();
  
  // Set tracking headers for distributed tracing
  res.set(REQUEST_ID_HEADER, requestId);
  res.set(CORRELATION_ID_HEADER, correlationId);
  
  // Log incoming request
  logger.info('Incoming request', {
    requestId,
    correlationId,
    method: req.method,
    path: req.path,
    query: req.query,
    headers: req.headers
  });
  
  // Handle response completion
  res.on('finish', () => {
    const metadata = createRequestMetadata(extendedReq, res);
    
    // Check performance threshold
    if (metadata.duration > PERFORMANCE_THRESHOLD_MS) {
      logger.warn('Request exceeded performance threshold', {
        ...metadata,
        threshold: PERFORMANCE_THRESHOLD_MS
      });
    }
    
    // Log response with appropriate level based on status code
    if (metadata.statusCode >= 500) {
      logger.error('Request failed with server error', new Error('Server Error'), metadata);
    } else if (metadata.statusCode >= 400) {
      logger.warn('Request failed with client error', metadata);
    } else {
      logger.info('Request completed successfully', metadata);
    }
    
    // Additional logging for development environment
    if (process.env.NODE_ENV === ENVIRONMENT.DEVELOPMENT) {
      logger.debug('Request details', {
        ...metadata,
        headers: req.headers,
        query: req.query,
        body: req.body
      });
    }
  });
  
  // Error handling
  res.on('error', (error: Error) => {
    logger.error('Request pipeline error', error, {
      requestId,
      correlationId,
      method: req.method,
      path: req.path
    });
  });
  
  next();
};