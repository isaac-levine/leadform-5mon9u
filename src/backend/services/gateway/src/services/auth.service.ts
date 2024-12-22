/**
 * @fileoverview Authentication Service Implementation
 * @version 1.0.0
 * 
 * Implements secure JWT token management, role-based access control,
 * and comprehensive security features with monitoring and logging capabilities.
 */

import { injectable } from 'inversify'; // v6.1.1
import { sign, verify } from 'jsonwebtoken'; // v9.0.0
import { v4 as uuidv4 } from 'uuid'; // v9.0.0
import { Redis } from 'ioredis'; // v5.3.2
import { Logger } from '../../../../shared/utils/logger';
import { CustomError } from '../../../../shared/utils/error-handler';
import { auth } from '../config';
import { StatusCodes } from 'http-status-codes'; // v2.2.0

// Token types and constants
const TOKEN_TYPES = {
  ACCESS: 'access',
  REFRESH: 'refresh'
} as const;

// Role hierarchy and permissions
const USER_ROLES = {
  ADMIN: 'admin',
  MANAGER: 'manager',
  AGENT: 'agent',
  READ_ONLY: 'read_only'
} as const;

const ROLE_HIERARCHY = {
  [USER_ROLES.ADMIN]: 3,
  [USER_ROLES.MANAGER]: 2,
  [USER_ROLES.AGENT]: 1,
  [USER_ROLES.READ_ONLY]: 0
} as const;

// Error messages
const ERROR_MESSAGES = {
  INVALID_TOKEN: 'Invalid token provided',
  EXPIRED_TOKEN: 'Token has expired',
  INSUFFICIENT_PERMISSIONS: 'Insufficient permissions for this action',
  INVALID_CREDENTIALS: 'Invalid credentials provided',
  TOKEN_BLACKLISTED: 'Token has been revoked',
  INVALID_REFRESH: 'Invalid refresh token',
  RATE_LIMIT_EXCEEDED: 'Too many token requests'
} as const;

// Interfaces
interface TokenPayload {
  userId: string;
  role: string;
  type: string;
  exp: number;
  iat: number;
  jti: string;
  deviceId: string;
  ipAddress: string;
}

interface TokenResponse {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  tokenType: string;
}

/**
 * Authentication Service with enhanced security features
 */
@injectable()
export class AuthService {
  private readonly logger: Logger;
  private readonly tokenCache: Redis;
  private readonly maxRetryAttempts: number = 3;

  constructor(
    logger: Logger,
    cache: Redis,
    config: typeof auth
  ) {
    this.logger = logger;
    this.tokenCache = cache;

    // Validate JWT configuration
    if (!config.JWT_SECRET || config.JWT_SECRET.length < 32) {
      throw new CustomError(
        'Invalid JWT configuration',
        StatusCodes.INTERNAL_SERVER_ERROR,
        'INVALID_CONFIG'
      );
    }
  }

  /**
   * Generates secure access and refresh tokens
   */
  public async generateTokens(
    userId: string,
    role: string,
    deviceId: string,
    ipAddress: string
  ): Promise<TokenResponse> {
    try {
      // Validate role
      if (!Object.values(USER_ROLES).includes(role as any)) {
        throw new CustomError(
          'Invalid role specified',
          StatusCodes.BAD_REQUEST,
          'INVALID_ROLE'
        );
      }

      // Generate unique token IDs
      const accessTokenId = uuidv4();
      const refreshTokenId = uuidv4();

      // Create token payloads
      const accessPayload: TokenPayload = {
        userId,
        role,
        type: TOKEN_TYPES.ACCESS,
        exp: Math.floor(Date.now() / 1000) + 3600, // 1 hour
        iat: Math.floor(Date.now() / 1000),
        jti: accessTokenId,
        deviceId,
        ipAddress
      };

      const refreshPayload: TokenPayload = {
        userId,
        role,
        type: TOKEN_TYPES.REFRESH,
        exp: Math.floor(Date.now() / 1000) + 604800, // 7 days
        iat: Math.floor(Date.now() / 1000),
        jti: refreshTokenId,
        deviceId,
        ipAddress
      };

      // Sign tokens with RS256
      const accessToken = sign(accessPayload, auth.JWT_SECRET, { algorithm: 'RS256' });
      const refreshToken = sign(refreshPayload, auth.JWT_SECRET, { algorithm: 'RS256' });

      // Cache token metadata
      await this.tokenCache.setex(
        `token:${accessTokenId}`,
        3600,
        JSON.stringify({ userId, deviceId, ipAddress })
      );

      await this.tokenCache.setex(
        `token:${refreshTokenId}`,
        604800,
        JSON.stringify({ userId, deviceId, ipAddress })
      );

      this.logger.info('Tokens generated successfully', {
        userId,
        deviceId,
        tokenIds: [accessTokenId, refreshTokenId]
      });

      return {
        accessToken,
        refreshToken,
        expiresIn: 3600,
        tokenType: 'Bearer'
      };
    } catch (error) {
      this.logger.error('Token generation failed', error as Error, {
        userId,
        deviceId
      });
      throw error;
    }
  }

  /**
   * Verifies and validates tokens
   */
  public async verifyToken(
    token: string,
    type: string
  ): Promise<TokenPayload> {
    try {
      // Verify token signature and decode payload
      const decoded = verify(token, auth.JWT_SECRET, {
        algorithms: ['RS256']
      }) as TokenPayload;

      // Validate token type
      if (decoded.type !== type) {
        throw new CustomError(
          'Invalid token type',
          StatusCodes.UNAUTHORIZED,
          'INVALID_TOKEN_TYPE'
        );
      }

      // Check token blacklist
      const isBlacklisted = await this.tokenCache.exists(`blacklist:${decoded.jti}`);
      if (isBlacklisted) {
        throw new CustomError(
          ERROR_MESSAGES.TOKEN_BLACKLISTED,
          StatusCodes.UNAUTHORIZED,
          'TOKEN_BLACKLISTED'
        );
      }

      // Verify token metadata
      const metadata = await this.tokenCache.get(`token:${decoded.jti}`);
      if (!metadata) {
        throw new CustomError(
          ERROR_MESSAGES.INVALID_TOKEN,
          StatusCodes.UNAUTHORIZED,
          'INVALID_TOKEN'
        );
      }

      this.logger.debug('Token verified successfully', {
        userId: decoded.userId,
        tokenId: decoded.jti
      });

      return decoded;
    } catch (error) {
      this.logger.error('Token verification failed', error as Error);
      throw new CustomError(
        ERROR_MESSAGES.INVALID_TOKEN,
        StatusCodes.UNAUTHORIZED,
        'INVALID_TOKEN'
      );
    }
  }

  /**
   * Refreshes access token using refresh token
   */
  public async refreshAccessToken(
    refreshToken: string,
    deviceId: string,
    ipAddress: string
  ): Promise<string> {
    try {
      // Verify refresh token
      const decoded = await this.verifyToken(refreshToken, TOKEN_TYPES.REFRESH);

      // Validate device and IP
      if (decoded.deviceId !== deviceId || decoded.ipAddress !== ipAddress) {
        throw new CustomError(
          'Invalid token context',
          StatusCodes.UNAUTHORIZED,
          'INVALID_CONTEXT'
        );
      }

      // Generate new access token
      const { accessToken } = await this.generateTokens(
        decoded.userId,
        decoded.role,
        deviceId,
        ipAddress
      );

      this.logger.info('Access token refreshed', {
        userId: decoded.userId,
        deviceId
      });

      return accessToken;
    } catch (error) {
      this.logger.error('Token refresh failed', error as Error);
      throw error;
    }
  }

  /**
   * Checks role-based permissions
   */
  public async checkPermission(
    userRole: string,
    requiredRole: string,
    resource: string
  ): Promise<boolean> {
    try {
      // Validate roles
      if (!ROLE_HIERARCHY.hasOwnProperty(userRole) || 
          !ROLE_HIERARCHY.hasOwnProperty(requiredRole)) {
        throw new CustomError(
          'Invalid role specified',
          StatusCodes.BAD_REQUEST,
          'INVALID_ROLE'
        );
      }

      // Check role hierarchy
      const hasPermission = ROLE_HIERARCHY[userRole] >= ROLE_HIERARCHY[requiredRole];

      this.logger.debug('Permission check completed', {
        userRole,
        requiredRole,
        resource,
        hasPermission
      });

      return hasPermission;
    } catch (error) {
      this.logger.error('Permission check failed', error as Error);
      throw error;
    }
  }
}