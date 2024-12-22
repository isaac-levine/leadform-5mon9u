/**
 * @fileoverview Configuration module for the form service
 * @version 1.0.0
 * 
 * Enhanced configuration module that provides environment-specific settings,
 * database connections, validation rules, and service limits with support for:
 * - High availability (99.9% uptime requirement)
 * - Performance monitoring
 * - Security features
 * - Connection pooling
 * - Redis cluster support
 */

import { config as dotenv } from 'dotenv'; // v16.3.1
import { ENVIRONMENT, FORM_CONFIG } from '../../../shared/constants';
import type { FormSchema } from '../../../shared/types/form.types';

// Load environment variables
dotenv();

/**
 * Database configuration with connection pooling and high availability settings
 */
const DATABASE_CONFIG = {
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'forms',
  username: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD,
  ssl: process.env.NODE_ENV === 'production',
  pool: {
    max: parseInt(process.env.DB_POOL_MAX || '20'),
    min: parseInt(process.env.DB_POOL_MIN || '5'),
    idle: 10000,
    acquire: 30000,
    evict: 1000,
    handleDisconnects: true,
    validateConnection: true,
    rejectUnauthorized: process.env.NODE_ENV === 'production'
  },
  dialectOptions: {
    statement_timeout: 10000,
    idle_in_transaction_session_timeout: 10000,
    ssl: process.env.NODE_ENV === 'production' ? {
      require: true,
      rejectUnauthorized: false
    } : false
  }
};

/**
 * Redis configuration with cluster support and health monitoring
 */
const REDIS_CONFIG = {
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  password: process.env.REDIS_PASSWORD,
  db: parseInt(process.env.REDIS_DB || '0'),
  keyPrefix: 'form_service:',
  cluster: {
    enabled: process.env.REDIS_CLUSTER_ENABLED === 'true',
    nodes: process.env.REDIS_CLUSTER_NODES?.split(',') || [],
    options: {
      maxRedirections: 3,
      retryDelayOnFailover: 1000,
      retryDelayOnClusterDown: 1000,
      enableReadyCheck: true,
      scaleReads: 'slave'
    }
  },
  healthCheck: {
    enabled: true,
    intervalMs: 5000,
    timeoutMs: 1000,
    maxFailures: 3
  },
  retryStrategy: (times: number) => {
    return Math.min(times * 100, 3000);
  }
};

/**
 * Service limits and validation configuration
 */
const LIMITS_CONFIG = {
  maxFields: FORM_CONFIG.MAX_FIELDS,
  maxFieldLength: FORM_CONFIG.MAX_FIELD_LENGTH,
  allowedFileTypes: FORM_CONFIG.ALLOWED_FILE_TYPES,
  maxRequestSize: '10mb',
  rateLimit: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // limit each IP to 100 requests per windowMs
    standardHeaders: true,
    legacyHeaders: false
  },
  validation: {
    timeout: 5000,
    batchSize: 100,
    retryAttempts: 3
  }
};

/**
 * Monitoring and observability configuration
 */
const MONITORING_CONFIG = {
  metrics: {
    enabled: true,
    interval: 10000,
    prefix: 'form_service_',
    defaultLabels: {
      service: 'form_service',
      version: process.env.npm_package_version
    }
  },
  tracing: {
    enabled: true,
    serviceName: 'form_service',
    samplingRate: 0.1
  },
  healthCheck: {
    enabled: true,
    path: '/health',
    interval: 30000,
    timeout: 5000
  },
  logging: {
    level: process.env.LOG_LEVEL || 'info',
    format: process.env.NODE_ENV === 'production' ? 'json' : 'pretty',
    correlationId: {
      enabled: true,
      header: 'x-correlation-id'
    }
  }
};

/**
 * Security configuration
 */
const SECURITY_CONFIG = {
  cors: {
    origin: process.env.CORS_ORIGIN || '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    exposedHeaders: ['X-Total-Count'],
    credentials: true,
    maxAge: 86400
  },
  helmet: {
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", 'data:', 'https:'],
        connectSrc: ["'self'"],
        fontSrc: ["'self'"],
        objectSrc: ["'none'"],
        mediaSrc: ["'self'"],
        frameSrc: ["'none'"]
      }
    },
    hsts: {
      maxAge: 31536000,
      includeSubDomains: true,
      preload: true
    }
  }
};

/**
 * Environment-specific configuration overrides
 */
const getEnvironmentConfig = () => {
  const env = process.env.NODE_ENV || 'development';
  
  switch (env) {
    case ENVIRONMENT.PRODUCTION:
      return {
        logging: {
          level: 'info',
          format: 'json'
        },
        security: {
          cors: {
            origin: process.env.CORS_ORIGIN
          }
        }
      };
    case ENVIRONMENT.DEVELOPMENT:
      return {
        logging: {
          level: 'debug',
          format: 'pretty'
        },
        security: {
          cors: {
            origin: '*'
          }
        }
      };
    default:
      return {};
  }
};

/**
 * Configuration validation function
 */
const validateConfig = (config: Record<string, any>): boolean => {
  const requiredFields = [
    'database.host',
    'database.port',
    'database.database',
    'redis.host',
    'redis.port'
  ];

  return requiredFields.every(field => {
    const value = field.split('.').reduce((obj, key) => obj?.[key], config);
    return value !== undefined && value !== null;
  });
};

/**
 * Exported configuration object with all settings
 */
export const config = {
  env: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT || '3001'),
  host: process.env.HOST || '0.0.0.0',
  database: DATABASE_CONFIG,
  redis: REDIS_CONFIG,
  limits: LIMITS_CONFIG,
  monitoring: MONITORING_CONFIG,
  security: SECURITY_CONFIG,
  ...getEnvironmentConfig()
};

// Validate configuration
if (!validateConfig(config)) {
  throw new Error('Invalid configuration: Missing required fields');
}

// Freeze configuration to prevent runtime modifications
Object.freeze(config);