/**
 * @fileoverview Centralized constants module for backend services
 * @version 1.0.0
 * 
 * This module defines shared configuration values, limits, validation rules,
 * and other constants used across backend services to ensure consistent behavior
 * and meet system requirements.
 */

import { SMSProvider } from '../types/sms.types';

/**
 * Environment type constants
 */
export enum ENVIRONMENT {
  DEVELOPMENT = 'development',
  STAGING = 'staging',
  PRODUCTION = 'production',
  TEST = 'test'
}

/**
 * SMS service configuration constants
 * Configured for high reliability and provider redundancy
 */
export const SMS_CONFIG = {
  MAX_LENGTH: 1600, // Maximum SMS length supporting concatenated messages
  RETRY_ATTEMPTS: 3, // Number of retry attempts for failed deliveries
  PROVIDERS: [
    SMSProvider.TWILIO,
    SMSProvider.MESSAGEBIRD
  ] as const,
  DELIVERY_TIMEOUT: 10000, // 10 seconds delivery timeout
} as const;

/**
 * AI processing configuration constants
 * Optimized for < 500ms processing requirement
 */
export const AI_CONFIG = {
  PROCESSING_TIMEOUT: 500, // 500ms max processing time per technical spec
  MAX_RETRIES: 2, // Maximum retries for AI processing
  CONFIDENCE_THRESHOLD: 0.85, // Minimum confidence score for AI responses
  FALLBACK_DELAY: 100, // Delay before fallback processing in ms
} as const;

/**
 * Health check configuration for 99.9% uptime requirement
 */
export const HEALTH_CHECK_CONFIG = {
  INTERVAL: 60000, // Health check interval (1 minute)
  TIMEOUT: 5000, // Health check timeout (5 seconds)
  FAILURE_THRESHOLD: 3, // Number of failures before marking unhealthy
  SUCCESS_THRESHOLD: 2, // Successes needed to restore healthy status
} as const;

/**
 * Error thresholds for system reliability
 */
export const ERROR_THRESHOLDS = {
  MAX_CONSECUTIVE_FAILURES: 5, // Maximum consecutive failures before circuit break
  ERROR_RATE_THRESHOLD: 0.001, // 0.1% error rate threshold
  RECOVERY_TIME: 300000, // Recovery time after threshold breach (5 minutes)
} as const;

/**
 * Form service configuration constants
 */
export const FORM_CONFIG = {
  MAX_FIELDS: 50, // Maximum number of fields per form
  MAX_FIELD_LENGTH: 1000, // Maximum length of field content
  ALLOWED_FILE_TYPES: [
    'image/jpeg',
    'image/png',
    'application/pdf'
  ] as const,
} as const;

/**
 * API gateway configuration constants
 */
export const API_CONFIG = {
  RATE_LIMIT_WINDOW: 900000, // 15-minute rate limit window
  MAX_REQUESTS: 100, // Maximum requests per window
  TIMEOUT: 30000, // 30-second request timeout
} as const;

/**
 * Common validation rules
 */
export const VALIDATION_RULES = {
  // Follows E.164 format for international phone numbers
  PHONE_REGEX: /^\+?[1-9]\d{1,14}$/,
  // RFC 5322 compliant email validation
  EMAIL_REGEX: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
} as const;

// Type assertions to ensure constants are readonly
Object.freeze(SMS_CONFIG);
Object.freeze(AI_CONFIG);
Object.freeze(HEALTH_CHECK_CONFIG);
Object.freeze(ERROR_THRESHOLDS);
Object.freeze(FORM_CONFIG);
Object.freeze(API_CONFIG);
Object.freeze(VALIDATION_RULES);