/**
 * Analytics Metrics Test Suite
 * Comprehensive tests for analytics metrics controller and service functionality
 * @version 1.0.0
 */

import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals'; // v29.0.0
import { Repository } from 'typeorm'; // v0.3.17
import { MetricsController } from '../src/controllers/metrics.controller';
import { AggregationService } from '../src/services/aggregation.service';
import { MetricType, TimeRange } from '../../../shared/types/analytics.types';

// Mock repository and logger
jest.mock('typeorm', () => ({
  Repository: jest.fn().mockImplementation(() => ({
    find: jest.fn(),
    findOne: jest.fn(),
    save: jest.fn()
  }))
}));

jest.mock('../../../shared/utils/logger', () => ({
  logger: {
    error: jest.fn(),
    info: jest.fn()
  }
}));

describe('MetricsController', () => {
  let metricsController: MetricsController;
  let aggregationService: AggregationService;
  let mockRepository: jest.Mocked<Repository<any>>;

  const TEST_ORG_ID = '123e4567-e89b-12d3-a456-426614174000';

  beforeEach(() => {
    // Reset mocks
    mockRepository = new Repository() as jest.Mocked<Repository<any>>;
    aggregationService = new AggregationService(mockRepository, null);
    metricsController = new MetricsController(aggregationService);

    // Clear all mock implementations
    jest.clearAllMocks();
  });

  describe('getMetrics', () => {
    it('should retrieve response time metrics within 500ms threshold', async () => {
      // Arrange
      const mockMetrics = createMockMetrics(MetricType.RESPONSE_TIME, TimeRange.HOUR);
      jest.spyOn(aggregationService, 'aggregateMetrics').mockResolvedValue(mockMetrics);

      // Act
      const start = Date.now();
      const result = await metricsController.getMetrics(
        TEST_ORG_ID,
        MetricType.RESPONSE_TIME,
        TimeRange.HOUR
      );
      const duration = Date.now() - start;

      // Assert
      expect(duration).toBeLessThan(500); // Performance requirement
      expect(result).toBeDefined();
      expect(result.type).toBe(MetricType.RESPONSE_TIME);
      expect(result.values.every(v => v.value <= 500)).toBe(true); // Response time threshold
    });

    it('should validate lead engagement metrics against 80% target', async () => {
      // Arrange
      const mockMetrics = createMockMetrics(MetricType.LEAD_ENGAGEMENT, TimeRange.DAY);
      jest.spyOn(aggregationService, 'aggregateMetrics').mockResolvedValue(mockMetrics);

      // Act
      const result = await metricsController.getMetrics(
        TEST_ORG_ID,
        MetricType.LEAD_ENGAGEMENT,
        TimeRange.DAY
      );

      // Assert
      expect(result).toBeDefined();
      expect(result.aggregations.average).toBeGreaterThanOrEqual(80); // Lead engagement target
      expect(result.values).toHaveLength(24); // 24 hourly data points
    });

    it('should verify conversion rate improvement of 25%', async () => {
      // Arrange
      const mockMetrics = createMockMetrics(MetricType.CONVERSION_RATE, TimeRange.WEEK);
      jest.spyOn(aggregationService, 'aggregateMetrics').mockResolvedValue(mockMetrics);

      // Act
      const result = await metricsController.getMetrics(
        TEST_ORG_ID,
        MetricType.CONVERSION_RATE,
        TimeRange.WEEK
      );

      // Assert
      expect(result).toBeDefined();
      const improvement = calculateImprovement(result.values);
      expect(improvement).toBeGreaterThanOrEqual(25); // Conversion rate improvement target
    });

    it('should handle invalid organization ID', async () => {
      // Act & Assert
      await expect(
        metricsController.getMetrics(
          'invalid-id',
          MetricType.RESPONSE_TIME,
          TimeRange.HOUR
        )
      ).rejects.toThrow('Invalid organization ID');
    });

    it('should handle service unavailability', async () => {
      // Arrange
      jest.spyOn(aggregationService, 'aggregateMetrics').mockRejectedValue(new Error('Service unavailable'));

      // Act & Assert
      await expect(
        metricsController.getMetrics(
          TEST_ORG_ID,
          MetricType.RESPONSE_TIME,
          TimeRange.HOUR
        )
      ).rejects.toThrow('Service unavailable');
    });
  });

  describe('getOverview', () => {
    it('should retrieve comprehensive analytics overview', async () => {
      // Arrange
      const mockOverview = createMockOverview();
      jest.spyOn(aggregationService, 'getAnalyticsOverview').mockResolvedValue(mockOverview);

      // Act
      const result = await metricsController.getOverview(TEST_ORG_ID);

      // Assert
      expect(result).toBeDefined();
      expect(result.responseTime).toBeDefined();
      expect(result.leadEngagement).toBeDefined();
      expect(result.conversionRate).toBeDefined();
      expect(result.systemUptime).toBeDefined();
      expect(result.userAdoption).toBeDefined();
    });

    it('should validate all success criteria metrics in overview', async () => {
      // Arrange
      const mockOverview = createMockOverview();
      jest.spyOn(aggregationService, 'getAnalyticsOverview').mockResolvedValue(mockOverview);

      // Act
      const result = await metricsController.getOverview(TEST_ORG_ID);

      // Assert
      expect(result.responseTime.aggregations.average).toBeLessThan(500);
      expect(result.leadEngagement.aggregations.average).toBeGreaterThanOrEqual(80);
      expect(result.systemUptime.aggregations.average).toBeGreaterThanOrEqual(99.9);
      expect(result.userAdoption.aggregations.average).toBeGreaterThanOrEqual(90);
    });

    it('should handle overview retrieval timeout', async () => {
      // Arrange
      jest.spyOn(aggregationService, 'getAnalyticsOverview').mockImplementation(() => {
        return new Promise(resolve => setTimeout(resolve, 600));
      });

      // Act & Assert
      await expect(
        metricsController.getOverview(TEST_ORG_ID)
      ).rejects.toThrow('Request timeout');
    });
  });
});

// Helper Functions

function createMockMetrics(type: MetricType, timeRange: TimeRange) {
  const values = Array.from({ length: 24 }, (_, i) => ({
    value: type === MetricType.RESPONSE_TIME ? 
      Math.random() * 400 + 100 : // Response time between 100-500ms
      Math.random() * 20 + 80,    // Other metrics between 80-100%
    timestamp: new Date(Date.now() - i * 3600000),
    confidence: 0.95,
    metadata: {}
  }));

  return {
    type,
    values,
    timeRange,
    aggregations: {
      average: values.reduce((acc, v) => acc + v.value, 0) / values.length,
      median: values[Math.floor(values.length / 2)].value,
      percentile95: values[Math.floor(values.length * 0.95)].value,
      min: Math.min(...values.map(v => v.value)),
      max: Math.max(...values.map(v => v.value))
    }
  };
}

function createMockOverview() {
  return {
    responseTime: createMockMetrics(MetricType.RESPONSE_TIME, TimeRange.DAY),
    leadEngagement: createMockMetrics(MetricType.LEAD_ENGAGEMENT, TimeRange.DAY),
    conversionRate: createMockMetrics(MetricType.CONVERSION_RATE, TimeRange.DAY),
    aiConfidence: createMockMetrics(MetricType.AI_CONFIDENCE, TimeRange.DAY),
    leadQuality: createMockMetrics(MetricType.LEAD_QUALITY, TimeRange.DAY),
    systemUptime: createMockMetrics(MetricType.SYSTEM_UPTIME, TimeRange.DAY),
    userAdoption: createMockMetrics(MetricType.USER_ADOPTION, TimeRange.DAY)
  };
}

function calculateImprovement(values: any[]): number {
  const initial = values[values.length - 1].value;
  const final = values[0].value;
  return ((final - initial) / initial) * 100;
}