/**
 * Analytics Metrics Controller
 * Handles analytics metrics endpoints with enhanced organization filtering and caching
 * @version 1.0.0
 */

import { Controller, Get, Query, UseGuards, UseInterceptors, UsePipes } from '@nestjs/common'; // v10.0.0
import { AggregationService } from '../services/aggregation.service';
import { MetricType, TimeRange } from '../../../shared/types/analytics.types';
import { handleError } from '../../../shared/utils/error-handler';
import { Logger } from '../../../shared/utils/logger';
import { AuthGuard } from '../guards/auth.guard';
import { CacheInterceptor, ThrottleInterceptor } from '../interceptors';
import { ValidationPipe } from '../pipes/validation.pipe';
import { ERROR_THRESHOLDS } from '../../../shared/constants';

@Controller('metrics')
@UseGuards(AuthGuard)
@UseInterceptors(CacheInterceptor)
export class MetricsController {
  private readonly logger: Logger;

  constructor(
    private readonly aggregationService: AggregationService
  ) {
    this.logger = new Logger('MetricsController', 'analytics-service');
  }

  /**
   * Retrieves metrics with organization filtering and caching
   * @param organizationId - Organization UUID
   * @param type - Type of metric to retrieve
   * @param timeRange - Time range for metrics
   * @returns Promise<MetricData>
   */
  @Get()
  @UseGuards(AuthGuard)
  @UseInterceptors(ThrottleInterceptor)
  @UsePipes(ValidationPipe)
  async getMetrics(
    @Query('organizationId') organizationId: string,
    @Query('type') type: MetricType,
    @Query('timeRange') timeRange: TimeRange
  ) {
    try {
      this.logger.info('Retrieving metrics', {
        organizationId,
        type,
        timeRange,
        correlationId: process.env.CORRELATION_ID
      });

      // Validate input parameters
      if (!organizationId || !type || !timeRange) {
        throw new Error('Missing required parameters');
      }

      // Get metrics with caching
      const metrics = await this.aggregationService.aggregateMetrics(
        organizationId,
        type,
        timeRange
      );

      // Log success
      this.logger.info('Metrics retrieved successfully', {
        organizationId,
        type,
        timeRange,
        metricCount: metrics.values.length
      });

      return metrics;
    } catch (error) {
      this.logger.error('Error retrieving metrics', error, {
        organizationId,
        type,
        timeRange
      });

      // Handle error with correlation ID
      return handleError(error, {
        path: 'metrics.getMetrics',
        organizationId,
        type,
        timeRange
      });
    }
  }

  /**
   * Retrieves comprehensive analytics overview with parallel processing
   * @param organizationId - Organization UUID
   * @returns Promise<AnalyticsOverview>
   */
  @Get('overview')
  @UseGuards(AuthGuard)
  @UseInterceptors(CacheInterceptor)
  @UsePipes(ValidationPipe)
  async getOverview(
    @Query('organizationId') organizationId: string
  ) {
    try {
      this.logger.info('Retrieving analytics overview', {
        organizationId,
        correlationId: process.env.CORRELATION_ID
      });

      // Validate organization ID
      if (!organizationId) {
        throw new Error('Missing organization ID');
      }

      // Get overview with parallel processing
      const overview = await this.aggregationService.getAnalyticsOverview(
        organizationId
      );

      // Log success with performance metrics
      this.logger.info('Analytics overview retrieved successfully', {
        organizationId,
        metrics: Object.keys(overview).length,
        processingTime: Date.now() - Number(process.env.REQUEST_START_TIME)
      });

      return overview;
    } catch (error) {
      this.logger.error('Error retrieving analytics overview', error, {
        organizationId
      });

      // Check error thresholds
      if (error.consecutiveFailures >= ERROR_THRESHOLDS.MAX_CONSECUTIVE_FAILURES) {
        this.logger.warn('Error threshold exceeded for analytics overview', {
          organizationId,
          consecutiveFailures: error.consecutiveFailures
        });
      }

      // Handle error with correlation ID
      return handleError(error, {
        path: 'metrics.getOverview',
        organizationId
      });
    }
  }
}