// @reduxjs/toolkit version ^2.0.0
import { createSlice, createAsyncThunk, createSelector, PayloadAction } from '@reduxjs/toolkit';
import { AuthManager } from '../../lib/api/auth';
import type { 
  User, 
  AuthError, 
  LoginCredentials, 
  MFACredentials, 
  AuthSession 
} from '../../types/auth';

/**
 * Interface for security context tracking
 */
interface SecurityContext {
  deviceTrusted: boolean;
  lastLoginLocation: string;
  sessionId: string;
  methodUsed?: string;
  verifiedAt?: Date;
}

/**
 * Enhanced interface for authentication state with security features
 */
interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: AuthError | null;
  mfaRequired: boolean;
  mfaToken: string | null;
  securityContext: SecurityContext | null;
  sessionExpiry: Date | null;
  failedAttempts: number;
  lastTokenRefresh: Date | null;
}

/**
 * Initial state with security defaults
 */
const initialState: AuthState = {
  user: null,
  isAuthenticated: false,
  isLoading: false,
  error: null,
  mfaRequired: false,
  mfaToken: null,
  securityContext: null,
  sessionExpiry: null,
  failedAttempts: 0,
  lastTokenRefresh: null
};

/**
 * Enhanced async thunk for secure user login with context tracking
 */
export const loginThunk = createAsyncThunk(
  'auth/login',
  async (credentials: LoginCredentials, { rejectWithValue }) => {
    try {
      const response = await AuthManager.login(credentials);
      
      // Extract enhanced security context
      const securityContext: SecurityContext = {
        deviceTrusted: response.securityContext.deviceTrusted,
        lastLoginLocation: response.securityContext.lastLoginLocation,
        sessionId: response.securityContext.sessionId
      };

      return {
        user: response.user,
        session: response.session,
        mfaRequired: response.mfaRequired,
        securityContext
      };
    } catch (error: any) {
      return rejectWithValue(error);
    }
  }
);

/**
 * Async thunk for MFA verification with enhanced security
 */
export const verifyMFAThunk = createAsyncThunk(
  'auth/verifyMFA',
  async (credentials: MFACredentials, { rejectWithValue }) => {
    try {
      const response = await AuthManager.verifyMFA(credentials);
      
      // Update security context with MFA information
      const securityContext: SecurityContext = {
        deviceTrusted: response.securityContext.deviceTrusted,
        methodUsed: response.securityContext.methodUsed,
        verifiedAt: response.securityContext.verifiedAt,
        sessionId: response.session.deviceId,
        lastLoginLocation: 'MFA Verified' // Updated after MFA
      };

      return {
        verified: response.verified,
        session: response.session,
        securityContext
      };
    } catch (error: any) {
      return rejectWithValue(error);
    }
  }
);

/**
 * Async thunk for secure session refresh
 */
export const refreshSessionThunk = createAsyncThunk(
  'auth/refreshSession',
  async (_, { rejectWithValue }) => {
    try {
      const response = await AuthManager.refreshToken();
      return {
        session: response.session,
        lastTokenRefresh: new Date()
      };
    } catch (error: any) {
      return rejectWithValue(error);
    }
  }
);

/**
 * Async thunk for secure logout
 */
export const logoutThunk = createAsyncThunk(
  'auth/logout',
  async (_, { rejectWithValue }) => {
    try {
      await AuthManager.logout();
    } catch (error: any) {
      return rejectWithValue(error);
    }
  }
);

/**
 * Enhanced auth slice with comprehensive security features
 */
export const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    resetError: (state) => {
      state.error = null;
    },
    updateSecurityContext: (state, action: PayloadAction<Partial<SecurityContext>>) => {
      state.securityContext = {
        ...state.securityContext,
        ...action.payload
      };
    },
    incrementFailedAttempts: (state) => {
      state.failedAttempts += 1;
    },
    resetFailedAttempts: (state) => {
      state.failedAttempts = 0;
    }
  },
  extraReducers: (builder) => {
    // Login handling
    builder.addCase(loginThunk.pending, (state) => {
      state.isLoading = true;
      state.error = null;
    });
    builder.addCase(loginThunk.fulfilled, (state, action) => {
      state.isLoading = false;
      state.user = action.payload.user;
      state.mfaRequired = action.payload.mfaRequired;
      state.securityContext = action.payload.securityContext;
      state.sessionExpiry = new Date(action.payload.session.expiresAt);
      state.isAuthenticated = !action.payload.mfaRequired;
      state.failedAttempts = 0;
    });
    builder.addCase(loginThunk.rejected, (state, action) => {
      state.isLoading = false;
      state.error = action.payload as AuthError;
      state.failedAttempts += 1;
    });

    // MFA verification handling
    builder.addCase(verifyMFAThunk.pending, (state) => {
      state.isLoading = true;
      state.error = null;
    });
    builder.addCase(verifyMFAThunk.fulfilled, (state, action) => {
      state.isLoading = false;
      state.mfaRequired = false;
      state.isAuthenticated = action.payload.verified;
      state.securityContext = action.payload.securityContext;
      state.sessionExpiry = new Date(action.payload.session.expiresAt);
    });
    builder.addCase(verifyMFAThunk.rejected, (state, action) => {
      state.isLoading = false;
      state.error = action.payload as AuthError;
    });

    // Session refresh handling
    builder.addCase(refreshSessionThunk.fulfilled, (state, action) => {
      state.sessionExpiry = new Date(action.payload.session.expiresAt);
      state.lastTokenRefresh = action.payload.lastTokenRefresh;
    });
    builder.addCase(refreshSessionThunk.rejected, (state) => {
      state.isAuthenticated = false;
      state.user = null;
      state.sessionExpiry = null;
    });

    // Logout handling
    builder.addCase(logoutThunk.fulfilled, (state) => {
      return { ...initialState };
    });
  }
});

// Export actions
export const { 
  resetError, 
  updateSecurityContext, 
  incrementFailedAttempts, 
  resetFailedAttempts 
} = authSlice.actions;

// Selectors with memoization
export const selectUser = createSelector(
  [(state: { auth: AuthState }) => state.auth],
  (auth) => auth.user
);

export const selectSecurityContext = createSelector(
  [(state: { auth: AuthState }) => state.auth],
  (auth) => auth.securityContext
);

export const selectSessionValidity = createSelector(
  [(state: { auth: AuthState }) => state.auth],
  (auth) => ({
    isValid: auth.isAuthenticated && 
             auth.sessionExpiry ? 
             auth.sessionExpiry.getTime() > Date.now() : 
             false,
    expiresAt: auth.sessionExpiry
  })
);

export const selectAuthState = createSelector(
  [(state: { auth: AuthState }) => state.auth],
  (auth) => ({
    isAuthenticated: auth.isAuthenticated,
    isLoading: auth.isLoading,
    mfaRequired: auth.mfaRequired,
    failedAttempts: auth.failedAttempts
  })
);

// Export reducer
export default authSlice.reducer;