import React, { memo, useEffect, useMemo, useCallback } from 'react';
import { Chart, Line, Tooltip, Legend } from 'recharts';
import { useWebSocket } from 'react-use-websocket';
import { MetricType } from '../../types/analytics';
import { useAnalytics } from '../../hooks/useAnalytics';
import Card from '../shared/Card';
import { CHART_COLORS, CHART_CONFIG, METRIC_THRESHOLDS, REFRESH_INTERVALS } from '../../lib/constants/analytics';

interface AIPerformanceMetricsProps {
  className?: string;
  updateInterval?: number;
  confidenceThreshold?: number;
}

interface MetricCardProps {
  title: string;
  value: string | number;
  trend?: number;
  threshold?: number;
  ariaLabel: string;
}

const MetricCard: React.FC<MetricCardProps> = memo(({ title, value, trend, threshold, ariaLabel }) => {
  const isAboveThreshold = typeof value === 'number' && threshold ? value >= threshold : true;
  
  return (
    <div 
      className="p-4 rounded-lg bg-white shadow-sm"
      role="region"
      aria-label={ariaLabel}
    >
      <h3 className="text-sm font-medium text-gray-500">{title}</h3>
      <div className="mt-2 flex items-baseline">
        <p 
          className={`text-2xl font-semibold ${isAboveThreshold ? 'text-green-600' : 'text-red-600'}`}
          aria-live="polite"
        >
          {value}
        </p>
        {trend !== undefined && (
          <span 
            className={`ml-2 text-sm ${trend >= 0 ? 'text-green-600' : 'text-red-600'}`}
            aria-label={`Trend: ${trend >= 0 ? 'up' : 'down'} ${Math.abs(trend)}%`}
          >
            {trend >= 0 ? '↑' : '↓'} {Math.abs(trend)}%
          </span>
        )}
      </div>
    </div>
  );
});

MetricCard.displayName = 'MetricCard';

const formatConfidenceScore = (value: number): string => {
  if (value === null || value === undefined) return 'N/A';
  const percentage = Math.round(value * 1000) / 10;
  return `${percentage}%`;
};

const calculateHandoffRate = (aiConfidence: number[]): { rate: number; trend: number } => {
  const threshold = METRIC_THRESHOLDS[MetricType.AI_CONFIDENCE] / 100;
  const handoffs = aiConfidence.filter(score => score < threshold);
  const currentRate = (handoffs.length / aiConfidence.length) * 100;
  
  // Calculate trend compared to previous period
  const previousPeriod = aiConfidence.slice(0, Math.floor(aiConfidence.length / 2));
  const previousHandoffs = previousPeriod.filter(score => score < threshold);
  const previousRate = (previousHandoffs.length / previousPeriod.length) * 100;
  
  const trend = previousRate === 0 ? 0 : ((currentRate - previousRate) / previousRate) * 100;
  
  return { rate: Math.round(currentRate * 10) / 10, trend: Math.round(trend * 10) / 10 };
};

export const AIPerformanceMetrics: React.FC<AIPerformanceMetricsProps> = memo(({
  className = '',
  updateInterval = REFRESH_INTERVALS.REAL_TIME,
  confidenceThreshold = METRIC_THRESHOLDS[MetricType.AI_CONFIDENCE] / 100
}) => {
  const { overview, loading, subscribeToUpdates } = useAnalytics();
  
  const { sendMessage, lastMessage } = useWebSocket(
    `${process.env.NEXT_PUBLIC_WS_URL}/analytics`,
    {
      shouldReconnect: () => true,
      reconnectInterval: 3000,
      reconnectAttempts: 10
    }
  );

  useEffect(() => {
    subscribeToUpdates(MetricType.AI_CONFIDENCE);
    return () => {
      sendMessage(JSON.stringify({ type: 'unsubscribe', metric: MetricType.AI_CONFIDENCE }));
    };
  }, [subscribeToUpdates, sendMessage]);

  const metrics = useMemo(() => {
    if (!overview?.aiConfidence?.values) return null;

    const confidenceValues = overview.aiConfidence.values.map(v => v.value);
    const averageConfidence = confidenceValues.reduce((a, b) => a + b, 0) / confidenceValues.length;
    const handoffMetrics = calculateHandoffRate(confidenceValues);

    return {
      confidence: formatConfidenceScore(averageConfidence),
      handoffRate: handoffMetrics.rate,
      handoffTrend: handoffMetrics.trend,
      responseTime: Math.round(overview.responseTime.values[overview.responseTime.values.length - 1].value)
    };
  }, [overview]);

  const chartData = useMemo(() => {
    if (!overview?.aiConfidence?.values) return [];
    return overview.aiConfidence.values.map(v => ({
      timestamp: new Date(v.timestamp).toLocaleTimeString(),
      confidence: v.value * 100,
      threshold: confidenceThreshold * 100
    }));
  }, [overview, confidenceThreshold]);

  return (
    <Card
      variant="elevated"
      padding="lg"
      className={`${className} w-full`}
      role="region"
      aria-label="AI Performance Metrics"
    >
      <div className="space-y-6">
        <h2 className="text-xl font-semibold text-gray-900">AI Performance Metrics</h2>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <MetricCard
            title="Average Confidence"
            value={metrics?.confidence ?? 'Loading...'}
            threshold={confidenceThreshold * 100}
            ariaLabel="AI confidence score"
          />
          <MetricCard
            title="Handoff Rate"
            value={`${metrics?.handoffRate ?? 'Loading...'}%`}
            trend={metrics?.handoffTrend}
            ariaLabel="Human handoff rate"
          />
          <MetricCard
            title="Response Time"
            value={`${metrics?.responseTime ?? 'Loading...'}ms`}
            threshold={METRIC_THRESHOLDS[MetricType.RESPONSE_TIME]}
            ariaLabel="AI response time"
          />
        </div>

        <div className="h-64" role="img" aria-label="AI confidence trend chart">
          <Chart
            data={chartData}
            margin={CHART_CONFIG.MARGIN}
          >
            <Line
              type="monotone"
              dataKey="confidence"
              stroke={CHART_COLORS.PRIMARY}
              strokeWidth={2}
              dot={false}
              name="Confidence"
            />
            <Line
              type="monotone"
              dataKey="threshold"
              stroke={CHART_COLORS.ERROR}
              strokeDasharray="4 4"
              strokeWidth={1}
              dot={false}
              name="Threshold"
            />
            <Tooltip
              formatter={(value: number) => [`${value.toFixed(1)}%`]}
              labelFormatter={(label: string) => `Time: ${label}`}
            />
            <Legend />
          </Chart>
        </div>
      </div>
    </Card>
  );
});

AIPerformanceMetrics.displayName = 'AIPerformanceMetrics';

export default AIPerformanceMetrics;