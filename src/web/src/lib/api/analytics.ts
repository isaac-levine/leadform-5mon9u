/**
 * @fileoverview Analytics API client module for fetching metrics and analytics data
 * with enhanced error handling, caching, and retry logic.
 * @version 1.0.0
 */

import axios, { AxiosError, AxiosRequestConfig } from 'axios'; // axios ^1.6.0
import { MetricType, TimeRange, AnalyticsOverview, MetricData, MetricValue } from '../../types/analytics';
import { METRIC_LABELS } from '../constants/analytics';

// API Configuration
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api';
const ANALYTICS_ENDPOINTS = {
  OVERVIEW: '/analytics/overview',
  METRICS: '/analytics/metrics',
  LEAD_QUALITY: '/analytics/leads/quality',
  AI_PERFORMANCE: '/analytics/ai/performance'
} as const;

// Request Configuration
const REQUEST_CONFIG: RequestConfig = {
  timeout: 5000,
  retries: 3,
  cacheTimeout: 300000 // 5 minutes
};

// Types
interface RequestOptions {
  polling?: boolean;
  pollingInterval?: number;
  skipCache?: boolean;
  signal?: AbortSignal;
}

interface RequestConfig {
  timeout: number;
  retries: number;
  cacheTimeout: number;
}

interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

// Cache implementation
const cache = new Map<string, CacheEntry<any>>();

/**
 * Generates a cache key based on endpoint and parameters
 */
const generateCacheKey = (endpoint: string, params: object): string => {
  return `${endpoint}:${JSON.stringify(params)}`;
};

/**
 * Checks if cached data is still valid
 */
const isCacheValid = (timestamp: number): boolean => {
  return Date.now() - timestamp < REQUEST_CONFIG.cacheTimeout;
};

/**
 * Makes an HTTP request with retry logic
 */
async function makeRequest<T>(
  endpoint: string,
  config: AxiosRequestConfig,
  retries: number = REQUEST_CONFIG.retries
): Promise<T> {
  try {
    const response = await axios({
      ...config,
      url: `${API_BASE_URL}${endpoint}`,
      timeout: REQUEST_CONFIG.timeout
    });
    return response.data;
  } catch (error) {
    if (error instanceof AxiosError) {
      if (retries > 0 && error.response?.status >= 500) {
        // Exponential backoff
        const delay = Math.pow(2, REQUEST_CONFIG.retries - retries) * 1000;
        await new Promise(resolve => setTimeout(resolve, delay));
        return makeRequest(endpoint, config, retries - 1);
      }
      
      // Handle specific error cases
      switch (error.response?.status) {
        case 429:
          throw new Error('Rate limit exceeded. Please try again later.');
        case 401:
          throw new Error('Unauthorized access to analytics data.');
        case 403:
          throw new Error('Insufficient permissions to access analytics data.');
        default:
          throw new Error(`Failed to fetch analytics data: ${error.message}`);
      }
    }
    throw error;
  }
}

/**
 * Fetches overview analytics data including all key metrics
 * @param timeRange - Time range for the analytics data
 * @param options - Request options including polling and caching preferences
 */
export async function getAnalyticsOverview(
  timeRange: TimeRange,
  options: RequestOptions = {}
): Promise<AnalyticsOverview> {
  const params = { timeRange };
  const cacheKey = generateCacheKey(ANALYTICS_ENDPOINTS.OVERVIEW, params);

  // Check cache unless explicitly skipped
  if (!options.skipCache) {
    const cached = cache.get(cacheKey);
    if (cached && isCacheValid(cached.timestamp)) {
      return cached.data;
    }
  }

  const config: AxiosRequestConfig = {
    method: 'GET',
    params,
    signal: options.signal
  };

  const data = await makeRequest<AnalyticsOverview>(ANALYTICS_ENDPOINTS.OVERVIEW, config);

  // Cache successful response
  cache.set(cacheKey, {
    data,
    timestamp: Date.now()
  });

  // Setup polling if requested
  if (options.polling) {
    const interval = options.pollingInterval || 30000;
    const pollTimer = setInterval(async () => {
      try {
        const freshData = await makeRequest<AnalyticsOverview>(
          ANALYTICS_ENDPOINTS.OVERVIEW,
          config
        );
        cache.set(cacheKey, {
          data: freshData,
          timestamp: Date.now()
        });
      } catch (error) {
        console.error('Polling error:', error);
      }
    }, interval);

    // Cleanup polling on abort
    options.signal?.addEventListener('abort', () => clearInterval(pollTimer));
  }

  return data;
}

/**
 * Fetches data for specific metrics with batch support
 * @param metricTypes - Array of metric types to fetch
 * @param timeRange - Time range for the metric data
 * @param options - Request options including polling and caching preferences
 */
export async function getMetricData(
  metricTypes: MetricType[],
  timeRange: TimeRange,
  options: RequestOptions = {}
): Promise<MetricData[]> {
  const params = {
    metrics: metricTypes,
    timeRange
  };
  const cacheKey = generateCacheKey(ANALYTICS_ENDPOINTS.METRICS, params);

  // Check cache unless explicitly skipped
  if (!options.skipCache) {
    const cached = cache.get(cacheKey);
    if (cached && isCacheValid(cached.timestamp)) {
      return cached.data;
    }
  }

  const config: AxiosRequestConfig = {
    method: 'GET',
    params,
    signal: options.signal
  };

  const data = await makeRequest<MetricData[]>(ANALYTICS_ENDPOINTS.METRICS, config);

  // Validate and transform response data
  const transformedData = data.map(metric => ({
    ...metric,
    values: metric.values.map(value => ({
      ...value,
      timestamp: new Date(value.timestamp)
    }))
  }));

  // Cache successful response
  cache.set(cacheKey, {
    data: transformedData,
    timestamp: Date.now()
  });

  // Setup polling if requested
  if (options.polling) {
    const interval = options.pollingInterval || 30000;
    const pollTimer = setInterval(async () => {
      try {
        const freshData = await makeRequest<MetricData[]>(
          ANALYTICS_ENDPOINTS.METRICS,
          config
        );
        cache.set(cacheKey, {
          data: freshData,
          timestamp: Date.now()
        });
      } catch (error) {
        console.error('Polling error:', error);
      }
    }, interval);

    // Cleanup polling on abort
    options.signal?.addEventListener('abort', () => clearInterval(pollTimer));
  }

  return transformedData;
}