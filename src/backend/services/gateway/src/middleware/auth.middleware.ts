/**
 * @fileoverview Authentication and Authorization Middleware
 * @version 1.0.0
 * 
 * Implements secure JWT token validation and role-based access control
 * with comprehensive security logging and audit trails.
 */

import { Request, Response, NextFunction } from 'express'; // v4.18.0
import { StatusCodes } from 'http-status-codes'; // v2.2.0
import { v4 as uuidv4 } from 'uuid'; // v9.0.0
import { verifyToken, UserPayload } from '../services/auth.service';
import { handleError } from '../../../shared/utils/error-handler';
import { logger } from '../../../shared/utils/logger';

// Constants
const BEARER_PREFIX = 'Bearer ';
const MAX_TOKEN_AGE = 3600; // 1 hour in seconds
const MAX_FAILED_ATTEMPTS = 5;

// Role hierarchy for authorization checks
const ROLE_HIERARCHY = {
  admin: 3,
  manager: 2,
  agent: 1,
  readonly: 0
} as const;

// Available role levels
type RoleLevel = keyof typeof ROLE_HIERARCHY;

/**
 * Extended Express Request interface with authenticated user data
 */
export interface AuthenticatedRequest extends Request {
  user?: UserPayload;
  correlationId: string;
}

/**
 * Authentication middleware that validates JWT tokens and attaches user data
 * to the request object with comprehensive security logging
 */
export const authenticate = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    // Generate correlation ID for request tracking
    const correlationId = uuidv4();
    req.correlationId = correlationId;

    // Extract and validate Authorization header
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith(BEARER_PREFIX)) {
      logger.warn('Missing or invalid Authorization header', {
        correlationId,
        path: req.path,
        ip: req.ip
      });
      throw new Error('Authorization header required');
    }

    // Extract token
    const token = authHeader.slice(BEARER_PREFIX.length);
    if (!token) {
      logger.warn('Empty token provided', {
        correlationId,
        path: req.path,
        ip: req.ip
      });
      throw new Error('Valid token required');
    }

    // Verify token and decode payload
    const decodedToken = await verifyToken(token, 'access');

    // Validate token expiry
    const currentTime = Math.floor(Date.now() / 1000);
    if (decodedToken.exp < currentTime) {
      logger.warn('Expired token used', {
        correlationId,
        userId: decodedToken.userId,
        tokenExp: decodedToken.exp
      });
      throw new Error('Token expired');
    }

    // Attach user data to request
    req.user = decodedToken;

    // Log successful authentication
    logger.info('Authentication successful', {
      correlationId,
      userId: decodedToken.userId,
      role: decodedToken.role,
      path: req.path
    });

    next();
  } catch (error) {
    // Handle authentication errors
    const errorResponse = handleError(error, {
      correlationId: req.correlationId,
      path: req.path,
      method: req.method,
      headers: req.headers
    });

    res.status(StatusCodes.UNAUTHORIZED).json(errorResponse);
  }
};

/**
 * Authorization middleware factory that implements role-based access control
 * with hierarchical permission checks
 */
export const authorize = (allowedRoles: RoleLevel[]) => {
  return async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      // Verify authenticated request
      if (!req.user) {
        logger.error('Authorization attempted without authentication', {
          correlationId: req.correlationId,
          path: req.path
        });
        throw new Error('Authentication required');
      }

      const userRole = req.user.role.toLowerCase() as RoleLevel;

      // Verify role exists in hierarchy
      if (!(userRole in ROLE_HIERARCHY)) {
        logger.error('Invalid role encountered', {
          correlationId: req.correlationId,
          userId: req.user.userId,
          role: userRole
        });
        throw new Error('Invalid role');
      }

      // Check role authorization
      const userRoleLevel = ROLE_HIERARCHY[userRole];
      const isAuthorized = allowedRoles.some(
        role => userRoleLevel >= ROLE_HIERARCHY[role]
      );

      if (!isAuthorized) {
        logger.warn('Unauthorized access attempt', {
          correlationId: req.correlationId,
          userId: req.user.userId,
          role: userRole,
          requiredRoles: allowedRoles,
          path: req.path
        });
        throw new Error('Insufficient permissions');
      }

      // Log successful authorization
      logger.info('Authorization successful', {
        correlationId: req.correlationId,
        userId: req.user.userId,
        role: userRole,
        path: req.path
      });

      next();
    } catch (error) {
      // Handle authorization errors
      const errorResponse = handleError(error, {
        correlationId: req.correlationId,
        path: req.path,
        method: req.method,
        headers: req.headers
      });

      res.status(StatusCodes.FORBIDDEN).json(errorResponse);
    }
  };
};
```

This implementation provides:

1. JWT Token Authentication:
- Validates tokens with secure extraction and verification
- Checks token expiry and structure
- Attaches decoded user data to request object
- Implements comprehensive security logging

2. Role-Based Authorization:
- Hierarchical role system (admin > manager > agent > readonly)
- Role level validation against allowed roles
- Permission inheritance through role hierarchy
- Audit logging for authorization decisions

3. Security Features:
- Correlation IDs for request tracking
- Secure error handling and sanitization
- Comprehensive security logging
- Request context preservation

4. Type Safety:
- Strong typing with TypeScript
- Extended Request interface for authenticated routes
- Clear role level type definitions
- Proper error handling types

The middleware can be used in routes like:

```typescript
router.get('/sensitive-data', 
  authenticate, 
  authorize(['manager', 'admin']), 
  sensitiveDataController
);