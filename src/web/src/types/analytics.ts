// @types/shared version ^1.0.0
import { BaseEntity } from '@types/shared';

/**
 * Enum defining different types of metrics tracked in the system
 */
export enum MetricType {
  RESPONSE_TIME = 'RESPONSE_TIME',
  LEAD_ENGAGEMENT = 'LEAD_ENGAGEMENT',
  CONVERSION_RATE = 'CONVERSION_RATE',
  AI_CONFIDENCE = 'AI_CONFIDENCE',
  LEAD_QUALITY = 'LEAD_QUALITY'
}

/**
 * Enum defining time range options for analytics queries
 */
export enum TimeRange {
  HOUR = 'HOUR',
  DAY = 'DAY',
  WEEK = 'WEEK',
  MONTH = 'MONTH'
}

/**
 * Interface representing an individual metric measurement
 */
export interface MetricValue {
  /** Numeric value of the metric measurement */
  value: number;
  /** Timestamp when the metric was recorded */
  timestamp: Date;
}

/**
 * Interface representing metric data with time series values
 */
export interface MetricData {
  /** Type of metric being tracked */
  type: MetricType;
  /** Array of metric values over time (immutable) */
  values: readonly MetricValue[];
  /** Time range for the metric data */
  timeRange: TimeRange;
}

/**
 * Interface representing the analytics dashboard overview data
 */
export interface AnalyticsOverview {
  /** Response time metrics tracking system performance */
  responseTime: MetricData;
  /** Lead engagement metrics tracking interaction rates */
  leadEngagement: MetricData;
  /** Conversion rate metrics tracking lead success */
  conversionRate: MetricData;
  /** AI confidence score metrics tracking automation quality */
  aiConfidence: MetricData;
  /** Lead quality score metrics tracking lead value */
  leadQuality: MetricData;
}

/**
 * Interface representing the analytics Redux state
 */
export interface AnalyticsState {
  /** Current analytics overview data */
  overview: AnalyticsOverview | null;
  /** Loading state for analytics data fetching */
  loading: boolean;
  /** Error message if analytics fetch fails */
  error: string | null;
  /** Currently selected time range filter */
  timeRange: TimeRange;
  /** Timestamp of last data update */
  lastUpdated: Date | null;
}

/**
 * Type definition for filtering metric queries
 */
export type MetricFilter = {
  /** Type of metric to filter */
  type: MetricType;
  /** Time range to filter */
  timeRange: TimeRange;
  /** Organization ID to filter metrics */
  organizationId: string;
};