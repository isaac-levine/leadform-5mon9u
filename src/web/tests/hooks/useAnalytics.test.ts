import { renderHook, act } from '@testing-library/react-hooks';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import { waitFor } from '@testing-library/react';
import { useAnalytics } from '../../src/hooks/useAnalytics';
import { TimeRange } from '../../src/types/analytics';
import { fetchAnalyticsOverview } from '../../src/store/slices/analyticsSlice';
import analyticsReducer from '../../src/store/slices/analyticsSlice';

// Mock data matching the analytics schema
const mockAnalyticsData = {
  responseTime: {
    type: 'RESPONSE_TIME',
    values: [{ value: 450, timestamp: '2024-01-01T00:00:00Z' }],
    metadata: { sampleSize: 1000, confidence: 0.95 }
  },
  leadEngagement: {
    type: 'LEAD_ENGAGEMENT',
    values: [{ value: 85, timestamp: '2024-01-01T00:00:00Z' }],
    metadata: { totalLeads: 500, activeLeads: 425 }
  },
  conversionRate: {
    type: 'CONVERSION_RATE',
    values: [{ value: 25, timestamp: '2024-01-01T00:00:00Z' }],
    metadata: { baselineRate: 20, improvement: 25 }
  }
};

// Mock WebSocket for real-time updates
class MockWebSocket {
  onopen: (() => void) | null = null;
  onclose: (() => void) | null = null;
  onmessage: ((data: any) => void) | null = null;
  readyState: number = WebSocket.CONNECTING;

  constructor() {
    setTimeout(() => {
      this.readyState = WebSocket.OPEN;
      this.onopen?.();
    }, 0);
  }

  send(data: string) {}
  close() {
    this.readyState = WebSocket.CLOSED;
    this.onclose?.();
  }
}

// Setup helper to create test environment
interface SetupOptions {
  initialTimeRange?: TimeRange;
  mockWebSocket?: boolean;
  cacheTimeout?: number;
}

const setupTest = (options: SetupOptions = {}) => {
  // Create Redux store with analytics reducer
  const store = configureStore({
    reducer: {
      analytics: analyticsReducer
    },
    middleware: (getDefaultMiddleware) =>
      getDefaultMiddleware({
        serializableCheck: false
      })
  });

  // Mock WebSocket if needed
  if (options.mockWebSocket) {
    global.WebSocket = MockWebSocket as any;
  }

  // Create wrapper with Redux Provider
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <Provider store={store}>{children}</Provider>
  );

  return {
    store,
    wrapper
  };
};

describe('useAnalytics Hook', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    localStorage.clear();
  });

  it('should initialize with default state', async () => {
    const { wrapper } = setupTest();
    const { result } = renderHook(() => useAnalytics(), { wrapper });

    expect(result.current.overview).toBeNull();
    expect(result.current.loading).toBeFalsy();
    expect(result.current.error).toBeNull();
    expect(result.current.timeRange).toBe(TimeRange.DAY);
    expect(result.current.cacheStatus).toBe('EMPTY');
  });

  it('should fetch analytics data on mount', async () => {
    const { wrapper, store } = setupTest();
    
    // Mock API response
    jest.spyOn(store.dispatch, 'dispatch');
    store.dispatch(fetchAnalyticsOverview.fulfilled(mockAnalyticsData, '', {
      timeRange: TimeRange.DAY,
      options: {}
    }));

    const { result } = renderHook(() => useAnalytics(), { wrapper });

    await waitFor(() => {
      expect(result.current.overview).toEqual(mockAnalyticsData);
      expect(result.current.loading).toBeFalsy();
      expect(result.current.cacheStatus).toBe('VALID');
    });
  });

  it('should handle cache hits and invalidation', async () => {
    const { wrapper, store } = setupTest({ cacheTimeout: 5000 });
    
    // Setup initial cached data
    store.dispatch(fetchAnalyticsOverview.fulfilled(mockAnalyticsData, '', {
      timeRange: TimeRange.DAY,
      options: {}
    }));

    const { result } = renderHook(() => useAnalytics(), { wrapper });

    // Verify cache hit
    expect(result.current.overview).toEqual(mockAnalyticsData);
    expect(result.current.cacheStatus).toBe('VALID');

    // Invalidate cache
    await act(async () => {
      await result.current.refreshData();
    });

    expect(result.current.cacheStatus).toBe('INVALID');
  });

  it('should handle WebSocket connections and updates', async () => {
    const { wrapper } = setupTest({ mockWebSocket: true });
    const { result } = renderHook(() => useAnalytics(), { wrapper });

    // Simulate WebSocket connection
    await waitFor(() => {
      expect(result.current.wsStatus.connected).toBeTruthy();
    });

    // Simulate real-time update
    const mockWsMessage = {
      type: 'analytics_update',
      data: mockAnalyticsData
    };

    act(() => {
      (global.WebSocket as any).mockInstance.onmessage({
        data: JSON.stringify(mockWsMessage)
      });
    });

    expect(result.current.overview).toEqual(mockAnalyticsData);
  });

  it('should handle errors gracefully', async () => {
    const { wrapper, store } = setupTest();
    
    // Simulate API error
    const errorMessage = 'Failed to fetch analytics';
    store.dispatch(fetchAnalyticsOverview.rejected(
      new Error(errorMessage),
      '',
      { timeRange: TimeRange.DAY, options: {} }
    ));

    const { result } = renderHook(() => useAnalytics(), { wrapper });

    expect(result.current.error).toBeTruthy();
    expect(result.current.error?.message).toBe(errorMessage);
    expect(result.current.cacheStatus).toBe('ERROR');
  });

  it('should update time range and refresh data', async () => {
    const { wrapper } = setupTest();
    const { result } = renderHook(() => useAnalytics(), { wrapper });

    await act(async () => {
      result.current.updateTimeRange(TimeRange.WEEK);
    });

    expect(result.current.timeRange).toBe(TimeRange.WEEK);
    expect(result.current.loading).toBeTruthy();
  });

  it('should optimize memory usage during updates', async () => {
    const { wrapper } = setupTest();
    const { result } = renderHook(() => useAnalytics(), { wrapper });

    // Monitor memory usage
    const initialMemory = process.memoryUsage().heapUsed;

    // Trigger multiple updates
    for (let i = 0; i < 10; i++) {
      await act(async () => {
        await result.current.refreshData();
      });
    }

    const finalMemory = process.memoryUsage().heapUsed;
    const memoryIncrease = finalMemory - initialMemory;

    // Verify reasonable memory growth
    expect(memoryIncrease).toBeLessThan(5 * 1024 * 1024); // Less than 5MB growth
  });

  it('should respect performance thresholds', async () => {
    const { wrapper } = setupTest();
    const { result } = renderHook(() => useAnalytics(), { wrapper });

    const startTime = performance.now();
    await act(async () => {
      await result.current.fetchAnalytics();
    });
    const duration = performance.now() - startTime;

    // Verify response time meets requirements
    expect(duration).toBeLessThan(500); // 500ms requirement from spec
  });
});