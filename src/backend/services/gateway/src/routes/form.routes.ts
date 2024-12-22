/**
 * @fileoverview Form Routes Configuration for API Gateway
 * @version 1.0.0
 * 
 * Implements secure routing for form-related endpoints with:
 * - Authentication and authorization
 * - Rate limiting
 * - Request validation
 * - Error handling
 * - Service proxying
 */

import { Router, Request, Response } from 'express'; // v4.18.2
import { StatusCodes } from 'http-status-codes'; // v2.2.0
import axios from 'axios'; // v1.6.2
import { authenticate } from '../middleware/auth.middleware';
import { authorize } from '../middleware/auth.middleware';
import { rateLimitMiddleware } from '../middleware/ratelimit.middleware';
import { handleError } from '../../../../shared/utils/error-handler';
import { Logger } from '../../../../shared/utils/logger';

// Initialize logger
const logger = new Logger('FormRoutes', 'ApiGateway');

// Constants
const FORM_SERVICE_URL = process.env.FORM_SERVICE_URL || 'http://form-service:3000';
const ROUTE_PREFIX = '/api/v1/forms';
const REQUEST_TIMEOUT = 5000;

/**
 * Interface for form request validation
 */
interface FormRequest extends Request {
  user?: {
    userId: string;
    role: string;
  };
}

/**
 * Initializes form routes with middleware chains and error handling
 */
function initializeFormRoutes(): Router {
  const router = Router();

  // Apply rate limiting to all routes
  router.use(rateLimitMiddleware);

  // Create form - Restricted to admin, manager, agent
  router.post('/',
    authenticate,
    authorize(['admin', 'manager', 'agent']),
    proxyFormRequest
  );

  // Get form by ID - All authenticated users
  router.get('/:id',
    authenticate,
    authorize(['admin', 'manager', 'agent', 'readonly']),
    proxyFormRequest
  );

  // Update form - Restricted to admin and manager
  router.put('/:id',
    authenticate,
    authorize(['admin', 'manager']),
    proxyFormRequest
  );

  // Delete form - Admin only
  router.delete('/:id',
    authenticate,
    authorize(['admin']),
    proxyFormRequest
  );

  // List forms - All authenticated users
  router.get('/',
    authenticate,
    authorize(['admin', 'manager', 'agent', 'readonly']),
    proxyFormRequest
  );

  return router;
}

/**
 * Proxies form requests to the form service with error handling
 */
async function proxyFormRequest(req: FormRequest, res: Response): Promise<void> {
  const startTime = Date.now();
  const correlationId = req.headers['x-correlation-id'] as string;

  try {
    // Prepare request URL
    const url = `${FORM_SERVICE_URL}${req.path}`;

    // Forward request with headers
    const response = await axios({
      method: req.method,
      url,
      data: req.body,
      params: req.query,
      headers: {
        ...req.headers,
        'x-user-id': req.user?.userId,
        'x-user-role': req.user?.role,
        'x-correlation-id': correlationId
      },
      timeout: REQUEST_TIMEOUT
    });

    // Log successful request
    logger.info('Form request processed', {
      method: req.method,
      path: req.path,
      userId: req.user?.userId,
      duration: Date.now() - startTime,
      correlationId
    });

    // Return response
    res.status(response.status).json(response.data);
  } catch (error: any) {
    // Handle axios errors
    if (axios.isAxiosError(error)) {
      const statusCode = error.response?.status || StatusCodes.INTERNAL_SERVER_ERROR;
      const errorResponse = handleError(error, {
        path: req.path,
        method: req.method,
        correlationId,
        userId: req.user?.userId
      });

      logger.error('Form request failed', error, {
        method: req.method,
        path: req.path,
        userId: req.user?.userId,
        duration: Date.now() - startTime,
        correlationId,
        statusCode
      });

      res.status(statusCode).json(errorResponse);
    } else {
      // Handle unexpected errors
      const errorResponse = handleError(error, {
        path: req.path,
        method: req.method,
        correlationId,
        userId: req.user?.userId
      });

      logger.error('Unexpected error in form request', error, {
        method: req.method,
        path: req.path,
        userId: req.user?.userId,
        duration: Date.now() - startTime,
        correlationId
      });

      res.status(StatusCodes.INTERNAL_SERVER_ERROR).json(errorResponse);
    }
  }
}

// Initialize and export router
const router = initializeFormRoutes();
export default router;