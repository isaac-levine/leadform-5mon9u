/**
 * @fileoverview Distributed rate limiting middleware using Redis
 * @version 1.0.0
 * 
 * Implements distributed request rate limiting using Redis to protect backend services
 * from abuse and ensure fair resource usage across clients in a multi-instance environment.
 */

import rateLimit from 'express-rate-limit'; // v7.1.0
import RedisStore from 'rate-limit-redis'; // v4.0.0
import Redis from 'ioredis'; // v5.3.2
import { StatusCodes } from 'http-status-codes'; // v2.2.0
import { Logger } from '../../../../shared/utils/logger';
import { createError } from '../../../../shared/utils/error-handler';
import config from '../config';

// Initialize logger
const logger = new Logger('RateLimitMiddleware', 'ApiGateway');

// Constants
const RATE_LIMIT_ERROR_CODE = 'TOO_MANY_REQUESTS';
const RATE_LIMIT_ERROR_MESSAGE = 'Too many requests, please try again later';
const REDIS_RECONNECT_DELAY = 5000;
const MAX_RECONNECT_ATTEMPTS = 10;
const RATE_LIMIT_KEY_PREFIX = 'rl:';

/**
 * Interface for rate limit configuration options
 */
interface RateLimitOptions {
  windowMs: number;
  maxRequests: number;
  blockDuration: number;
  skipPaths: string[];
  trustProxy: boolean;
  headers: boolean;
}

/**
 * Interface for Redis connection configuration
 */
interface RedisConfig {
  host: string;
  port: number;
  password: string;
  tls: boolean;
  cluster: boolean;
}

/**
 * Enhanced Redis store implementation for distributed rate limiting
 */
class RateLimitStore {
  private redisClient: Redis;
  private reconnectAttempts: number = 0;
  private isConnected: boolean = false;

  constructor(redisClient: Redis, config: RedisConfig) {
    this.redisClient = redisClient;

    // Set up connection event handlers
    this.redisClient.on('connect', () => {
      this.isConnected = true;
      this.reconnectAttempts = 0;
      logger.info('Redis connection established', { host: config.host, port: config.port });
    });

    this.redisClient.on('error', (error) => {
      logger.error('Redis connection error', error, { host: config.host, port: config.port });
      this.isConnected = false;
      this.handleReconnect();
    });

    this.redisClient.on('close', () => {
      this.isConnected = false;
      logger.warn('Redis connection closed', { host: config.host, port: config.port });
    });
  }

  /**
   * Handles Redis reconnection with exponential backoff
   */
  private async handleReconnect(): Promise<void> {
    if (this.reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
      logger.error('Max Redis reconnection attempts reached', new Error('Redis reconnection failed'));
      return;
    }

    this.reconnectAttempts++;
    const delay = REDIS_RECONNECT_DELAY * Math.pow(2, this.reconnectAttempts - 1);

    setTimeout(() => {
      logger.info('Attempting Redis reconnection', { attempt: this.reconnectAttempts });
      this.redisClient.connect();
    }, delay);
  }

  /**
   * Increments rate limit counter with proper error handling
   */
  async increment(key: string): Promise<number> {
    if (!this.isConnected) {
      throw new Error('Redis connection not available');
    }

    const prefixedKey = `${RATE_LIMIT_KEY_PREFIX}${key}`;
    try {
      const multi = this.redisClient.multi();
      multi.incr(prefixedKey);
      multi.pexpire(prefixedKey, config.rateLimit.windowMs);
      
      const results = await multi.exec();
      return results ? (results[0][1] as number) : 0;
    } catch (error) {
      logger.error('Redis increment operation failed', error as Error);
      throw error;
    }
  }

  /**
   * Decrements rate limit counter
   */
  async decrement(key: string): Promise<void> {
    if (!this.isConnected) {
      throw new Error('Redis connection not available');
    }

    const prefixedKey = `${RATE_LIMIT_KEY_PREFIX}${key}`;
    try {
      await this.redisClient.decr(prefixedKey);
    } catch (error) {
      logger.error('Redis decrement operation failed', error as Error);
      throw error;
    }
  }

  /**
   * Resets rate limit counter
   */
  async resetKey(key: string): Promise<void> {
    if (!this.isConnected) {
      throw new Error('Redis connection not available');
    }

    const prefixedKey = `${RATE_LIMIT_KEY_PREFIX}${key}`;
    try {
      await this.redisClient.del(prefixedKey);
      logger.info('Rate limit key reset', { key: prefixedKey });
    } catch (error) {
      logger.error('Redis reset operation failed', error as Error);
      throw error;
    }
  }
}

/**
 * Creates and configures the distributed rate limiting middleware
 */
export function createRateLimitMiddleware(options: RateLimitOptions) {
  // Initialize Redis client with cluster support if configured
  const redisClient = new Redis({
    host: config.redis.host,
    port: config.redis.port,
    password: config.redis.password,
    tls: config.redis.tls,
    lazyConnect: true,
    retryStrategy: (times: number) => {
      if (times > MAX_RECONNECT_ATTEMPTS) return null;
      return Math.min(times * 1000, REDIS_RECONNECT_DELAY);
    }
  });

  // Initialize Redis store
  const store = new RateLimitStore(redisClient, config.redis);

  // Configure rate limit middleware
  return rateLimit({
    windowMs: options.windowMs,
    max: options.maxRequests,
    standardHeaders: options.headers,
    legacyHeaders: false,
    skipFailedRequests: false,
    skipSuccessfulRequests: false,
    trustProxy: options.trustProxy,
    skip: (req) => options.skipPaths.some(path => req.path.startsWith(path)),
    store: new RedisStore({
      sendCommand: (...args: string[]) => redisClient.call(...args),
      prefix: RATE_LIMIT_KEY_PREFIX
    }),
    handler: (req, res) => {
      const error = createError(
        RATE_LIMIT_ERROR_MESSAGE,
        StatusCodes.TOO_MANY_REQUESTS,
        RATE_LIMIT_ERROR_CODE,
        'warning',
        {
          path: req.path,
          method: req.method,
          ip: req.ip
        }
      );
      
      logger.warn('Rate limit exceeded', {
        path: req.path,
        method: req.method,
        ip: req.ip
      });

      res.status(StatusCodes.TOO_MANY_REQUESTS).json(error);
    }
  });
}

// Export configured middleware instance
export const rateLimitMiddleware = createRateLimitMiddleware({
  windowMs: config.rateLimit.windowMs,
  maxRequests: config.rateLimit.maxRequests,
  blockDuration: config.rateLimit.blockDuration,
  skipPaths: config.rateLimit.skipPaths,
  trustProxy: config.rateLimit.trustProxy,
  headers: true
});