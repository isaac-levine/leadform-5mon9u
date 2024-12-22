/**
 * Analytics Aggregation Service
 * Provides high-performance metric aggregation with caching support
 * @version 1.0.0
 */

import { Repository } from 'typeorm'; // v0.3.17
import { InjectRepository } from 'typeorm-typedi-extensions'; // v0.4.1
import { Service } from 'typedi'; // v0.10.0
import { Redis } from 'ioredis'; // v5.3.0
import { Worker } from 'worker_threads';
import { Logger } from 'winston'; // v3.10.0
import { MetricModel } from '../models/metric.model';
import {
  MetricType,
  TimeRange,
  MetricData,
  MetricValue,
  MetricAggregations,
  AnalyticsOverview
} from '../../../shared/types/analytics.types';

@Service()
export class AggregationService {
  private readonly logger: Logger;
  private readonly cachePrefix = 'analytics:';
  private readonly cacheTTL = 300; // 5 minutes
  private readonly redis: Redis;

  constructor(
    @InjectRepository(MetricModel)
    private readonly metricRepository: Repository<MetricModel>,
    private readonly redis: Redis
  ) {
    this.logger = new Logger({
      level: 'info',
      defaultMeta: { service: 'AggregationService' }
    });
    this.redis = redis;
  }

  /**
   * Aggregates metrics with caching support
   * @param organizationId - Organization UUID
   * @param type - Type of metric to aggregate
   * @param timeRange - Time range for aggregation
   * @returns Promise<MetricData>
   */
  async aggregateMetrics(
    organizationId: string,
    type: MetricType,
    timeRange: TimeRange
  ): Promise<MetricData> {
    try {
      // Check cache first
      const cacheKey = `${this.cachePrefix}${organizationId}:${type}:${timeRange}`;
      const cachedData = await this.redis.get(cacheKey);
      
      if (cachedData) {
        return JSON.parse(cachedData);
      }

      // Query metrics from database
      const metrics = await this.metricRepository.find({
        where: {
          organizationId,
          type,
          timeRange
        },
        order: {
          timestamp: 'ASC'
        }
      });

      // Transform to MetricValue array
      const values: MetricValue[] = metrics.map(metric => ({
        value: metric.value,
        timestamp: metric.timestamp,
        confidence: this.calculateConfidence(metric),
        metadata: {}
      }));

      // Calculate aggregations using worker threads for performance
      const aggregations = await this.calculateAggregations(values);

      const metricData: MetricData = {
        type,
        values,
        timeRange,
        aggregations
      };

      // Cache the results
      await this.redis.setex(
        cacheKey,
        this.cacheTTL,
        JSON.stringify(metricData)
      );

      return metricData;
    } catch (error) {
      this.logger.error('Error aggregating metrics', {
        organizationId,
        type,
        timeRange,
        error
      });
      throw error;
    }
  }

  /**
   * Retrieves comprehensive analytics overview
   * @param organizationId - Organization UUID
   * @returns Promise<AnalyticsOverview>
   */
  async getAnalyticsOverview(
    organizationId: string
  ): Promise<AnalyticsOverview> {
    try {
      const cacheKey = `${this.cachePrefix}overview:${organizationId}`;
      const cachedOverview = await this.redis.get(cacheKey);

      if (cachedOverview) {
        return JSON.parse(cachedOverview);
      }

      // Parallel processing of all metric types
      const [
        responseTime,
        leadEngagement,
        conversionRate,
        aiConfidence,
        leadQuality,
        systemUptime,
        userAdoption
      ] = await Promise.all([
        this.aggregateMetrics(organizationId, MetricType.RESPONSE_TIME, TimeRange.DAY),
        this.aggregateMetrics(organizationId, MetricType.LEAD_ENGAGEMENT, TimeRange.DAY),
        this.aggregateMetrics(organizationId, MetricType.CONVERSION_RATE, TimeRange.DAY),
        this.aggregateMetrics(organizationId, MetricType.AI_CONFIDENCE, TimeRange.DAY),
        this.aggregateMetrics(organizationId, MetricType.LEAD_QUALITY, TimeRange.DAY),
        this.aggregateMetrics(organizationId, MetricType.SYSTEM_UPTIME, TimeRange.DAY),
        this.aggregateMetrics(organizationId, MetricType.USER_ADOPTION, TimeRange.DAY)
      ]);

      const overview: AnalyticsOverview = {
        responseTime,
        leadEngagement,
        conversionRate,
        aiConfidence,
        leadQuality,
        systemUptime,
        userAdoption
      };

      // Cache the overview
      await this.redis.setex(
        cacheKey,
        this.cacheTTL,
        JSON.stringify(overview)
      );

      return overview;
    } catch (error) {
      this.logger.error('Error generating analytics overview', {
        organizationId,
        error
      });
      throw error;
    }
  }

  /**
   * Calculates statistical aggregations using worker threads
   * @param values - Array of metric values
   * @returns Promise<MetricAggregations>
   */
  private async calculateAggregations(
    values: MetricValue[]
  ): Promise<MetricAggregations> {
    return new Promise((resolve, reject) => {
      const worker = new Worker(
        `${__dirname}/workers/aggregation.worker.js`,
        {
          workerData: { values }
        }
      );

      worker.on('message', (aggregations: MetricAggregations) => {
        resolve(aggregations);
      });

      worker.on('error', (error) => {
        this.logger.error('Worker thread error', { error });
        reject(error);
      });
    });
  }

  /**
   * Calculates confidence score for a metric
   * @param metric - Metric model instance
   * @returns number between 0 and 1
   */
  private calculateConfidence(metric: MetricModel): number {
    // Base confidence calculation
    let confidence = 1.0;

    // Adjust confidence based on metric age
    const age = Date.now() - metric.timestamp.getTime();
    const maxAge = 24 * 60 * 60 * 1000; // 24 hours
    if (age > maxAge) {
      confidence *= 0.5;
    }

    // Adjust confidence based on metric type
    switch (metric.type) {
      case MetricType.RESPONSE_TIME:
        confidence *= metric.value <= 500 ? 1.0 : 0.8;
        break;
      case MetricType.LEAD_ENGAGEMENT:
        confidence *= metric.value >= 80 ? 1.0 : 0.9;
        break;
      case MetricType.CONVERSION_RATE:
        confidence *= metric.value >= 25 ? 1.0 : 0.9;
        break;
      case MetricType.SYSTEM_UPTIME:
        confidence *= metric.value >= 99.9 ? 1.0 : 0.7;
        break;
      default:
        confidence *= 0.95;
    }

    return Math.max(0, Math.min(1, confidence));
  }
}