/**
 * @fileoverview API Gateway Configuration Module
 * @version 1.0.0
 * 
 * Centralizes all configuration for the API Gateway service including:
 * - Server configuration
 * - Authentication settings
 * - Rate limiting rules
 * - Service endpoints
 * - Enhanced security controls
 */

import dotenv from 'dotenv'; // v16.3.1
import joi from 'joi'; // v17.11.0
import { Logger } from '../../../shared/utils/logger';
import { ENVIRONMENT, API_CONFIG } from '../../../shared/constants';

// Initialize logger for configuration module
const logger = new Logger('ConfigModule', 'ApiGateway');

/**
 * Environment type definition
 */
type Environment = 'development' | 'staging' | 'production';

/**
 * Server configuration interface with enhanced security settings
 */
interface ServerConfig {
  port: number;
  env: Environment;
  apiPrefix: string;
  corsOrigins: string[];
}

/**
 * Authentication configuration interface with secret rotation
 */
interface AuthConfig {
  JWT_SECRET: string;
  JWT_EXPIRY: string;
  REFRESH_TOKEN_EXPIRY: string;
  secretRotationInterval: string;
}

/**
 * Rate limiting configuration interface with enhanced controls
 */
interface RateLimitConfig {
  windowMs: number;
  maxRequests: number;
  blockDuration: number;
  trustProxy: boolean;
  skipPaths: string[];
}

/**
 * Service endpoint configuration interface with health checks
 */
interface ServiceConfig {
  url: string;
  timeout: number;
  healthCheck: string;
}

/**
 * Services configuration interface
 */
interface ServicesConfig {
  form: ServiceConfig;
  sms: ServiceConfig;
  ai: ServiceConfig;
  analytics: ServiceConfig;
}

/**
 * Complete configuration interface
 */
interface Config {
  server: ServerConfig;
  auth: AuthConfig;
  rateLimit: RateLimitConfig;
  services: ServicesConfig;
}

/**
 * Comprehensive Joi validation schema for all configuration values
 */
const CONFIG_SCHEMA = joi.object({
  server: joi.object({
    port: joi.number()
      .required()
      .min(1024)
      .max(65535)
      .message('Server port must be between 1024 and 65535'),
    env: joi.string()
      .valid('development', 'staging', 'production')
      .required()
      .message('Invalid environment specified'),
    apiPrefix: joi.string()
      .required()
      .pattern(/^\/api\/v[0-9]+$/)
      .message('API prefix must match pattern /api/v{number}'),
    corsOrigins: joi.array()
      .items(joi.string().uri())
      .required()
      .message('CORS origins must be valid URIs')
  }),
  auth: joi.object({
    JWT_SECRET: joi.string()
      .required()
      .min(32)
      .message('JWT secret must be at least 32 characters'),
    JWT_EXPIRY: joi.string()
      .required()
      .pattern(/^[0-9]+[hdwmy]$/)
      .message('JWT expiry must be in format {number}[h|d|w|m|y]'),
    REFRESH_TOKEN_EXPIRY: joi.string()
      .required()
      .pattern(/^[0-9]+[hdwmy]$/)
      .message('Refresh token expiry must be in format {number}[h|d|w|m|y]'),
    secretRotationInterval: joi.string()
      .required()
      .pattern(/^[0-9]+[hdwmy]$/)
      .message('Secret rotation interval must be in format {number}[h|d|w|m|y]')
  }),
  rateLimit: joi.object({
    windowMs: joi.number()
      .required()
      .min(1000)
      .message('Rate limit window must be at least 1000ms'),
    maxRequests: joi.number()
      .required()
      .min(1)
      .message('Maximum requests must be at least 1'),
    blockDuration: joi.number()
      .required()
      .min(0)
      .message('Block duration must be non-negative'),
    trustProxy: joi.boolean()
      .required(),
    skipPaths: joi.array()
      .items(joi.string())
  }),
  services: joi.object({
    form: joi.object({
      url: joi.string().required().uri(),
      timeout: joi.number().required().min(100),
      healthCheck: joi.string().required().uri()
    }),
    sms: joi.object({
      url: joi.string().required().uri(),
      timeout: joi.number().required().min(100),
      healthCheck: joi.string().required().uri()
    }),
    ai: joi.object({
      url: joi.string().required().uri(),
      timeout: joi.number().required().min(100),
      healthCheck: joi.string().required().uri()
    }),
    analytics: joi.object({
      url: joi.string().required().uri(),
      timeout: joi.number().required().min(100),
      healthCheck: joi.string().required().uri()
    })
  })
});

/**
 * Validates configuration object against schema
 * @param config - Configuration object to validate
 * @returns Validated configuration object
 * @throws Error if validation fails
 */
function validateConfig(config: Record<string, any>): Config {
  const { error, value } = CONFIG_SCHEMA.validate(config, {
    abortEarly: false,
    stripUnknown: true
  });

  if (error) {
    logger.error('Configuration validation failed', error, {
      details: error.details
    });
    throw new Error(`Configuration validation failed: ${error.message}`);
  }

  logger.info('Configuration validated successfully');
  return value as Config;
}

/**
 * Loads and validates environment configuration
 * @returns Validated configuration object
 * @throws Error if required environment variables are missing
 */
function loadConfig(): Config {
  // Load environment variables
  dotenv.config();

  const config = {
    server: {
      port: parseInt(process.env.PORT || '3000', 10),
      env: (process.env.NODE_ENV || ENVIRONMENT.DEVELOPMENT) as Environment,
      apiPrefix: process.env.API_PREFIX || '/api/v1',
      corsOrigins: (process.env.CORS_ORIGINS || '').split(',').filter(Boolean)
    },
    auth: {
      JWT_SECRET: process.env.JWT_SECRET!,
      JWT_EXPIRY: process.env.JWT_EXPIRY || '1h',
      REFRESH_TOKEN_EXPIRY: process.env.REFRESH_TOKEN_EXPIRY || '7d',
      secretRotationInterval: process.env.SECRET_ROTATION_INTERVAL || '30d'
    },
    rateLimit: {
      windowMs: API_CONFIG.RATE_LIMIT_WINDOW,
      maxRequests: API_CONFIG.MAX_REQUESTS,
      blockDuration: parseInt(process.env.RATE_LIMIT_BLOCK_DURATION || '900000', 10),
      trustProxy: process.env.TRUST_PROXY === 'true',
      skipPaths: (process.env.RATE_LIMIT_SKIP_PATHS || '').split(',').filter(Boolean)
    },
    services: {
      form: {
        url: process.env.FORM_SERVICE_URL!,
        timeout: parseInt(process.env.FORM_SERVICE_TIMEOUT || '5000', 10),
        healthCheck: process.env.FORM_SERVICE_HEALTH_CHECK!
      },
      sms: {
        url: process.env.SMS_SERVICE_URL!,
        timeout: parseInt(process.env.SMS_SERVICE_TIMEOUT || '5000', 10),
        healthCheck: process.env.SMS_SERVICE_HEALTH_CHECK!
      },
      ai: {
        url: process.env.AI_SERVICE_URL!,
        timeout: parseInt(process.env.AI_SERVICE_TIMEOUT || '5000', 10),
        healthCheck: process.env.AI_SERVICE_HEALTH_CHECK!
      },
      analytics: {
        url: process.env.ANALYTICS_SERVICE_URL!,
        timeout: parseInt(process.env.ANALYTICS_SERVICE_TIMEOUT || '5000', 10),
        healthCheck: process.env.ANALYTICS_SERVICE_HEALTH_CHECK!
      }
    }
  };

  return validateConfig(config);
}

// Load and validate configuration
const config = loadConfig();

// Prevent modifications to configuration object
Object.freeze(config);
Object.freeze(config.server);
Object.freeze(config.auth);
Object.freeze(config.rateLimit);
Object.freeze(config.services);

export default config;