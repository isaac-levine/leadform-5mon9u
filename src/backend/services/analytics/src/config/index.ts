/**
 * @fileoverview Configuration module for the analytics service
 * @version 1.0.0
 * 
 * Provides comprehensive configuration for the analytics service including:
 * - Environment settings
 * - Database configuration (TimescaleDB and Redis)
 * - Metrics configuration and thresholds
 * - Performance monitoring settings
 * - Data retention policies
 */

import { config as dotenvConfig } from 'dotenv'; // v16.3.1
import { ENVIRONMENT } from '../../shared/constants';
import { MetricType } from '../../shared/types/analytics.types';

// Load environment variables
dotenvConfig();

/**
 * Interface for TimescaleDB configuration
 */
interface TimescaleDBConfig {
  host: string;
  port: number;
  database: string;
  username: string;
  password: string;
  maxConnections: number;
  idleTimeout: number;
  connectionTimeout: number;
  statementTimeout: number;
  retentionPolicy: {
    rawDataDays: number;
    aggregatedDataDays: number;
  };
}

/**
 * Interface for Redis cache configuration
 */
interface RedisCacheConfig {
  host: string;
  port: number;
  password: string;
  ttl: number;
  maxKeys: number;
  keyPrefix: string;
  compressionEnabled: boolean;
  maxMemoryPolicy: string;
}

/**
 * Interface for metrics configuration
 */
interface MetricsConfig {
  aggregationIntervals: {
    hourly: number;
    daily: number;
    weekly: number;
    monthly: number;
  };
  retentionPeriods: {
    rawData: number;
    hourly: number;
    daily: number;
    weekly: number;
    monthly: number;
  };
  performanceThresholds: {
    responseTimeMs: number;
    leadEngagementPercent: number;
    conversionRatePercent: number;
    aiConfidencePercent: number;
    systemUptimePercent: number;
  };
}

/**
 * Interface for database configuration
 */
interface DatabaseConfig {
  timescaleDb: TimescaleDBConfig;
  redisCache: RedisCacheConfig;
}

/**
 * Interface for validation configuration
 */
interface ValidationConfig {
  minConfidenceScore: number;
  maxMetricAge: number;
  requiredFields: string[];
}

/**
 * Main configuration interface
 */
interface Config {
  env: ENVIRONMENT;
  port: number;
  metrics: MetricsConfig;
  database: DatabaseConfig;
  validation: ValidationConfig;
}

/**
 * Validates the configuration object
 * @param config Configuration object to validate
 * @throws Error if configuration is invalid
 */
const validateConfig = (config: Partial<Config>): void => {
  if (!config.env || !Object.values(ENVIRONMENT).includes(config.env)) {
    throw new Error('Invalid environment configuration');
  }

  if (!config.port || config.port < 1024 || config.port > 65535) {
    throw new Error('Invalid port configuration');
  }

  // Validate database configuration
  if (!config.database?.timescaleDb?.host || !config.database?.redisCache?.host) {
    throw new Error('Invalid database configuration');
  }

  // Validate metrics thresholds
  const { performanceThresholds } = config.metrics || {};
  if (!performanceThresholds?.responseTimeMs || performanceThresholds.responseTimeMs > 500) {
    throw new Error('Invalid response time threshold');
  }
};

/**
 * Loads and validates the configuration
 */
const loadConfig = (): Config => {
  const config: Config = {
    env: (process.env.NODE_ENV as ENVIRONMENT) || ENVIRONMENT.DEVELOPMENT,
    port: parseInt(process.env.PORT || '3000', 10),
    metrics: {
      aggregationIntervals: {
        hourly: 3600,    // 1 hour in seconds
        daily: 86400,    // 24 hours in seconds
        weekly: 604800,  // 7 days in seconds
        monthly: 2592000 // 30 days in seconds
      },
      retentionPeriods: {
        rawData: 30,    // 30 days for raw data
        hourly: 90,     // 90 days for hourly aggregates
        daily: 365,     // 1 year for daily aggregates
        weekly: 730,    // 2 years for weekly aggregates
        monthly: 1095   // 3 years for monthly aggregates
      },
      performanceThresholds: {
        responseTimeMs: 500,           // Technical requirement: <500ms
        leadEngagementPercent: 80,     // Technical requirement: 80% response rate
        conversionRatePercent: 25,     // Technical requirement: 25% improvement
        aiConfidencePercent: 90,       // AI confidence threshold
        systemUptimePercent: 99.9      // Technical requirement: 99.9% uptime
      }
    },
    database: {
      timescaleDb: {
        host: process.env.TIMESCALE_HOST || 'localhost',
        port: parseInt(process.env.TIMESCALE_PORT || '5432', 10),
        database: process.env.TIMESCALE_DB || 'analytics',
        username: process.env.TIMESCALE_USER || 'postgres',
        password: process.env.TIMESCALE_PASSWORD || '',
        maxConnections: 20,
        idleTimeout: 10000,
        connectionTimeout: 2000,
        statementTimeout: 5000,
        retentionPolicy: {
          rawDataDays: 30,
          aggregatedDataDays: 365
        }
      },
      redisCache: {
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT || '6379', 10),
        password: process.env.REDIS_PASSWORD || '',
        ttl: 300,                // 5 minutes cache TTL
        maxKeys: 10000,          // Maximum number of cached keys
        keyPrefix: 'analytics:', // Prefix for all cache keys
        compressionEnabled: true,
        maxMemoryPolicy: 'allkeys-lru'
      }
    },
    validation: {
      minConfidenceScore: 0.85,
      maxMetricAge: 365 * 24 * 60 * 60, // 1 year in seconds
      requiredFields: ['timestamp', 'value', 'metricType']
    }
  };

  validateConfig(config);
  return config;
};

// Export the configuration object
export const config = loadConfig();

// Export specific configuration types for use in other modules
export type {
  Config,
  MetricsConfig,
  DatabaseConfig,
  ValidationConfig,
  TimescaleDBConfig,
  RedisCacheConfig
};