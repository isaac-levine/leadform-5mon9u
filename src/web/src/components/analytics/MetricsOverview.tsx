import React, { memo, useCallback, useMemo } from 'react';
import clsx from 'clsx'; // ^2.0.0
import { Card } from '../shared/Card';
import { useAnalytics } from '../../hooks/useAnalytics';
import { MetricType } from '../../types/analytics';
import { METRIC_LABELS, METRIC_FORMATS, CHART_COLORS } from '../../lib/constants/analytics';

/**
 * Props interface for MetricsOverview component
 */
interface MetricsOverviewProps {
  /** Optional class name for styling */
  className?: string;
  /** Refresh interval in milliseconds */
  refreshInterval?: number;
  /** Error callback handler */
  onError?: (error: Error) => void;
}

/**
 * Props interface for individual metric cards
 */
interface MetricCardProps {
  /** Metric title */
  title: string;
  /** Current metric value */
  value: number;
  /** Trend information */
  trend: {
    direction: 'up' | 'down';
    percentage: number;
  };
  /** Target threshold value */
  threshold: number;
  /** Loading state */
  loading: boolean;
  /** Error state */
  error: string | null;
  /** Format configuration */
  format: {
    suffix: string;
    decimals: number;
  };
  /** Accessibility label */
  ariaLabel: string;
}

/**
 * Memoized component for rendering individual metric cards
 */
const MetricCard = memo<MetricCardProps>(({
  title,
  value,
  trend,
  threshold,
  loading,
  error,
  format,
  ariaLabel
}) => {
  // Format value with proper decimals and suffix
  const formattedValue = useMemo(() => {
    return `${value.toFixed(format.decimals)}${format.suffix}`;
  }, [value, format]);

  // Determine trend color based on direction and threshold
  const trendColor = useMemo(() => {
    const isPositive = trend.direction === 'up';
    const meetsThreshold = value >= threshold;
    return clsx(
      'flex items-center text-sm font-medium',
      isPositive && meetsThreshold && 'text-green-500 dark:text-green-400',
      isPositive && !meetsThreshold && 'text-yellow-500 dark:text-yellow-400',
      !isPositive && 'text-red-500 dark:text-red-400'
    );
  }, [trend.direction, value, threshold]);

  // Loading state
  if (loading) {
    return (
      <Card
        variant="default"
        padding="lg"
        className={clsx(
          'animate-pulse bg-gray-50 dark:bg-gray-800',
          'h-[160px]'
        )}
        aria-busy="true"
      >
        <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4 mb-4" />
        <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-1/2" />
      </Card>
    );
  }

  // Error state
  if (error) {
    return (
      <Card
        variant="default"
        padding="lg"
        className="bg-red-50 dark:bg-red-900"
        role="alert"
      >
        <h3 className="text-red-700 dark:text-red-300 font-medium">{title}</h3>
        <p className="text-red-600 dark:text-red-400 text-sm mt-2">{error}</p>
      </Card>
    );
  }

  return (
    <Card
      variant="default"
      padding="lg"
      className="transition-all duration-200 hover:shadow-lg"
      aria-label={ariaLabel}
    >
      <h3 className="text-sm font-medium text-gray-600 dark:text-gray-300">
        {title}
      </h3>
      <div className="mt-2 flex items-baseline">
        <p className="text-2xl font-bold text-gray-900 dark:text-white">
          {formattedValue}
        </p>
        <span className={trendColor}>
          <span className="sr-only">
            {trend.direction === 'up' ? 'Increased by' : 'Decreased by'}
          </span>
          {trend.direction === 'up' ? '↑' : '↓'} {trend.percentage}%
        </span>
      </div>
      <div className="mt-4">
        <div className="relative h-1 rounded-full overflow-hidden">
          <div className="absolute w-full h-full bg-gray-200 dark:bg-gray-700" />
          <div
            className={clsx(
              'absolute h-full rounded-full transition-all duration-500',
              value >= threshold
                ? 'bg-green-500 dark:bg-green-400'
                : 'bg-red-500 dark:bg-red-400'
            )}
            style={{ width: `${(value / threshold) * 100}%` }}
          />
        </div>
        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
          Target: {threshold}{format.suffix}
        </p>
      </div>
    </Card>
  );
});

MetricCard.displayName = 'MetricCard';

/**
 * Main component for displaying analytics metrics overview
 */
export const MetricsOverview: React.FC<MetricsOverviewProps> = ({
  className,
  refreshInterval = 30000,
  onError
}) => {
  const {
    overview,
    loading,
    error,
    thresholds
  } = useAnalytics(undefined, refreshInterval);

  // Error handling callback
  const handleError = useCallback((error: Error) => {
    onError?.(error);
  }, [onError]);

  // Calculate trends for each metric
  const getMetricTrend = useCallback((metricData: any) => {
    if (!metricData?.values || metricData.values.length < 2) {
      return { direction: 'up' as const, percentage: 0 };
    }
    const current = metricData.values[metricData.values.length - 1].value;
    const previous = metricData.values[metricData.values.length - 2].value;
    const change = ((current - previous) / previous) * 100;
    return {
      direction: change >= 0 ? 'up' as const : 'down' as const,
      percentage: Math.abs(change)
    };
  }, []);

  // Render error state
  if (error) {
    handleError(new Error(error));
  }

  return (
    <div className={clsx(
      'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 p-4',
      className
    )}>
      {Object.values(MetricType).map((metricType) => {
        const metricData = overview?.[metricType.toLowerCase() as keyof typeof overview];
        const currentValue = metricData?.values?.[metricData.values.length - 1]?.value ?? 0;
        
        return (
          <MetricCard
            key={metricType}
            title={METRIC_LABELS[metricType]}
            value={currentValue}
            trend={getMetricTrend(metricData)}
            threshold={thresholds[metricType]}
            loading={loading}
            error={error}
            format={METRIC_FORMATS[metricType]}
            ariaLabel={`${METRIC_LABELS[metricType]} metric card`}
          />
        );
      })}
    </div>
  );
};

export default memo(MetricsOverview);