import React, { useMemo } from 'react';
import {
  Line,
  LineChart,
  XAxis,
  YAxis,
  Tooltip,
  ReferenceLine,
  ResponsiveContainer
} from 'recharts'; // ^2.10.0
import { useAnalytics } from '../../hooks/useAnalytics';
import { MetricType } from '../../types/analytics';
import Card from '../shared/Card';
import Loader from '../shared/Loader';
import { CHART_COLORS, METRIC_THRESHOLDS, CHART_DIMENSIONS } from '../../lib/constants/analytics';

interface ResponseTimeChartProps {
  /** Optional CSS class name for styling */
  className?: string;
  /** Optional chart height in pixels */
  height?: number;
  /** Toggle SLA reference line visibility */
  showSLA?: boolean;
}

/**
 * Formats timestamp for x-axis labels with internationalization support
 */
const formatTimeLabel = (timestamp: string, locale: string = 'en-US'): string => {
  const date = new Date(timestamp);
  const options: Intl.DateTimeFormatOptions = {
    hour: 'numeric',
    minute: 'numeric',
    hour12: true
  };
  return new Intl.DateTimeFormat(locale, options).format(date);
};

/**
 * Formats response time value with unit and locale support
 */
const formatResponseTime = (value: number): string => {
  return `${value.toLocaleString(undefined, { maximumFractionDigits: 0 })}ms`;
};

/**
 * Custom tooltip component with accessibility enhancements
 */
const CustomTooltip: React.FC<any> = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;

  return (
    <div 
      className="bg-white p-3 border border-neutral-200 rounded shadow-md"
      role="tooltip"
      aria-live="polite"
    >
      <p className="text-sm font-medium text-neutral-600">
        {new Date(label).toLocaleString()}
      </p>
      <p className="text-sm font-bold text-primary-600">
        Response Time: {formatResponseTime(payload[0].value)}
      </p>
    </div>
  );
};

/**
 * ResponseTimeChart component that renders response time metrics with accessibility support
 * and responsive visualization across devices.
 */
const ResponseTimeChart: React.FC<ResponseTimeChartProps> = ({
  className,
  height = CHART_DIMENSIONS.MIN_HEIGHT,
  showSLA = true
}) => {
  const { overview, loading, error } = useAnalytics();

  // Memoize transformed data for performance
  const chartData = useMemo(() => {
    if (!overview?.responseTime?.values) return [];
    
    return overview.responseTime.values.map(point => ({
      timestamp: point.timestamp,
      value: point.value
    }));
  }, [overview?.responseTime?.values]);

  // Handle loading state
  if (loading) {
    return (
      <Card className={className} padding="lg">
        <div className="flex items-center justify-center" style={{ height }}>
          <Loader size="lg" color={CHART_COLORS.PRIMARY} center />
        </div>
      </Card>
    );
  }

  // Handle error state
  if (error) {
    return (
      <Card className={className} padding="lg">
        <div 
          className="flex items-center justify-center text-error-600" 
          style={{ height }}
          role="alert"
        >
          <p>Failed to load response time data</p>
        </div>
      </Card>
    );
  }

  return (
    <Card className={className} padding="lg">
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <h3 className="text-lg font-semibold text-neutral-800">
            Response Time
          </h3>
          <div 
            className="text-sm text-neutral-600"
            role="status"
            aria-live="polite"
          >
            Current: {chartData.length > 0 && formatResponseTime(chartData[chartData.length - 1].value)}
          </div>
        </div>

        <div style={{ height }} role="img" aria-label="Response time trend chart">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart
              data={chartData}
              margin={{ top: 20, right: 20, bottom: 20, left: 40 }}
            >
              {/* Axes */}
              <XAxis
                dataKey="timestamp"
                tickFormatter={formatTimeLabel}
                stroke={CHART_COLORS.SECONDARY}
                tick={{ fill: CHART_COLORS.SECONDARY }}
                tickLine={{ stroke: CHART_COLORS.SECONDARY }}
              />
              <YAxis
                tickFormatter={formatResponseTime}
                stroke={CHART_COLORS.SECONDARY}
                tick={{ fill: CHART_COLORS.SECONDARY }}
                tickLine={{ stroke: CHART_COLORS.SECONDARY }}
              />

              {/* SLA Reference Line */}
              {showSLA && (
                <ReferenceLine
                  y={METRIC_THRESHOLDS[MetricType.RESPONSE_TIME]}
                  stroke={CHART_COLORS.ERROR}
                  strokeDasharray="3 3"
                  label={{
                    value: 'SLA Target',
                    position: 'right',
                    fill: CHART_COLORS.ERROR
                  }}
                />
              )}

              {/* Tooltip */}
              <Tooltip
                content={<CustomTooltip />}
                cursor={{ stroke: CHART_COLORS.SECONDARY, strokeWidth: 1 }}
              />

              {/* Data Line */}
              <Line
                type="monotone"
                dataKey="value"
                stroke={CHART_COLORS.PRIMARY}
                strokeWidth={2}
                dot={false}
                activeDot={{
                  r: 6,
                  stroke: CHART_COLORS.PRIMARY,
                  strokeWidth: 2,
                  fill: '#fff'
                }}
                name="Response Time"
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </Card>
  );
};

// Add display name for debugging
ResponseTimeChart.displayName = 'ResponseTimeChart';

export default React.memo(ResponseTimeChart);