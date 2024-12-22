/**
 * Type definitions for analytics-related functionality in the AI-SMS Lead Platform.
 * Provides comprehensive types for metrics, time ranges, analytics data structures,
 * and filtering capabilities.
 * @version 1.0.0
 */

/**
 * Base interface for all entity types with organization context
 */
export interface BaseEntity {
  id: string;
  createdAt: Date;
  updatedAt: Date;
  organizationId: string;
}

/**
 * Comprehensive enum for all types of metrics tracked in the system
 */
export enum MetricType {
  RESPONSE_TIME = 'RESPONSE_TIME',       // Target: <500ms
  LEAD_ENGAGEMENT = 'LEAD_ENGAGEMENT',   // Target: 80% response rate
  CONVERSION_RATE = 'CONVERSION_RATE',   // Target: 25% improvement
  AI_CONFIDENCE = 'AI_CONFIDENCE',       // AI model confidence scores
  LEAD_QUALITY = 'LEAD_QUALITY',        // Lead scoring metrics
  SYSTEM_UPTIME = 'SYSTEM_UPTIME',      // Target: 99.9% uptime
  USER_ADOPTION = 'USER_ADOPTION'        // Target: 90% active rate
}

/**
 * Enum for comprehensive time range options in analytics queries
 */
export enum TimeRange {
  HOUR = 'HOUR',
  DAY = 'DAY',
  WEEK = 'WEEK',
  MONTH = 'MONTH',
  QUARTER = 'QUARTER',
  YEAR = 'YEAR'
}

/**
 * Interface for individual metric measurements with metadata
 */
export interface MetricValue {
  /** Numeric value of the metric */
  value: number;
  
  /** Time when metric was recorded */
  timestamp: Date;
  
  /** Confidence score for the metric value (0-1) */
  confidence: number;
  
  /** Additional contextual data for the metric */
  metadata: Record<string, unknown>;
}

/**
 * Interface for statistical aggregations of metric values
 */
export interface MetricAggregations {
  /** Average value over the time range */
  average: number;
  
  /** Median value over the time range */
  median: number;
  
  /** 95th percentile value */
  percentile95: number;
  
  /** Minimum value in the time range */
  min: number;
  
  /** Maximum value in the time range */
  max: number;
}

/**
 * Interface for metric data with time series values and aggregations
 */
export interface MetricData {
  /** Type of metric being tracked */
  type: MetricType;
  
  /** Array of metric values over time */
  values: readonly MetricValue[];
  
  /** Time range for the metric data */
  timeRange: TimeRange;
  
  /** Statistical aggregations of metric values */
  aggregations: MetricAggregations;
}

/**
 * Comprehensive interface for analytics dashboard overview data
 */
export interface AnalyticsOverview {
  /** Response time metrics with target <500ms */
  responseTime: MetricData;
  
  /** Lead engagement metrics targeting 80% response rate */
  leadEngagement: MetricData;
  
  /** Conversion rate metrics targeting 25% improvement */
  conversionRate: MetricData;
  
  /** AI confidence score metrics */
  aiConfidence: MetricData;
  
  /** Lead quality score metrics */
  leadQuality: MetricData;
  
  /** System uptime metrics targeting 99.9% */
  systemUptime: MetricData;
  
  /** User adoption metrics targeting 90% active rate */
  userAdoption: MetricData;
}

/**
 * Type for comprehensive metric query filtering
 */
export type MetricFilter = {
  /** Type(s) of metrics to filter */
  type: MetricType | MetricType[];
  
  /** Time range to filter */
  timeRange: TimeRange;
  
  /** Organization ID to filter metrics */
  organizationId: string;
  
  /** Whether to include statistical aggregations */
  aggregation: boolean;
  
  /** Minimum confidence score filter */
  confidence: number;
};