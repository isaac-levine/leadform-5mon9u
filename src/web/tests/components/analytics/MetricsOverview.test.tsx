import React from 'react';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { axe, toHaveNoViolations } from 'jest-axe';
import { jest, expect, describe, it, beforeEach } from '@jest/globals';
import MetricsOverview from '../../src/components/analytics/MetricsOverview';
import { useAnalytics } from '../../src/hooks/useAnalytics';
import { MetricType } from '../../src/types/analytics';
import { METRIC_LABELS, METRIC_FORMATS, METRIC_THRESHOLDS } from '../../src/lib/constants/analytics';

// Extend Jest matchers
expect.extend(toHaveNoViolations);

// Mock useAnalytics hook
jest.mock('../../src/hooks/useAnalytics');
const mockUseAnalytics = useAnalytics as jest.MockedFunction<typeof useAnalytics>;

// Test data constants
const mockMetrics = {
  responseTime: {
    values: [{ value: 450, timestamp: new Date() }],
    type: MetricType.RESPONSE_TIME,
    timeRange: 'DAY'
  },
  leadEngagement: {
    values: [{ value: 85, timestamp: new Date() }],
    type: MetricType.LEAD_ENGAGEMENT,
    timeRange: 'DAY'
  },
  conversionRate: {
    values: [{ value: 28, timestamp: new Date() }],
    type: MetricType.CONVERSION_RATE,
    timeRange: 'DAY'
  },
  aiConfidence: {
    values: [{ value: 92, timestamp: new Date() }],
    type: MetricType.AI_CONFIDENCE,
    timeRange: 'DAY'
  }
};

describe('MetricsOverview', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseAnalytics.mockReturnValue({
      overview: {
        responseTime: mockMetrics.responseTime,
        leadEngagement: mockMetrics.leadEngagement,
        conversionRate: mockMetrics.conversionRate,
        aiConfidence: mockMetrics.aiConfidence
      },
      loading: false,
      error: null,
      thresholds: METRIC_THRESHOLDS
    });
  });

  describe('Rendering', () => {
    it('should render all metric cards correctly', () => {
      render(<MetricsOverview />);

      Object.values(MetricType).forEach(metricType => {
        const card = screen.getByLabelText(`${METRIC_LABELS[metricType]} metric card`);
        expect(card).toBeInTheDocument();
      });
    });

    it('should display correct metric values and formats', () => {
      render(<MetricsOverview />);

      // Check Response Time formatting
      const responseTimeCard = screen.getByLabelText(`${METRIC_LABELS[MetricType.RESPONSE_TIME]} metric card`);
      expect(within(responseTimeCard).getByText('450ms')).toBeInTheDocument();

      // Check Lead Engagement formatting
      const leadEngagementCard = screen.getByLabelText(`${METRIC_LABELS[MetricType.LEAD_ENGAGEMENT]} metric card`);
      expect(within(leadEngagementCard).getByText('85.0%')).toBeInTheDocument();
    });

    it('should show loading state correctly', () => {
      mockUseAnalytics.mockReturnValue({
        overview: null,
        loading: true,
        error: null,
        thresholds: METRIC_THRESHOLDS
      });

      render(<MetricsOverview />);
      
      const loadingCards = screen.getAllByRole('article');
      loadingCards.forEach(card => {
        expect(card).toHaveAttribute('aria-busy', 'true');
        expect(card).toHaveClass('animate-pulse');
      });
    });

    it('should handle error state appropriately', () => {
      const errorMessage = 'Failed to fetch analytics data';
      mockUseAnalytics.mockReturnValue({
        overview: null,
        loading: false,
        error: errorMessage,
        thresholds: METRIC_THRESHOLDS
      });

      render(<MetricsOverview />);
      
      const errorCards = screen.getAllByRole('alert');
      errorCards.forEach(card => {
        expect(card).toHaveTextContent(errorMessage);
      });
    });
  });

  describe('Functionality', () => {
    it('should update metrics in real-time', async () => {
      const { rerender } = render(<MetricsOverview />);

      // Initial value check
      expect(screen.getByText('450ms')).toBeInTheDocument();

      // Update mock data
      mockUseAnalytics.mockReturnValue({
        overview: {
          ...mockMetrics,
          responseTime: {
            ...mockMetrics.responseTime,
            values: [{ value: 400, timestamp: new Date() }]
          }
        },
        loading: false,
        error: null,
        thresholds: METRIC_THRESHOLDS
      });

      rerender(<MetricsOverview />);
      await waitFor(() => {
        expect(screen.getByText('400ms')).toBeInTheDocument();
      });
    });

    it('should display correct trend indicators', () => {
      const { rerender } = render(<MetricsOverview />);

      // Check positive trend
      const positiveCard = screen.getByLabelText(`${METRIC_LABELS[MetricType.AI_CONFIDENCE]} metric card`);
      expect(within(positiveCard).getByText('↑')).toBeInTheDocument();

      // Update mock for negative trend
      mockUseAnalytics.mockReturnValue({
        overview: {
          ...mockMetrics,
          aiConfidence: {
            ...mockMetrics.aiConfidence,
            values: [
              { value: 95, timestamp: new Date(Date.now() - 1000) },
              { value: 92, timestamp: new Date() }
            ]
          }
        },
        loading: false,
        error: null,
        thresholds: METRIC_THRESHOLDS
      });

      rerender(<MetricsOverview />);
      expect(within(positiveCard).getByText('↓')).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('should have no accessibility violations', async () => {
      const { container } = render(<MetricsOverview />);
      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });

    it('should have proper ARIA labels and roles', () => {
      render(<MetricsOverview />);
      
      Object.values(MetricType).forEach(metricType => {
        const card = screen.getByLabelText(`${METRIC_LABELS[metricType]} metric card`);
        expect(card).toHaveAttribute('role', 'article');
      });
    });

    it('should be keyboard navigable', () => {
      render(<MetricsOverview />);
      
      const cards = screen.getAllByRole('article');
      cards.forEach(card => {
        fireEvent.focus(card);
        expect(card).toHaveFocus();
      });
    });
  });

  describe('Performance', () => {
    it('should render within performance budget', async () => {
      const startTime = performance.now();
      render(<MetricsOverview />);
      const endTime = performance.now();
      
      expect(endTime - startTime).toBeLessThan(100); // 100ms budget
    });

    it('should handle rapid updates efficiently', async () => {
      const { rerender } = render(<MetricsOverview />);
      
      const updateTimes: number[] = [];
      
      // Simulate 10 rapid updates
      for (let i = 0; i < 10; i++) {
        const startTime = performance.now();
        mockUseAnalytics.mockReturnValue({
          overview: {
            ...mockMetrics,
            responseTime: {
              ...mockMetrics.responseTime,
              values: [{ value: 450 - i * 10, timestamp: new Date() }]
            }
          },
          loading: false,
          error: null,
          thresholds: METRIC_THRESHOLDS
        });

        rerender(<MetricsOverview />);
        updateTimes.push(performance.now() - startTime);
      }

      // Average update time should be less than 50ms
      const avgUpdateTime = updateTimes.reduce((a, b) => a + b) / updateTimes.length;
      expect(avgUpdateTime).toBeLessThan(50);
    });
  });
});