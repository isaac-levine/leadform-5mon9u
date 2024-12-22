/**
 * @fileoverview Analytics constants and configuration values for metrics, 
 * visualization, and performance thresholds.
 * @version 1.0.0
 */

import { MetricType } from '../types/analytics';

/**
 * Human-readable labels for each metric type
 * Used for display in analytics dashboard and reports
 */
export const METRIC_LABELS: Record<MetricType, string> = {
  [MetricType.RESPONSE_TIME]: 'Response Time',
  [MetricType.LEAD_ENGAGEMENT]: 'Lead Engagement',
  [MetricType.CONVERSION_RATE]: 'Conversion Rate',
  [MetricType.AI_CONFIDENCE]: 'AI Confidence',
  [MetricType.LEAD_QUALITY]: 'Lead Quality'
} as const;

/**
 * Time range options for analytics filtering
 * Duration values are in milliseconds
 */
export const TIME_RANGE_OPTIONS = [
  {
    value: 'HOUR',
    label: 'Last Hour',
    duration: 3600000 // 1 hour in ms
  },
  {
    value: 'DAY',
    label: 'Last 24 Hours',
    duration: 86400000 // 24 hours in ms
  },
  {
    value: 'WEEK',
    label: 'Last 7 Days',
    duration: 604800000 // 7 days in ms
  },
  {
    value: 'MONTH',
    label: 'Last 30 Days',
    duration: 2592000000 // 30 days in ms
  }
] as const;

/**
 * WCAG 2.1 AA compliant color constants for analytics visualizations
 * Ensures minimum contrast ratio of 4.5:1 for accessibility
 */
export const CHART_COLORS = {
  PRIMARY: '#2563EB', // Blue - Primary metrics
  SECONDARY: '#3B82F6', // Light blue - Secondary metrics
  SUCCESS: '#10B981', // Green - Success indicators
  ERROR: '#EF4444' // Red - Error/warning indicators
} as const;

/**
 * Performance thresholds for metric monitoring and alerts
 * Based on system requirements and success criteria
 */
export const METRIC_THRESHOLDS: Record<MetricType, number> = {
  [MetricType.RESPONSE_TIME]: 500, // Maximum response time in ms
  [MetricType.LEAD_ENGAGEMENT]: 80, // Target engagement rate percentage
  [MetricType.CONVERSION_RATE]: 25, // Target conversion improvement percentage
  [MetricType.AI_CONFIDENCE]: 90, // Minimum AI confidence score
  [MetricType.LEAD_QUALITY]: 75 // Minimum lead quality score
} as const;

/**
 * Chart visualization configuration for consistent rendering
 * Used by Chart.js and other visualization libraries
 */
export const CHART_CONFIG = {
  LINE_TENSION: 0.4, // Smoothing for line charts
  POINT_RADIUS: 4, // Size of data points
  ANIMATION_DURATION: 750, // Animation duration in ms
  TOOLTIP_ENABLED: true, // Enable interactive tooltips
  LEGEND_POSITION: 'top' as const // Legend positioning
} as const;

/**
 * Default chart dimensions for responsive scaling
 * Maintains consistent aspect ratios across viewports
 */
export const CHART_DIMENSIONS = {
  MIN_HEIGHT: 300,
  MAX_HEIGHT: 600,
  ASPECT_RATIO: 16 / 9,
  MARGIN: {
    TOP: 20,
    RIGHT: 20,
    BOTTOM: 30,
    LEFT: 40
  }
} as const;

/**
 * Refresh intervals for real-time analytics updates
 * Values in milliseconds
 */
export const REFRESH_INTERVALS = {
  REAL_TIME: 5000, // 5 seconds
  STANDARD: 30000, // 30 seconds
  BACKGROUND: 300000 // 5 minutes
} as const;

/**
 * Format configurations for metric value display
 */
export const METRIC_FORMATS = {
  [MetricType.RESPONSE_TIME]: {
    suffix: 'ms',
    decimals: 0
  },
  [MetricType.LEAD_ENGAGEMENT]: {
    suffix: '%',
    decimals: 1
  },
  [MetricType.CONVERSION_RATE]: {
    suffix: '%',
    decimals: 1
  },
  [MetricType.AI_CONFIDENCE]: {
    suffix: '%',
    decimals: 1
  },
  [MetricType.LEAD_QUALITY]: {
    suffix: '',
    decimals: 0
  }
} as const;