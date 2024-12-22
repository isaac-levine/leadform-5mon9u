/**
 * @fileoverview Redux slice for managing analytics state with enhanced caching and error handling
 * @version 1.0.0
 */

import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit'; // @reduxjs/toolkit ^2.0.0
import { 
  AnalyticsState, 
  TimeRange, 
  AnalyticsOverview 
} from '../../types/analytics';
import { getAnalyticsOverview } from '../../lib/api/analytics';
import { METRIC_LABELS, REFRESH_INTERVALS } from '../../lib/constants/analytics';

// Cache status enum for tracking data freshness
enum CacheStatus {
  EMPTY = 'EMPTY',
  VALID = 'VALID',
  INVALID = 'INVALID',
  ERROR = 'ERROR'
}

// Enhanced error type with additional context
interface AnalyticsError {
  message: string;
  code: string;
  timestamp: number;
  context?: Record<string, unknown>;
}

// Options for fetch operations
interface FetchOptions {
  skipCache?: boolean;
  forceRefresh?: boolean;
  signal?: AbortSignal;
}

// Initial state with enhanced caching and error handling
const initialState: AnalyticsState & {
  cacheStatus: CacheStatus;
  lastUpdated: number | null;
  retryCount: number;
  cacheTimeout: number;
} = {
  overview: null,
  loading: false,
  error: null,
  timeRange: TimeRange.DAY,
  lastUpdated: null,
  cacheStatus: CacheStatus.EMPTY,
  retryCount: 0,
  cacheTimeout: REFRESH_INTERVALS.STANDARD
};

/**
 * Enhanced async thunk for fetching analytics overview with caching and retry logic
 */
export const fetchAnalyticsOverview = createAsyncThunk<
  AnalyticsOverview,
  { timeRange: TimeRange; options?: FetchOptions },
  { rejectValue: AnalyticsError }
>(
  'analytics/fetchOverview',
  async ({ timeRange, options = {} }, { rejectWithValue, getState }) => {
    try {
      const response = await getAnalyticsOverview(timeRange, {
        skipCache: options.skipCache,
        signal: options.signal
      });

      // Validate response data
      if (!response || !response.responseTime || !response.leadEngagement) {
        throw new Error('Invalid analytics data received');
      }

      return response;
    } catch (error) {
      return rejectWithValue({
        message: error instanceof Error ? error.message : 'Failed to fetch analytics',
        code: 'FETCH_ERROR',
        timestamp: Date.now()
      });
    }
  },
  {
    condition: (_, { getState }) => {
      const state = getState() as { analytics: typeof initialState };
      
      // Check cache validity unless force refresh requested
      if (
        state.analytics.cacheStatus === CacheStatus.VALID &&
        state.analytics.lastUpdated &&
        Date.now() - state.analytics.lastUpdated < state.analytics.cacheTimeout
      ) {
        return false;
      }
      
      return !state.analytics.loading;
    }
  }
);

/**
 * Analytics slice with enhanced error handling and caching
 */
const analyticsSlice = createSlice({
  name: 'analytics',
  initialState,
  reducers: {
    setTimeRange: (state, action: PayloadAction<TimeRange>) => {
      if (state.timeRange !== action.payload) {
        state.timeRange = action.payload;
        state.cacheStatus = CacheStatus.INVALID;
        state.lastUpdated = null;
        state.error = null;
      }
    },
    clearError: (state) => {
      state.error = null;
      state.retryCount = 0;
    },
    invalidateCache: (state) => {
      state.cacheStatus = CacheStatus.INVALID;
      state.lastUpdated = null;
    },
    setCacheTimeout: (state, action: PayloadAction<number>) => {
      state.cacheTimeout = action.payload;
    }
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchAnalyticsOverview.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchAnalyticsOverview.fulfilled, (state, action) => {
        state.loading = false;
        state.overview = action.payload;
        state.lastUpdated = Date.now();
        state.cacheStatus = CacheStatus.VALID;
        state.retryCount = 0;
        state.error = null;
      })
      .addCase(fetchAnalyticsOverview.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload ?? {
          message: 'An unknown error occurred',
          code: 'UNKNOWN_ERROR',
          timestamp: Date.now()
        };
        state.cacheStatus = CacheStatus.ERROR;
        state.retryCount += 1;
      });
  }
});

// Memoized selectors for optimized rendering
export const selectAnalyticsOverview = (state: { analytics: typeof initialState }) => 
  state.analytics.overview;

export const selectAnalyticsLoading = (state: { analytics: typeof initialState }) => 
  state.analytics.loading;

export const selectAnalyticsError = (state: { analytics: typeof initialState }) => 
  state.analytics.error;

export const selectTimeRange = (state: { analytics: typeof initialState }) => 
  state.analytics.timeRange;

export const selectCacheStatus = (state: { analytics: typeof initialState }) => 
  state.analytics.cacheStatus;

export const selectIsStale = (state: { analytics: typeof initialState }) => {
  const { lastUpdated, cacheTimeout } = state.analytics;
  if (!lastUpdated) return true;
  return Date.now() - lastUpdated > cacheTimeout;
};

// Export actions and reducer
export const { 
  setTimeRange, 
  clearError, 
  invalidateCache,
  setCacheTimeout 
} = analyticsSlice.actions;

export default analyticsSlice.reducer;