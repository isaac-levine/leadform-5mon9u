/**
 * @fileoverview Analytics utility functions for processing, transforming, and analyzing metrics data
 * Includes performance optimization, error handling, and memory management
 * @version 1.0.0
 */

// External imports
import { Chart } from 'chart.js'; // ^4.0.0

// Internal imports
import { MetricType } from '../../types/analytics';
import { METRIC_LABELS } from '../constants/analytics';
import { formatMetricValue } from './formatting';

// Error messages
const ERROR_MESSAGES = {
  INVALID_VALUES: 'Invalid or empty values array provided',
  INVALID_METRIC_TYPE: 'Invalid metric type provided',
  INSUFFICIENT_DATA: 'Insufficient data points for calculation',
  INVALID_CHART_DATA: 'Invalid chart data structure',
} as const;

/**
 * Performance decorator for memoizing expensive calculations
 */
function memoize(target: any, propertyKey: string, descriptor: PropertyDescriptor) {
  const cache = new Map();
  const originalMethod = descriptor.value;

  descriptor.value = function(...args: any[]) {
    const key = JSON.stringify(args);
    if (cache.has(key)) {
      return cache.get(key);
    }
    const result = originalMethod.apply(this, args);
    cache.set(key, result);
    return result;
  };
}

/**
 * Input validation decorator
 */
function validateInput(target: any, propertyKey: string, descriptor: PropertyDescriptor) {
  const originalMethod = descriptor.value;

  descriptor.value = function(...args: any[]) {
    if (!args[0] || !Array.isArray(args[0])) {
      throw new Error(ERROR_MESSAGES.INVALID_VALUES);
    }
    return originalMethod.apply(this, args);
  };
}

/**
 * Calculates the average value for a given metric over a set of data points
 * @param values Array of metric values to average
 * @returns Average value or null if calculation fails
 * @throws {Error} If input array is invalid or empty
 */
export const calculateMetricAverage = memoize((values: MetricValue[]): number | null => {
  try {
    if (!values?.length) {
      throw new Error(ERROR_MESSAGES.INVALID_VALUES);
    }

    const validValues = values.filter(v => typeof v.value === 'number' && !isNaN(v.value));
    if (!validValues.length) {
      return null;
    }

    const sum = validValues.reduce((acc, curr) => acc + curr.value, 0);
    return Number((sum / validValues.length).toFixed(2));
  } catch (error) {
    console.error('Error calculating metric average:', error);
    return null;
  }
});

/**
 * Calculates trend direction and percentage change for a metric
 * @param values Array of metric values to analyze
 * @param metricType Type of metric being analyzed
 * @returns Trend information object
 * @throws {Error} If input parameters are invalid
 */
export const calculateMetricTrend = memoize((
  values: MetricValue[],
  metricType: MetricType
): { direction: 'up' | 'down' | 'stable'; percentage: number; confidence: number } => {
  try {
    if (!values?.length || !metricType) {
      throw new Error(ERROR_MESSAGES.INVALID_VALUES);
    }

    if (values.length < 2) {
      throw new Error(ERROR_MESSAGES.INSUFFICIENT_DATA);
    }

    // Sort values by timestamp
    const sortedValues = [...values].sort((a, b) => 
      new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );

    // Calculate start and end averages using window of 3 points or available points
    const windowSize = Math.min(3, Math.floor(sortedValues.length / 2));
    const startValues = sortedValues.slice(0, windowSize);
    const endValues = sortedValues.slice(-windowSize);

    const startAvg = calculateMetricAverage(startValues) || 0;
    const endAvg = calculateMetricAverage(endValues) || 0;

    const percentageChange = ((endAvg - startAvg) / startAvg) * 100;
    const direction = percentageChange > 1 ? 'up' : percentageChange < -1 ? 'down' : 'stable';
    
    // Calculate confidence based on data consistency
    const variance = calculateVariance(sortedValues.map(v => v.value));
    const confidence = Math.max(0, Math.min(100, 100 - (variance * 10)));

    return {
      direction,
      percentage: Number(Math.abs(percentageChange).toFixed(1)),
      confidence: Number(confidence.toFixed(1))
    };
  } catch (error) {
    console.error('Error calculating metric trend:', error);
    return { direction: 'stable', percentage: 0, confidence: 0 };
  }
});

/**
 * Transforms metric data into Chart.js compatible format with accessibility features
 * @param metricData Metric data to transform
 * @returns Chart.js compatible data object
 * @throws {Error} If input data structure is invalid
 */
export const prepareChartData = (metricData: MetricData): Chart.ChartData => {
  try {
    if (!metricData?.values?.length) {
      throw new Error(ERROR_MESSAGES.INVALID_CHART_DATA);
    }

    const sortedValues = [...metricData.values].sort((a, b) => 
      new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );

    return {
      labels: sortedValues.map(v => new Date(v.timestamp).toLocaleString()),
      datasets: [{
        label: METRIC_LABELS[metricData.type],
        data: sortedValues.map(v => v.value),
        borderColor: '#2563EB',
        backgroundColor: 'rgba(37, 99, 235, 0.1)',
        tension: 0.4,
        pointRadius: 4,
        pointHoverRadius: 6
      }],
      options: {
        responsive: true,
        maintainAspectRatio: true,
        plugins: {
          tooltip: {
            callbacks: {
              label: (context: any) => {
                return formatMetricValue(context.raw, metricData.type);
              }
            }
          }
        },
        accessibility: {
          enabled: true,
          description: `Time series chart showing ${METRIC_LABELS[metricData.type]} over time`
        }
      }
    };
  } catch (error) {
    console.error('Error preparing chart data:', error);
    throw error;
  }
};

/**
 * Aggregates multiple metrics into a summary overview with performance optimization
 * @param metrics Array of metric data to aggregate
 * @returns Aggregated metrics summary
 * @throws {Error} If input metrics array is invalid
 */
export const aggregateMetrics = memoize((metrics: MetricData[]): {
  averages: Record<MetricType, number | null>;
  trends: Record<MetricType, ReturnType<typeof calculateMetricTrend>>;
  performance: { calculationTime: number; dataPoints: number };
} => {
  const startTime = performance.now();
  try {
    if (!metrics?.length) {
      throw new Error(ERROR_MESSAGES.INVALID_VALUES);
    }

    const totalDataPoints = metrics.reduce((sum, m) => sum + m.values.length, 0);
    
    // Calculate averages and trends in parallel using Promise.all
    const calculations = metrics.map(async metric => {
      const average = calculateMetricAverage(metric.values);
      const trend = calculateMetricTrend(metric.values, metric.type);
      return { type: metric.type, average, trend };
    });

    const results = await Promise.all(calculations);
    
    const averages: Record<MetricType, number | null> = {} as any;
    const trends: Record<MetricType, ReturnType<typeof calculateMetricTrend>> = {} as any;
    
    results.forEach(result => {
      averages[result.type] = result.average;
      trends[result.type] = result.trend;
    });

    return {
      averages,
      trends,
      performance: {
        calculationTime: Number((performance.now() - startTime).toFixed(2)),
        dataPoints: totalDataPoints
      }
    };
  } catch (error) {
    console.error('Error aggregating metrics:', error);
    throw error;
  }
});

/**
 * Helper function to calculate variance of a number array
 * @param values Array of numbers
 * @returns Variance value
 */
const calculateVariance = (values: number[]): number => {
  const avg = values.reduce((sum, val) => sum + val, 0) / values.length;
  const squareDiffs = values.map(value => Math.pow(value - avg, 2));
  return squareDiffs.reduce((sum, val) => sum + val, 0) / values.length;
};