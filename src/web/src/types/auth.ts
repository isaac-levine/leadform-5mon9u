// next-auth version ^4.0.0
import { Session } from 'next-auth';

/**
 * Enumeration of available user roles in the system with hierarchical access levels.
 * Roles are ordered from highest (ADMIN) to lowest (READ_ONLY) privileges.
 */
export enum UserRole {
  ADMIN = 'ADMIN',
  MANAGER = 'MANAGER',
  AGENT = 'AGENT',
  READ_ONLY = 'READ_ONLY'
}

/**
 * Enumeration of granular user permissions for fine-grained access control.
 * Each permission represents a specific action that can be performed in the system.
 */
export enum UserPermission {
  MANAGE_USERS = 'MANAGE_USERS',
  MANAGE_FORMS = 'MANAGE_FORMS',
  VIEW_ANALYTICS = 'VIEW_ANALYTICS',
  MANAGE_CONVERSATIONS = 'MANAGE_CONVERSATIONS',
  TAKE_OVER_CHAT = 'TAKE_OVER_CHAT',
  VIEW_CONVERSATIONS = 'VIEW_CONVERSATIONS',
  EXPORT_DATA = 'EXPORT_DATA',
  MANAGE_TEMPLATES = 'MANAGE_TEMPLATES',
  CONFIGURE_AI = 'CONFIGURE_AI',
  AUDIT_LOGS = 'AUDIT_LOGS'
}

/**
 * Interface representing an authenticated user with complete profile and security information.
 * Contains all necessary user attributes for authentication and authorization decisions.
 */
export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: UserRole;
  readonly permissions: UserPermission[];
  organizationId: string;
  mfaEnabled: boolean;
  lastLoginAt: Date;
  passwordLastChangedAt: Date;
  isActive: boolean;
  failedLoginAttempts: number;
  lastFailedLoginAt: Date | null;
}

/**
 * Type for Multi-Factor Authentication (MFA) methods supported by the system.
 */
export type MFAMethod = 'TOTP' | 'SMS' | 'EMAIL';

/**
 * Type for authentication error severity levels.
 */
export type AuthErrorSeverity = 'ERROR' | 'WARNING' | 'INFO';

/**
 * Type for user login credentials with enhanced security fields.
 * Includes additional security measures like reCAPTCHA and device tracking.
 */
export type LoginCredentials = {
  email: string;
  password: string;
  organizationId: string;
  deviceId: string;
  recaptchaToken: string;
};

/**
 * Type for MFA verification credentials with comprehensive validation.
 * Supports multiple MFA methods and includes device tracking for security.
 */
export type MFACredentials = {
  userId: string;
  code: string;
  token: string;
  method: MFAMethod;
  deviceId: string;
};

/**
 * Type for detailed authentication error responses.
 * Provides comprehensive error information for debugging and monitoring.
 */
export type AuthError = {
  code: string;
  message: string;
  details: Record<string, any>;
  timestamp: Date;
  requestId: string;
  severity: AuthErrorSeverity;
};

/**
 * Extended NextAuth session interface with enhanced security properties.
 * Includes additional context for secure session management and tracking.
 */
export interface AuthSession extends Session {
  user: User;
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
  deviceId: string;
  ipAddress: string;
  userAgent: string;
}