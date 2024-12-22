import React, { memo, useMemo } from 'react';
import { Line, ResponsiveContainer, XAxis, YAxis, Tooltip } from 'recharts'; // recharts ^2.10.0
import { MetricType } from '../../types/analytics';
import { useAnalytics } from '../../hooks/useAnalytics';
import Card from '../shared/Card';
import { CHART_COLORS, CHART_DIMENSIONS, CHART_CONFIG } from '../../lib/constants/analytics';

/**
 * Props interface for LeadQualityChart component
 */
interface LeadQualityChartProps {
  /** Optional CSS class name for styling */
  className?: string;
  /** Height of the chart in pixels */
  height?: number;
  /** Accessibility label for chart */
  ariaLabel?: string;
}

/**
 * Interface for formatted chart data points
 */
interface ChartDataPoint {
  timestamp: string;
  value: number;
  tooltipLabel: string;
}

/**
 * Formats lead quality metric data for chart display
 * @param leadQualityData - Raw lead quality metric data
 * @returns Formatted data points for Recharts
 */
const formatChartData = memo((leadQualityData?: readonly { value: number; timestamp: Date }[]): ChartDataPoint[] => {
  if (!leadQualityData?.length) return [];

  const dateFormatter = new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: 'numeric'
  });

  return leadQualityData.map(point => ({
    timestamp: dateFormatter.format(new Date(point.timestamp)),
    value: point.value,
    tooltipLabel: `Quality Score: ${point.value}`
  })).sort((a, b) => 
    new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  );
});

/**
 * LeadQualityChart component displays lead quality trends over time
 * with accessibility support and responsive design
 */
export const LeadQualityChart = memo<LeadQualityChartProps>(({
  className = '',
  height = CHART_DIMENSIONS.MIN_HEIGHT,
  ariaLabel = 'Lead Quality Trends Chart'
}) => {
  // Get analytics data using the analytics hook
  const { overview, loading, error } = useAnalytics();

  // Memoize chart data formatting
  const chartData = useMemo(() => 
    formatChartData(overview?.leadQuality?.values),
    [overview?.leadQuality?.values]
  );

  // Handle loading state
  if (loading) {
    return (
      <Card 
        className={`${className} animate-pulse`}
        role="figure"
        aria-label={`${ariaLabel} - Loading`}
      >
        <div className="h-[300px] bg-gray-200 dark:bg-gray-800 rounded" />
      </Card>
    );
  }

  // Handle error state
  if (error) {
    return (
      <Card 
        className={className}
        role="alert"
        aria-label={`${ariaLabel} - Error`}
      >
        <div className="text-red-500 dark:text-red-400 p-4">
          Failed to load lead quality data: {error.message}
        </div>
      </Card>
    );
  }

  return (
    <Card 
      className={className}
      role="figure"
      aria-label={ariaLabel}
    >
      <div className="p-4">
        <h3 className="text-lg font-semibold mb-2 text-gray-900 dark:text-gray-100">
          Lead Quality Trends
        </h3>
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
          Track the quality score distribution of captured leads over time
        </p>
        
        <div 
          role="img" 
          aria-label="Line chart showing lead quality trends"
          className="w-full"
          style={{ height }}
        >
          <ResponsiveContainer width="100%" height="100%">
            <Line
              data={chartData}
              margin={{
                top: CHART_DIMENSIONS.MARGIN.TOP,
                right: CHART_DIMENSIONS.MARGIN.RIGHT,
                bottom: CHART_DIMENSIONS.MARGIN.BOTTOM,
                left: CHART_DIMENSIONS.MARGIN.LEFT
              }}
            >
              {/* Accessible axes with proper labeling */}
              <XAxis
                dataKey="timestamp"
                stroke={CHART_COLORS.SECONDARY}
                tick={{ fill: CHART_COLORS.SECONDARY }}
                tickLine={{ stroke: CHART_COLORS.SECONDARY }}
                label={{ 
                  value: 'Time',
                  position: 'bottom',
                  offset: 20,
                  fill: CHART_COLORS.SECONDARY
                }}
              />
              <YAxis
                stroke={CHART_COLORS.SECONDARY}
                tick={{ fill: CHART_COLORS.SECONDARY }}
                tickLine={{ stroke: CHART_COLORS.SECONDARY }}
                label={{ 
                  value: 'Quality Score',
                  angle: -90,
                  position: 'left',
                  offset: 20,
                  fill: CHART_COLORS.SECONDARY
                }}
                domain={[0, 100]}
              />

              {/* Interactive tooltip */}
              <Tooltip
                contentStyle={{
                  backgroundColor: 'rgba(255, 255, 255, 0.9)',
                  border: `1px solid ${CHART_COLORS.PRIMARY}`,
                  borderRadius: '4px',
                  padding: '8px'
                }}
                labelStyle={{ color: CHART_COLORS.SECONDARY }}
              />

              {/* Lead quality line with proper styling */}
              <Line
                type="monotone"
                dataKey="value"
                stroke={CHART_COLORS.PRIMARY}
                strokeWidth={2}
                dot={{ 
                  r: CHART_CONFIG.POINT_RADIUS,
                  fill: CHART_COLORS.PRIMARY,
                  strokeWidth: 1
                }}
                activeDot={{
                  r: CHART_CONFIG.POINT_RADIUS * 1.5,
                  stroke: CHART_COLORS.PRIMARY,
                  strokeWidth: 2
                }}
                name="Lead Quality"
                isAnimationActive={true}
                animationDuration={CHART_CONFIG.ANIMATION_DURATION}
                connectNulls={true}
              />
            </Line>
          </ResponsiveContainer>
        </div>
      </div>
    </Card>
  );
});

// Display name for debugging
LeadQualityChart.displayName = 'LeadQualityChart';

// Default export
export default LeadQualityChart;