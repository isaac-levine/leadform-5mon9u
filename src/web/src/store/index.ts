/**
 * @fileoverview Root Redux store configuration with TypeScript type safety and real-time updates
 * Combines all feature slices and configures middleware, devtools, and store enhancers
 * @version 1.0.0
 */

import { configureStore, Middleware } from '@reduxjs/toolkit'; // ^2.0.0
import { TypedUseSelectorHook, useDispatch, useSelector } from 'react-redux'; // ^9.0.0

// Import feature slice reducers
import analyticsReducer from './slices/analyticsSlice';
import authReducer from './slices/authSlice';
import conversationReducer from './slices/conversationSlice';
import formReducer from './slices/formSlice';

// WebSocket middleware for real-time updates
const websocketMiddleware: Middleware = store => next => action => {
  // Handle WebSocket-specific actions
  if (action.type === 'conversations/setSocketConnected') {
    // WebSocket connection status changed
    console.log('WebSocket connection status:', action.payload);
  }

  // Pass real-time message updates to conversation slice
  if (action.type === 'conversations/handleWebSocketMessage') {
    store.dispatch(action);
  }

  return next(action);
};

/**
 * Custom error tracking middleware
 */
const errorTrackingMiddleware: Middleware = () => next => action => {
  try {
    return next(action);
  } catch (error) {
    // Log errors to monitoring service in production
    if (process.env.NODE_ENV === 'production') {
      console.error('Redux Error:', error);
    }
    throw error;
  }
};

/**
 * Configure and create the Redux store with all enhancers
 */
export const store = configureStore({
  reducer: {
    analytics: analyticsReducer,
    auth: authReducer,
    conversation: conversationReducer,
    form: formReducer
  },
  middleware: (getDefaultMiddleware) => getDefaultMiddleware({
    // Configure middleware options
    serializableCheck: {
      // Ignore non-serializable values in specific actions
      ignoredActions: ['form/setCurrentForm', 'conversations/handleWebSocketMessage'],
      // Ignore non-serializable paths
      ignoredPaths: ['form.currentForm.validation']
    },
    thunk: {
      extraArgument: {
        // Add any extra arguments for thunks
        env: process.env.NODE_ENV
      }
    }
  }).concat([
    websocketMiddleware,
    errorTrackingMiddleware
  ]),
  devTools: process.env.NODE_ENV !== 'production' && {
    // Configure Redux DevTools options
    name: 'AI-SMS Lead Platform',
    trace: true,
    traceLimit: 25
  },
  preloadedState: undefined, // Initial state is handled by individual slices
  enhancers: (defaultEnhancers) => defaultEnhancers
});

// Infer the `RootState` and `AppDispatch` types from the store itself
export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;

/**
 * Type-safe hooks for accessing store state and dispatch
 * Use these throughout the app instead of plain `useDispatch` and `useSelector`
 */
export const useAppDispatch = () => useDispatch<AppDispatch>();
export const useAppSelector: TypedUseSelectorHook<RootState> = useSelector;

/**
 * Store subscription setup for handling store updates
 */
store.subscribe(() => {
  const state = store.getState();

  // Handle authentication state changes
  if (state.auth.isAuthenticated) {
    // Reconnect WebSocket when authenticated
    store.dispatch({ type: 'conversations/setSocketConnected', payload: true });
  } else {
    // Disconnect WebSocket when not authenticated
    store.dispatch({ type: 'conversations/setSocketConnected', payload: false });
  }

  // Clean up optimistic updates periodically
  if (state.conversation.optimisticUpdates) {
    store.dispatch({ type: 'conversations/cleanupOptimisticUpdates' });
  }
});

// Export store instance as default
export default store;