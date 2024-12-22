/**
 * @fileoverview Advanced React hook for managing analytics data with optimized performance,
 * real-time updates, and comprehensive error handling.
 * @version 1.0.0
 */

import { useSelector, useDispatch } from 'react-redux'; // react-redux ^9.0.0
import { useCallback, useEffect } from 'react'; // react ^18.0.0
import { 
  MetricType, 
  TimeRange, 
  AnalyticsOverview 
} from '../../types/analytics';
import { 
  fetchAnalyticsOverview,
  selectAnalyticsOverview,
  selectAnalyticsLoading,
  selectAnalyticsError,
  selectTimeRange,
  selectCacheStatus,
  selectIsStale,
  setTimeRange,
  clearError,
  invalidateCache
} from '../../store/slices/analyticsSlice';
import { REFRESH_INTERVALS, METRIC_THRESHOLDS } from '../../lib/constants/analytics';

// Performance monitoring interface
interface PerformanceMetrics {
  fetchDuration: number;
  lastFetchTimestamp: number | null;
  successRate: number;
  totalFetches: number;
}

// Cache configuration interface
interface CacheOptions {
  timeout?: number;
  forceRefresh?: boolean;
  backgroundSync?: boolean;
}

// Hook return type with enhanced features
interface UseAnalyticsReturn {
  // Core data
  overview: AnalyticsOverview | null;
  loading: boolean;
  error: AnalyticsError | null;
  timeRange: TimeRange;
  lastUpdated: Date | null;
  
  // Actions
  fetchAnalytics: (options?: { skipCache?: boolean }) => Promise<void>;
  updateTimeRange: (range: TimeRange) => void;
  refreshData: () => Promise<void>;
  clearAnalyticsError: () => void;
  
  // Performance and status
  performance: PerformanceMetrics;
  cacheStatus: CacheStatus;
  isStale: boolean;
  
  // Metric thresholds
  thresholds: typeof METRIC_THRESHOLDS;
}

/**
 * Advanced hook for managing analytics data with optimized performance and real-time updates
 * @param initialTimeRange - Initial time range for analytics data
 * @param refreshInterval - Interval for automatic data refresh (ms)
 * @param cacheOptions - Configuration for data caching behavior
 */
export function useAnalytics(
  initialTimeRange: TimeRange = TimeRange.DAY,
  refreshInterval: number = REFRESH_INTERVALS.STANDARD,
  cacheOptions: CacheOptions = {}
): UseAnalyticsReturn {
  const dispatch = useDispatch();

  // Selectors with memoization
  const overview = useSelector(selectAnalyticsOverview);
  const loading = useSelector(selectAnalyticsLoading);
  const error = useSelector(selectAnalyticsError);
  const timeRange = useSelector(selectTimeRange);
  const cacheStatus = useSelector(selectCacheStatus);
  const isStale = useSelector(selectIsStale);

  // Performance metrics state
  const [performance, setPerformance] = useState<PerformanceMetrics>({
    fetchDuration: 0,
    lastFetchTimestamp: null,
    successRate: 100,
    totalFetches: 0
  });

  /**
   * Memoized fetch function with performance tracking
   */
  const fetchAnalytics = useCallback(async (options?: { skipCache?: boolean }) => {
    const startTime = performance.now();
    
    try {
      await dispatch(fetchAnalyticsOverview({ 
        timeRange,
        options: {
          skipCache: options?.skipCache || cacheOptions.forceRefresh,
          signal: AbortSignal.timeout(5000) // 5s timeout
        }
      })).unwrap();

      // Update performance metrics
      setPerformance(prev => ({
        fetchDuration: performance.now() - startTime,
        lastFetchTimestamp: Date.now(),
        successRate: ((prev.successRate * prev.totalFetches) + 100) / (prev.totalFetches + 1),
        totalFetches: prev.totalFetches + 1
      }));
    } catch (err) {
      // Update performance metrics on error
      setPerformance(prev => ({
        ...prev,
        successRate: ((prev.successRate * prev.totalFetches)) / (prev.totalFetches + 1),
        totalFetches: prev.totalFetches + 1
      }));
      throw err;
    }
  }, [dispatch, timeRange, cacheOptions.forceRefresh]);

  /**
   * Memoized time range update function
   */
  const updateTimeRange = useCallback((range: TimeRange) => {
    dispatch(setTimeRange(range));
    dispatch(invalidateCache());
  }, [dispatch]);

  /**
   * Refresh data with cache bypass
   */
  const refreshData = useCallback(async () => {
    await fetchAnalytics({ skipCache: true });
  }, [fetchAnalytics]);

  /**
   * Clear error state
   */
  const clearAnalyticsError = useCallback(() => {
    dispatch(clearError());
  }, [dispatch]);

  /**
   * Effect for initial data fetch and time range setup
   */
  useEffect(() => {
    if (timeRange !== initialTimeRange) {
      updateTimeRange(initialTimeRange);
    }
    if (!overview || isStale) {
      fetchAnalytics();
    }
  }, [initialTimeRange, overview, isStale]);

  /**
   * Effect for automatic refresh with visibility detection
   */
  useEffect(() => {
    if (!refreshInterval) return;

    let refreshTimer: NodeJS.Timeout;
    const pageVisibilityHandler = () => {
      if (document.hidden) {
        clearInterval(refreshTimer);
      } else {
        refreshTimer = setInterval(() => {
          if (!loading && !document.hidden) {
            fetchAnalytics();
          }
        }, refreshInterval);
      }
    };

    document.addEventListener('visibilitychange', pageVisibilityHandler);
    refreshTimer = setInterval(() => {
      if (!loading && !document.hidden) {
        fetchAnalytics();
      }
    }, refreshInterval);

    return () => {
      document.removeEventListener('visibilitychange', pageVisibilityHandler);
      clearInterval(refreshTimer);
    };
  }, [refreshInterval, loading, fetchAnalytics]);

  /**
   * Effect for background sync if enabled
   */
  useEffect(() => {
    if (!cacheOptions.backgroundSync) return;

    const syncWorker = new Worker('/analytics-sync-worker.js');
    syncWorker.postMessage({ timeRange, interval: REFRESH_INTERVALS.BACKGROUND });

    return () => {
      syncWorker.terminate();
    };
  }, [timeRange, cacheOptions.backgroundSync]);

  return {
    // Core data
    overview,
    loading,
    error,
    timeRange,
    lastUpdated: overview?.lastUpdated ? new Date(overview.lastUpdated) : null,

    // Actions
    fetchAnalytics,
    updateTimeRange,
    refreshData,
    clearAnalyticsError,

    // Performance and status
    performance,
    cacheStatus,
    isStale,

    // Metric thresholds
    thresholds: METRIC_THRESHOLDS
  };
}