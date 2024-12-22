// axios version ^1.6.0
import axios, { AxiosInstance, AxiosRequestConfig } from 'axios';
// @fingerprintjs/fingerprintjs version ^3.4.0
import FingerprintJS from '@fingerprintjs/fingerprintjs';
// crypto-js version ^4.1.1
import { AES, enc } from 'crypto-js';
import { 
  User, 
  UserRole, 
  MFAMethod, 
  LoginCredentials, 
  MFACredentials, 
  AuthError, 
  AuthSession 
} from '../../types/auth';

/**
 * Security configuration interface for AuthManager
 */
interface SecurityConfig {
  tokenRefreshThreshold: number;
  maxRetryAttempts: number;
  encryptionKey: string;
  apiBaseUrl: string;
  sessionTimeout: number;
}

/**
 * Enhanced authentication response with security context
 */
interface AuthResponse {
  user: User;
  session: AuthSession;
  mfaRequired: boolean;
  securityContext: {
    deviceTrusted: boolean;
    lastLoginLocation: string;
    sessionId: string;
  };
}

/**
 * MFA verification result with enhanced security information
 */
interface MFAVerificationResult {
  verified: boolean;
  session: AuthSession;
  securityContext: {
    methodUsed: MFAMethod;
    verifiedAt: Date;
    deviceTrusted: boolean;
  };
}

/**
 * Manages authentication state and security operations with comprehensive session handling
 * and security features including MFA, device fingerprinting, and token rotation.
 */
export class AuthManager {
  private readonly api: AxiosInstance;
  private readonly config: SecurityConfig;
  private currentSession: AuthSession | null = null;
  private fingerprint: string | null = null;
  private refreshTokenTimeout?: NodeJS.Timeout;

  constructor(config: SecurityConfig) {
    this.config = config;
    this.api = axios.create({
      baseURL: config.apiBaseUrl,
      timeout: 10000,
      headers: {
        'Content-Type': 'application/json',
        'X-Client-Version': '1.0.0'
      }
    });

    this.setupInterceptors();
    this.initializeFingerprint();
  }

  /**
   * Initializes device fingerprinting for enhanced security
   */
  private async initializeFingerprint(): Promise<void> {
    try {
      const fp = await FingerprintJS.load();
      const result = await fp.get();
      this.fingerprint = result.visitorId;
    } catch (error) {
      console.error('Failed to initialize fingerprint:', error);
    }
  }

  /**
   * Sets up axios interceptors for automatic token refresh and error handling
   */
  private setupInterceptors(): void {
    this.api.interceptors.request.use(
      (config) => {
        if (this.currentSession?.accessToken) {
          config.headers.Authorization = `Bearer ${this.currentSession.accessToken}`;
        }
        if (this.fingerprint) {
          config.headers['X-Device-Fingerprint'] = this.fingerprint;
        }
        return config;
      },
      (error) => Promise.reject(error)
    );

    this.api.interceptors.response.use(
      (response) => response,
      async (error) => {
        if (error.response?.status === 401 && this.currentSession?.refreshToken) {
          return this.handleTokenRefresh(error.config);
        }
        return Promise.reject(this.formatAuthError(error));
      }
    );
  }

  /**
   * Handles automatic token refresh when access token expires
   */
  private async handleTokenRefresh(failedRequest: AxiosRequestConfig): Promise<any> {
    try {
      const response = await this.api.post('/auth/refresh', {
        refreshToken: this.currentSession?.refreshToken,
        deviceId: this.fingerprint
      });

      const { accessToken, refreshToken } = response.data;
      if (this.currentSession) {
        this.currentSession.accessToken = accessToken;
        this.currentSession.refreshToken = refreshToken;
      }

      if (failedRequest.headers) {
        failedRequest.headers.Authorization = `Bearer ${accessToken}`;
      }

      return this.api(failedRequest);
    } catch (error) {
      this.logout();
      throw this.formatAuthError(error);
    }
  }

  /**
   * Formats authentication errors with detailed context
   */
  private formatAuthError(error: any): AuthError {
    return {
      code: error.response?.data?.code || 'AUTH_ERROR',
      message: error.response?.data?.message || 'Authentication failed',
      details: error.response?.data?.details || {},
      timestamp: new Date(),
      requestId: error.response?.headers['x-request-id'],
      severity: error.response?.data?.severity || 'ERROR'
    };
  }

  /**
   * Enhanced login with security features and device fingerprinting
   */
  public async login(credentials: LoginCredentials): Promise<AuthResponse> {
    const encryptedPassword = AES.encrypt(
      credentials.password,
      this.config.encryptionKey
    ).toString();

    try {
      const response = await this.api.post<AuthResponse>('/auth/login', {
        ...credentials,
        password: encryptedPassword,
        deviceFingerprint: this.fingerprint
      });

      this.currentSession = response.data.session;
      this.setupTokenRefresh();

      return response.data;
    } catch (error) {
      throw this.formatAuthError(error);
    }
  }

  /**
   * Verifies MFA tokens with enhanced security checks
   */
  public async verifyMFA(credentials: MFACredentials): Promise<MFAVerificationResult> {
    try {
      const response = await this.api.post<MFAVerificationResult>('/auth/mfa/verify', {
        ...credentials,
        deviceFingerprint: this.fingerprint
      });

      if (response.data.verified) {
        this.currentSession = response.data.session;
        this.setupTokenRefresh();
      }

      return response.data;
    } catch (error) {
      throw this.formatAuthError(error);
    }
  }

  /**
   * Sets up automatic token refresh before expiration
   */
  private setupTokenRefresh(): void {
    if (this.refreshTokenTimeout) {
      clearTimeout(this.refreshTokenTimeout);
    }

    if (this.currentSession?.expiresAt) {
      const refreshTime = this.currentSession.expiresAt - Date.now() - this.config.tokenRefreshThreshold;
      if (refreshTime > 0) {
        this.refreshTokenTimeout = setTimeout(() => {
          this.handleTokenRefresh({});
        }, refreshTime);
      }
    }
  }

  /**
   * Logs out user and cleans up session data
   */
  public async logout(): Promise<void> {
    if (this.currentSession?.refreshToken) {
      try {
        await this.api.post('/auth/logout', {
          refreshToken: this.currentSession.refreshToken,
          deviceId: this.fingerprint
        });
      } catch (error) {
        console.error('Logout error:', error);
      }
    }

    if (this.refreshTokenTimeout) {
      clearTimeout(this.refreshTokenTimeout);
    }

    this.currentSession = null;
  }

  /**
   * Checks if user has required role or permission
   */
  public hasPermission(requiredRole: UserRole): boolean {
    if (!this.currentSession?.user) return false;

    const roleHierarchy = {
      [UserRole.ADMIN]: 4,
      [UserRole.MANAGER]: 3,
      [UserRole.AGENT]: 2,
      [UserRole.READ_ONLY]: 1
    };

    const userRoleLevel = roleHierarchy[this.currentSession.user.role];
    const requiredRoleLevel = roleHierarchy[requiredRole];

    return userRoleLevel >= requiredRoleLevel;
  }

  /**
   * Gets current session information
   */
  public getSession(): AuthSession | null {
    return this.currentSession;
  }

  /**
   * Validates current session status
   */
  public isAuthenticated(): boolean {
    return !!(
      this.currentSession?.accessToken &&
      this.currentSession.expiresAt &&
      this.currentSession.expiresAt > Date.now()
    );
  }
}

// Export singleton instance
export const authManager = new AuthManager({
  tokenRefreshThreshold: 5 * 60 * 1000, // 5 minutes
  maxRetryAttempts: 3,
  encryptionKey: process.env.NEXT_PUBLIC_ENCRYPTION_KEY || '',
  apiBaseUrl: process.env.NEXT_PUBLIC_API_URL || '',
  sessionTimeout: 60 * 60 * 1000 // 1 hour
});