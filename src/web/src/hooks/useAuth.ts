// react version ^18.0.0
import { useEffect, useCallback, useMemo } from 'react';
// react-redux version ^8.1.0
import { useDispatch, useSelector } from 'react-redux';
// next-auth/react version ^4.0.0
import { useSession } from 'next-auth/react';
// @fingerprintjs/fingerprintjs-pro-react version ^1.0.0
import { useFingerprint } from '@fingerprintjs/fingerprintjs-pro-react';

import { User } from '../../types/auth';
import { 
  selectUser, 
  selectSecurityContext, 
  selectSessionValidity,
  selectAuthState,
  loginThunk,
  logoutThunk,
  refreshSessionThunk,
  verifyMFAThunk,
  updateSecurityContext,
  resetFailedAttempts
} from '../../store/slices/authSlice';
import { authManager } from '../../lib/api/auth';

/**
 * Rate limit configuration for different operation types
 */
interface RateLimitConfig {
  maxAttempts: number;
  windowMs: number;
}

const RATE_LIMITS: Record<string, RateLimitConfig> = {
  login: { maxAttempts: 5, windowMs: 5 * 60 * 1000 }, // 5 attempts per 5 minutes
  mfa: { maxAttempts: 3, windowMs: 5 * 60 * 1000 }, // 3 attempts per 5 minutes
  api: { maxAttempts: 100, windowMs: 60 * 1000 } // 100 requests per minute
};

/**
 * Enhanced authentication hook with comprehensive security features
 * Manages authentication state, session validity, and security context
 */
export function useAuth() {
  const dispatch = useDispatch();
  const { data: session, status } = useSession();
  const { fingerprint } = useFingerprint();

  // Redux selectors
  const user = useSelector(selectUser);
  const securityContext = useSelector(selectSecurityContext);
  const sessionValidity = useSelector(selectSessionValidity);
  const authState = useSelector(selectAuthState);

  // Rate limiting state
  const rateLimitState = useMemo(() => ({
    attempts: {} as Record<string, number[]>,
    isLimited: {} as Record<string, boolean>
  }), []);

  /**
   * Validates current session with enhanced security checks
   */
  const validateSession = useCallback(async (): Promise<boolean> => {
    if (!sessionValidity.isValid || !securityContext) {
      return false;
    }

    // Verify device fingerprint
    if (fingerprint && securityContext.deviceId !== fingerprint) {
      await dispatch(logoutThunk());
      return false;
    }

    // Check session expiration
    const sessionTimeRemaining = sessionValidity.expiresAt 
      ? sessionValidity.expiresAt.getTime() - Date.now()
      : 0;

    if (sessionTimeRemaining < 5 * 60 * 1000) { // 5 minutes threshold
      try {
        await dispatch(refreshSessionThunk());
      } catch (error) {
        return false;
      }
    }

    return true;
  }, [dispatch, sessionValidity, securityContext, fingerprint]);

  /**
   * Handles secure login with rate limiting and security context
   */
  const handleLogin = useCallback(async (credentials: {
    email: string;
    password: string;
    organizationId: string;
    recaptchaToken: string;
  }) => {
    if (!await checkRateLimit('login')) {
      throw new Error('Rate limit exceeded. Please try again later.');
    }

    try {
      const result = await dispatch(loginThunk({
        ...credentials,
        deviceId: fingerprint || ''
      }));

      if (loginThunk.fulfilled.match(result)) {
        dispatch(resetFailedAttempts());
        return result.payload;
      }
    } catch (error) {
      throw error;
    }
  }, [dispatch, fingerprint]);

  /**
   * Handles secure logout with cleanup
   */
  const handleLogout = useCallback(async () => {
    try {
      await dispatch(logoutThunk());
    } catch (error) {
      console.error('Logout error:', error);
    }
  }, [dispatch]);

  /**
   * Manages token refresh with security validation
   */
  const refreshToken = useCallback(async () => {
    if (!await checkRateLimit('api')) {
      throw new Error('Too many refresh attempts');
    }

    try {
      await dispatch(refreshSessionThunk());
    } catch (error) {
      await handleLogout();
      throw error;
    }
  }, [dispatch, handleLogout]);

  /**
   * Checks and updates rate limits for operations
   */
  const checkRateLimit = useCallback(async (operationType: string): Promise<boolean> => {
    const config = RATE_LIMITS[operationType];
    if (!config) return true;

    const now = Date.now();
    const attempts = rateLimitState.attempts[operationType] || [];

    // Clean up old attempts
    const validAttempts = attempts.filter(
      timestamp => now - timestamp < config.windowMs
    );

    if (validAttempts.length >= config.maxAttempts) {
      rateLimitState.isLimited[operationType] = true;
      return false;
    }

    // Record new attempt
    validAttempts.push(now);
    rateLimitState.attempts[operationType] = validAttempts;
    return true;
  }, [rateLimitState]);

  // Session monitoring effect
  useEffect(() => {
    let sessionCheckInterval: NodeJS.Timeout;

    if (authState.isAuthenticated) {
      sessionCheckInterval = setInterval(async () => {
        await validateSession();
      }, 60 * 1000); // Check every minute
    }

    return () => {
      if (sessionCheckInterval) {
        clearInterval(sessionCheckInterval);
      }
    };
  }, [authState.isAuthenticated, validateSession]);

  // Security context synchronization
  useEffect(() => {
    if (session && fingerprint) {
      dispatch(updateSecurityContext({
        deviceId: fingerprint,
        lastLoginLocation: window.location.href,
        lastActivityAt: new Date()
      }));
    }
  }, [session, fingerprint, dispatch]);

  return {
    user,
    securityContext,
    sessionValidity,
    isAuthenticated: authState.isAuthenticated,
    isLoading: authState.isLoading,
    mfaRequired: authState.mfaRequired,
    failedAttempts: authState.failedAttempts,
    handleLogin,
    handleLogout,
    refreshToken,
    validateSession,
    checkRateLimit
  };
}