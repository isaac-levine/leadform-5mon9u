/**
 * @fileoverview Responsive and accessible line chart component for displaying lead conversion metrics
 * using Chart.js with comprehensive error handling and loading states.
 * @version 1.0.0
 */

import React, { useCallback } from 'react';
import { Line } from 'react-chartjs-2'; // react-chartjs-2 ^5.0.0
import { Card, Skeleton, Alert } from '@mui/material'; // @mui/material ^5.0.0
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  TimeScale
} from 'chart.js'; // chart.js ^4.0.0
import 'chartjs-adapter-date-fns'; // chartjs-adapter-date-fns ^3.0.0

import { MetricType } from '../../types/analytics';
import { useAnalytics } from '../../hooks/useAnalytics';
import { prepareChartData } from '../../lib/utils/analytics';
import { CHART_COLORS, CHART_DIMENSIONS } from '../../lib/constants/analytics';

// Register required Chart.js components
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  TimeScale
);

/**
 * Props interface for ConversionChart component
 */
interface ConversionChartProps {
  /** Height of the chart in pixels */
  height?: number;
  /** Additional CSS classes */
  className?: string;
  /** Accessibility label for chart */
  ariaLabel?: string;
}

/**
 * Memoized component that renders a conversion rate line chart with error handling
 * and loading states. Supports responsive design and WCAG 2.1 accessibility standards.
 */
const ConversionChart: React.FC<ConversionChartProps> = React.memo(({
  height = CHART_DIMENSIONS.MIN_HEIGHT,
  className,
  ariaLabel = 'Conversion Rate Trend Chart'
}) => {
  const { overview, timeRange, loading, error } = useAnalytics();

  // Memoize chart data preparation to prevent unnecessary recalculations
  const chartData = React.useMemo(() => {
    if (!overview?.conversionRate) return null;
    return prepareChartData(overview.conversionRate);
  }, [overview?.conversionRate]);

  // Chart options with accessibility and responsive design
  const chartOptions = React.useMemo(() => ({
    responsive: true,
    maintainAspectRatio: false,
    scales: {
      x: {
        type: 'time',
        time: {
          unit: timeRange.toLowerCase(),
          displayFormats: {
            hour: 'HH:mm',
            day: 'MMM d',
            week: 'MMM d',
            month: 'MMM yyyy'
          }
        },
        grid: {
          display: false
        },
        ticks: {
          maxRotation: 45,
          color: 'rgba(0, 0, 0, 0.6)'
        }
      },
      y: {
        beginAtZero: true,
        ticks: {
          callback: (value: number) => `${value}%`,
          color: 'rgba(0, 0, 0, 0.6)'
        },
        grid: {
          color: 'rgba(0, 0, 0, 0.1)'
        }
      }
    },
    plugins: {
      legend: {
        display: true,
        position: 'bottom' as const,
        labels: {
          usePointStyle: true,
          padding: 20,
          color: 'rgba(0, 0, 0, 0.87)'
        }
      },
      tooltip: {
        backgroundColor: 'rgba(0, 0, 0, 0.8)',
        titleColor: 'white',
        bodyColor: 'white',
        cornerRadius: 4,
        padding: 8,
        callbacks: {
          label: (context: any) => `${context.raw.toFixed(1)}%`,
          title: (items: any[]) => new Date(items[0].label).toLocaleDateString()
        }
      }
    },
    interaction: {
      mode: 'index' as const,
      intersect: false
    },
    animation: {
      duration: 300
    }
  }), [timeRange]);

  // Event handlers
  const handleChartClick = useCallback((event: any, elements: any[]) => {
    if (elements.length > 0) {
      // Handle chart click interaction if needed
      console.debug('Chart clicked:', elements[0]);
    }
  }, []);

  // Loading state
  if (loading) {
    return (
      <Card className={className}>
        <Skeleton 
          variant="rectangular" 
          height={height} 
          animation="wave"
          sx={{ bgcolor: 'rgba(0, 0, 0, 0.1)' }}
        />
      </Card>
    );
  }

  // Error state
  if (error) {
    return (
      <Card className={className}>
        <Alert 
          severity="error"
          sx={{ height: '100%', display: 'flex', alignItems: 'center' }}
        >
          Failed to load conversion rate data: {error.message}
        </Alert>
      </Card>
    );
  }

  // No data state
  if (!chartData) {
    return (
      <Card className={className}>
        <Alert 
          severity="info"
          sx={{ height: '100%', display: 'flex', alignItems: 'center' }}
        >
          No conversion rate data available for the selected time range.
        </Alert>
      </Card>
    );
  }

  return (
    <Card 
      className={className}
      role="region"
      aria-label={ariaLabel}
    >
      <Line
        data={chartData}
        options={chartOptions}
        height={height}
        onClick={handleChartClick}
        aria-label={`Line chart showing conversion rate trends over ${timeRange.toLowerCase()}`}
      />
    </Card>
  );
});

ConversionChart.displayName = 'ConversionChart';

export default ConversionChart;