/**
 * @fileoverview SMS Service Configuration
 * @version 1.0.0
 * 
 * Centralized configuration for the SMS service with comprehensive validation,
 * security controls, and monitoring capabilities. Supports multiple providers
 * and intelligent routing with fallback mechanisms.
 */

import dotenv from 'dotenv'; // ^16.3.1
import Joi from 'joi';      // ^17.11.0
import { SMSProvider } from '../../shared/types/sms.types';

// Load environment variables
dotenv.config();

/**
 * Interface for message queue configuration
 */
interface MessageQueueConfig {
  name: string;
  prefix: string;
  attempts: number;
  backoff: {
    type: 'fixed' | 'exponential';
    delay: number;
  };
  monitoring: {
    enabled: boolean;
    interval: number;
  };
}

/**
 * Interface for provider-specific configuration
 */
interface ProviderConfig {
  timeout: number;
  retryConfig: {
    maxAttempts: number;
    backoffMs: number;
  };
}

/**
 * Interface for Twilio-specific configuration
 */
interface TwilioConfig extends ProviderConfig {
  accountSid: string;
  authToken: string;
  phoneNumber: string;
}

/**
 * Interface for MessageBird-specific configuration
 */
interface MessageBirdConfig extends ProviderConfig {
  apiKey: string;
  phoneNumber: string;
}

/**
 * Interface for SMS providers configuration
 */
interface SMSProvidersConfig {
  twilio: TwilioConfig;
  messagebird: MessageBirdConfig;
}

/**
 * Interface for rate limiting configuration
 */
interface RateLimitConfig {
  window: number;
  max: number;
  keyPrefix: string;
  blockDuration: number;
}

/**
 * Interface for AI service configuration
 */
interface AIServiceConfig {
  url: string;
  timeout: number;
  fallbackBehavior: 'queue' | 'retry' | 'skip';
  healthCheck: {
    enabled: boolean;
    interval: number;
  };
}

/**
 * Interface for metrics configuration
 */
interface MetricsConfig {
  enabled: boolean;
  prefix: string;
  interval: number;
  labels: {
    service: string;
    version: string;
  };
}

/**
 * Main configuration interface
 */
interface Config {
  env: string;
  port: number;
  host: string;
  mongodbUri: string;
  redisUri: string;
  messageQueue: MessageQueueConfig;
  smsProviders: SMSProvidersConfig;
  rateLimit: RateLimitConfig;
  aiService: AIServiceConfig;
  metrics: MetricsConfig;
}

/**
 * Validation schema for configuration using Joi
 */
const configSchema = Joi.object({
  env: Joi.string().valid('development', 'staging', 'production').required(),
  port: Joi.number().port().required(),
  host: Joi.string().hostname().required(),
  mongodbUri: Joi.string().uri().required(),
  redisUri: Joi.string().uri().required(),
  messageQueue: Joi.object({
    name: Joi.string().required(),
    prefix: Joi.string().required(),
    attempts: Joi.number().min(1).max(5).required(),
    backoff: Joi.object({
      type: Joi.string().valid('fixed', 'exponential').required(),
      delay: Joi.number().min(100).max(10000).required()
    }).required(),
    monitoring: Joi.object({
      enabled: Joi.boolean().required(),
      interval: Joi.number().min(1000).max(60000).required()
    }).required()
  }).required(),
  smsProviders: Joi.object({
    twilio: Joi.object({
      accountSid: Joi.string().required(),
      authToken: Joi.string().required(),
      phoneNumber: Joi.string().pattern(/^\+[1-9]\d{1,14}$/).required(),
      timeout: Joi.number().min(1000).max(10000).required(),
      retryConfig: Joi.object({
        maxAttempts: Joi.number().min(1).max(5).required(),
        backoffMs: Joi.number().min(100).max(5000).required()
      }).required()
    }).required(),
    messagebird: Joi.object({
      apiKey: Joi.string().required(),
      phoneNumber: Joi.string().pattern(/^\+[1-9]\d{1,14}$/).required(),
      timeout: Joi.number().min(1000).max(10000).required(),
      retryConfig: Joi.object({
        maxAttempts: Joi.number().min(1).max(5).required(),
        backoffMs: Joi.number().min(100).max(5000).required()
      }).required()
    }).required()
  }).required(),
  rateLimit: Joi.object({
    window: Joi.number().min(1000).max(3600000).required(),
    max: Joi.number().min(1).max(1000).required(),
    keyPrefix: Joi.string().required(),
    blockDuration: Joi.number().min(60000).max(86400000).required()
  }).required(),
  aiService: Joi.object({
    url: Joi.string().uri().required(),
    timeout: Joi.number().max(500).required(), // Enforcing 500ms response time requirement
    fallbackBehavior: Joi.string().valid('queue', 'retry', 'skip').required(),
    healthCheck: Joi.object({
      enabled: Joi.boolean().required(),
      interval: Joi.number().min(5000).max(60000).required()
    }).required()
  }).required(),
  metrics: Joi.object({
    enabled: Joi.boolean().required(),
    prefix: Joi.string().required(),
    interval: Joi.number().min(1000).max(60000).required(),
    labels: Joi.object({
      service: Joi.string().required(),
      version: Joi.string().required()
    }).required()
  }).required()
});

/**
 * Raw configuration object populated from environment variables
 */
const rawConfig: Config = {
  env: process.env.NODE_ENV || 'development',
  port: Number(process.env.SMS_SERVICE_PORT) || 3002,
  host: process.env.SMS_SERVICE_HOST || '0.0.0.0',
  mongodbUri: process.env.MONGODB_URI!,
  redisUri: process.env.REDIS_URI!,
  messageQueue: {
    name: process.env.MESSAGE_QUEUE_NAME || 'sms-messages',
    prefix: process.env.QUEUE_PREFIX || 'prod',
    attempts: Number(process.env.QUEUE_ATTEMPTS) || 3,
    backoff: {
      type: (process.env.QUEUE_BACKOFF_TYPE as 'fixed' | 'exponential') || 'exponential',
      delay: Number(process.env.QUEUE_BACKOFF_DELAY) || 1000
    },
    monitoring: {
      enabled: process.env.QUEUE_MONITORING_ENABLED === 'true',
      interval: Number(process.env.QUEUE_MONITORING_INTERVAL) || 5000
    }
  },
  smsProviders: {
    twilio: {
      accountSid: process.env.TWILIO_ACCOUNT_SID!,
      authToken: process.env.TWILIO_AUTH_TOKEN!,
      phoneNumber: process.env.TWILIO_PHONE_NUMBER!,
      timeout: Number(process.env.TWILIO_TIMEOUT) || 5000,
      retryConfig: {
        maxAttempts: Number(process.env.TWILIO_RETRY_ATTEMPTS) || 2,
        backoffMs: Number(process.env.TWILIO_RETRY_BACKOFF) || 1000
      }
    },
    messagebird: {
      apiKey: process.env.MESSAGEBIRD_API_KEY!,
      phoneNumber: process.env.MESSAGEBIRD_PHONE_NUMBER!,
      timeout: Number(process.env.MESSAGEBIRD_TIMEOUT) || 5000,
      retryConfig: {
        maxAttempts: Number(process.env.MESSAGEBIRD_RETRY_ATTEMPTS) || 2,
        backoffMs: Number(process.env.MESSAGEBIRD_RETRY_BACKOFF) || 1000
      }
    }
  },
  rateLimit: {
    window: Number(process.env.RATE_LIMIT_WINDOW) || 60000,
    max: Number(process.env.RATE_LIMIT_MAX) || 100,
    keyPrefix: process.env.RATE_LIMIT_PREFIX || 'sms_rl',
    blockDuration: Number(process.env.RATE_LIMIT_BLOCK_DURATION) || 300000
  },
  aiService: {
    url: process.env.AI_SERVICE_URL!,
    timeout: Number(process.env.AI_SERVICE_TIMEOUT) || 500,
    fallbackBehavior: (process.env.AI_FALLBACK_BEHAVIOR as 'queue' | 'retry' | 'skip') || 'queue',
    healthCheck: {
      enabled: process.env.AI_HEALTH_CHECK_ENABLED === 'true',
      interval: Number(process.env.AI_HEALTH_CHECK_INTERVAL) || 30000
    }
  },
  metrics: {
    enabled: process.env.METRICS_ENABLED === 'true',
    prefix: process.env.METRICS_PREFIX || 'sms_service',
    interval: Number(process.env.METRICS_INTERVAL) || 10000,
    labels: {
      service: 'sms',
      version: process.env.SERVICE_VERSION || '1.0.0'
    }
  }
};

/**
 * Validates the configuration object against the defined schema
 * @param config Raw configuration object
 * @returns Validated configuration object
 * @throws {Error} If validation fails
 */
function validateConfig(config: Record<string, any>): Config {
  const { error, value } = configSchema.validate(config, {
    abortEarly: false,
    stripUnknown: true
  });

  if (error) {
    throw new Error(`Configuration validation failed: ${error.message}`);
  }

  return value;
}

// Export validated configuration
export const config = validateConfig(rawConfig);

// Export provider enum for use in service
export { SMSProvider };