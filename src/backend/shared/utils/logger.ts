/**
 * @fileoverview Centralized logging utility for backend services
 * @version 1.0.0
 * 
 * Provides standardized logging capabilities with:
 * - Multiple log levels (error, warn, info, debug)
 * - Structured logging with metadata
 * - Environment-specific formatting
 * - Log rotation for production
 * - Monitoring system integration
 */

import winston from 'winston'; // v3.10.0
import DailyRotateFile from 'winston-daily-rotate-file'; // v4.7.1
import { ENVIRONMENT } from '../constants';

/**
 * Interface for structured logging metadata
 */
export interface LogMetadata {
  context: string;
  timestamp: Date;
  requestId?: string;
  userId?: string;
  correlationId?: string;
  environment: string;
  service: string;
  additionalInfo?: Record<string, unknown>;
}

/**
 * Logging levels configuration
 */
const LOG_LEVELS = {
  ERROR: 'error',
  WARN: 'warn',
  INFO: 'info',
  DEBUG: 'debug'
} as const;

/**
 * Console output colors for different log levels
 */
const LOG_COLORS = {
  error: 'red',
  warn: 'yellow',
  info: 'green',
  debug: 'blue'
} as const;

/**
 * Production log file rotation configuration
 */
const LOG_FILE_CONFIG = {
  maxSize: '10m',
  maxFiles: '7d',
  compress: true,
  datePattern: 'YYYY-MM-DD',
  zippedArchive: true,
  maxRetentionDays: 30,
  auditLog: true
} as const;

/**
 * Enhanced logging class with structured logging and monitoring integration
 */
export class Logger {
  private logger: winston.Logger;
  private context: string;
  private service: string;
  private defaultMetadata: Partial<LogMetadata>;

  /**
   * Creates a new logger instance
   * @param context - Logging context (e.g., module name)
   * @param service - Service name for distributed tracing
   */
  constructor(context: string, service: string) {
    this.context = context;
    this.service = service;
    this.defaultMetadata = {
      context,
      service,
      environment: process.env.NODE_ENV || ENVIRONMENT.DEVELOPMENT
    };

    // Configure winston logger with environment-specific settings
    this.logger = winston.createLogger({
      level: process.env.LOG_LEVEL || 'info',
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json(),
        winston.format.errors({ stack: true })
      ),
      defaultMeta: this.defaultMetadata,
      exitOnError: false
    });

    // Add console transport for development
    if (process.env.NODE_ENV !== ENVIRONMENT.PRODUCTION) {
      this.logger.add(new winston.transports.Console({
        format: winston.format.combine(
          winston.format.colorize({ colors: LOG_COLORS }),
          winston.format.simple()
        )
      }));
    }

    // Add file transport with rotation for production
    if (process.env.NODE_ENV === ENVIRONMENT.PRODUCTION) {
      this.logger.add(new DailyRotateFile({
        filename: `logs/${service}-%DATE%.log`,
        ...LOG_FILE_CONFIG
      }));
    }
  }

  /**
   * Logs information level messages
   * @param message - Log message
   * @param meta - Additional metadata
   */
  public info(message: string, meta: Partial<LogMetadata> = {}): void {
    this.log(LOG_LEVELS.INFO, message, meta);
  }

  /**
   * Logs error level messages with stack traces
   * @param message - Error message
   * @param error - Error object
   * @param meta - Additional metadata
   */
  public error(message: string, error: Error, meta: Partial<LogMetadata> = {}): void {
    const errorMeta = {
      ...meta,
      error: {
        name: error.name,
        message: error.message,
        stack: error.stack
      }
    };
    this.log(LOG_LEVELS.ERROR, message, errorMeta);
  }

  /**
   * Logs debug level messages
   * @param message - Debug message
   * @param meta - Additional metadata
   */
  public debug(message: string, meta: Partial<LogMetadata> = {}): void {
    this.log(LOG_LEVELS.DEBUG, message, meta);
  }

  /**
   * Logs warning level messages
   * @param message - Warning message
   * @param meta - Additional metadata
   */
  public warn(message: string, meta: Partial<LogMetadata> = {}): void {
    this.log(LOG_LEVELS.WARN, message, meta);
  }

  /**
   * Internal method to handle log processing
   * @param level - Log level
   * @param message - Log message
   * @param meta - Additional metadata
   */
  private log(level: string, message: string, meta: Partial<LogMetadata>): void {
    const timestamp = new Date();
    const enhancedMeta = {
      ...this.defaultMetadata,
      ...meta,
      timestamp
    };

    // Sanitize sensitive data
    const sanitizedMeta = this.sanitizeMetadata(enhancedMeta);

    try {
      this.logger.log(level, message, sanitizedMeta);
    } catch (error) {
      // Fallback to console in case of logging failure
      console.error('Logging failed:', error);
      console.log(level, message, sanitizedMeta);
    }
  }

  /**
   * Sanitizes sensitive information from log metadata
   * @param meta - Metadata to sanitize
   * @returns Sanitized metadata
   */
  private sanitizeMetadata(meta: Partial<LogMetadata>): Partial<LogMetadata> {
    const sensitiveFields = ['password', 'token', 'apiKey', 'secret'];
    const sanitized = { ...meta };

    const sanitizeObject = (obj: Record<string, any>): Record<string, any> => {
      const sanitizedObj = { ...obj };
      for (const key in sanitizedObj) {
        if (sensitiveFields.includes(key.toLowerCase())) {
          sanitizedObj[key] = '[REDACTED]';
        } else if (typeof sanitizedObj[key] === 'object' && sanitizedObj[key] !== null) {
          sanitizedObj[key] = sanitizeObject(sanitizedObj[key]);
        }
      }
      return sanitizedObj;
    };

    return sanitizeObject(sanitized);
  }
}