import { StatusCodes } from 'http-status-codes'; // v2.2.0
import * as winston from 'winston'; // v3.11.0
import * as cls from 'cls-hooked'; // v4.2.0

// Create namespace for correlation ID tracking
const namespace = cls.createNamespace('error-handler-context');

// Type Definitions
export type ErrorResponse = {
  status: number;
  message: string;
  code: string;
  timestamp: string;
  correlationId: string;
  severity: string;
  stack?: string;
};

export type ErrorMetadata = {
  requestId: string;
  path: string;
  method: string;
  userId?: string;
  tags: string[];
};

// Constants
export const ERROR_SEVERITY = {
  CRITICAL: 'critical',
  ERROR: 'error',
  WARNING: 'warning',
  INFO: 'info'
} as const;

export const DEFAULT_ERROR_CODE = 'INTERNAL_SERVER_ERROR';
export const DEFAULT_ERROR_MESSAGE = 'An unexpected error occurred';
const SENSITIVE_FIELDS = ['password', 'token', 'secret', 'key', 'authorization'];

// Configure Winston logger
const logger = winston.createLogger({
  level: 'error',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      )
    }),
    new winston.transports.File({ 
      filename: 'error.log',
      maxsize: 5242880, // 5MB
      maxFiles: 5
    })
  ]
});

/**
 * Enhanced base error class for application-specific errors
 * with distributed tracing support
 */
export class CustomError extends Error {
  public readonly statusCode: number;
  public readonly code: string;
  public readonly timestamp: string;
  public readonly correlationId: string;
  public readonly metadata: Record<string, any>;
  public readonly severity: string;

  constructor(
    message: string,
    statusCode: number = StatusCodes.INTERNAL_SERVER_ERROR,
    code: string = DEFAULT_ERROR_CODE,
    severity: string = ERROR_SEVERITY.ERROR,
    metadata: Record<string, any> = {}
  ) {
    super(message);
    
    // Set error properties
    this.name = this.constructor.name;
    this.statusCode = statusCode;
    this.code = code;
    this.timestamp = new Date().toISOString();
    this.correlationId = namespace.get('correlationId') || '';
    this.severity = severity;
    this.metadata = this.sanitizeMetadata(metadata);

    // Capture stack trace
    Error.captureStackTrace(this, this.constructor);
    
    // Remove sensitive information in production
    if (process.env.NODE_ENV === 'production') {
      this.sanitizeStack();
    }
  }

  private sanitizeMetadata(metadata: Record<string, any>): Record<string, any> {
    const sanitized = { ...metadata };
    SENSITIVE_FIELDS.forEach(field => {
      if (field in sanitized) {
        sanitized[field] = '[REDACTED]';
      }
    });
    return sanitized;
  }

  private sanitizeStack(): void {
    if (this.stack) {
      this.stack = this.stack
        .split('\n')
        .filter(line => !SENSITIVE_FIELDS.some(field => line.includes(field)))
        .join('\n');
    }
  }
}

/**
 * Factory function for creating custom errors with severity and metadata
 */
export function createError(
  message: string,
  statusCode: number = StatusCodes.INTERNAL_SERVER_ERROR,
  code: string = DEFAULT_ERROR_CODE,
  severity: string = ERROR_SEVERITY.ERROR,
  metadata: Record<string, any> = {}
): CustomError {
  // Validate input parameters
  if (!message) {
    message = DEFAULT_ERROR_MESSAGE;
  }

  // Sanitize error message
  message = message.replace(
    new RegExp(SENSITIVE_FIELDS.join('|'), 'gi'),
    '[REDACTED]'
  );

  return new CustomError(
    message,
    statusCode,
    code,
    severity,
    metadata
  );
}

/**
 * Enhanced error processor with secure error formatting and structured logging
 */
export function handleError(
  error: Error,
  requestContext?: Record<string, any>
): ErrorResponse {
  const isCustomError = error instanceof CustomError;
  const statusCode = isCustomError ? (error as CustomError).statusCode : StatusCodes.INTERNAL_SERVER_ERROR;
  const errorCode = isCustomError ? (error as CustomError).code : DEFAULT_ERROR_CODE;
  const correlationId = namespace.get('correlationId') || '';

  // Prepare error metadata
  const metadata = {
    timestamp: new Date().toISOString(),
    correlationId,
    request: requestContext ? {
      path: requestContext.path,
      method: requestContext.method,
      headers: sanitizeHeaders(requestContext.headers)
    } : undefined
  };

  // Log error with structured format
  logError(error, metadata, correlationId);

  // Prepare secure error response
  const errorResponse: ErrorResponse = {
    status: statusCode,
    message: error.message || DEFAULT_ERROR_MESSAGE,
    code: errorCode,
    timestamp: metadata.timestamp,
    correlationId,
    severity: isCustomError ? (error as CustomError).severity : ERROR_SEVERITY.ERROR
  };

  // Include stack trace only in development
  if (process.env.NODE_ENV !== 'production') {
    errorResponse.stack = error.stack;
  }

  return errorResponse;
}

/**
 * Structured logging function with ELK Stack integration
 */
function logError(
  error: Error,
  metadata: Record<string, any>,
  correlationId: string
): void {
  const logEntry = {
    timestamp: new Date().toISOString(),
    level: error instanceof CustomError ? (error as CustomError).severity : ERROR_SEVERITY.ERROR,
    message: error.message,
    correlationId,
    metadata: sanitizeMetadata(metadata),
    stack: process.env.NODE_ENV !== 'production' ? error.stack : undefined,
    environment: process.env.NODE_ENV,
    service: process.env.SERVICE_NAME || 'unknown'
  };

  try {
    logger.error(logEntry);
  } catch (loggingError) {
    // Fallback to console in case of logging failure
    console.error('Logging failed:', loggingError);
    console.error('Original error:', logEntry);
  }
}

// Utility functions
function sanitizeHeaders(headers: Record<string, any>): Record<string, any> {
  const sanitized = { ...headers };
  SENSITIVE_FIELDS.forEach(field => {
    if (field in sanitized) {
      sanitized[field] = '[REDACTED]';
    }
  });
  return sanitized;
}

function sanitizeMetadata(metadata: Record<string, any>): Record<string, any> {
  const sanitized = { ...metadata };
  const sensitivePattern = new RegExp(SENSITIVE_FIELDS.join('|'), 'gi');
  
  JSON.stringify(sanitized, (key, value) => {
    if (typeof value === 'string' && sensitivePattern.test(key)) {
      return '[REDACTED]';
    }
    return value;
  });

  return sanitized;
}