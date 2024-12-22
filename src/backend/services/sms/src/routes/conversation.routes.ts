/**
 * @fileoverview Express router configuration for SMS conversation endpoints
 * Implements provider-agnostic routing, human takeover capabilities, and monitoring
 * @version 1.0.0
 */

import express, { Router, Request, Response, NextFunction } from 'express'; // ^4.18.0
import rateLimit from 'express-rate-limit'; // ^6.0.0
import compression from 'compression'; // ^1.7.4
import { StatusCodes } from 'http-status-codes'; // ^2.2.0
import { ConversationController } from '../controllers/conversation.controller';
import { validateRequest } from '../../../shared/utils/validation';
import { handleError } from '../../../shared/utils/error-handler';
import { API_CONFIG, HEALTH_CHECK_CONFIG } from '../../../shared/constants';

// Initialize router with strict routing
const router: Router = express.Router({
  strict: true,
  caseSensitive: true
});

// Configure rate limiting for conversation endpoints
const conversationRateLimiter = rateLimit({
  windowMs: API_CONFIG.RATE_LIMIT_WINDOW,
  max: API_CONFIG.MAX_REQUESTS,
  standardHeaders: true,
  legacyHeaders: false,
  message: 'Too many requests from this IP, please try again later'
});

// Configure compression for responses
router.use(compression({
  level: 6,
  threshold: 1024,
  filter: (req: Request) => {
    if (req.headers['x-no-compression']) {
      return false;
    }
    return compression.filter(req, req.res);
  }
}));

// Configure timeout middleware
const timeoutMiddleware = (req: Request, res: Response, next: NextFunction) => {
  res.setTimeout(API_CONFIG.TIMEOUT, () => {
    handleError(new Error('Request timeout'), { path: req.path, method: req.method });
    res.status(StatusCodes.REQUEST_TIMEOUT).json({
      error: 'Request timeout',
      code: 'REQUEST_TIMEOUT'
    });
  });
  next();
};

// Health check endpoint for uptime monitoring
router.get('/health', (req: Request, res: Response) => {
  const healthStatus = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memoryUsage: process.memoryUsage(),
    version: process.env.npm_package_version
  };
  res.status(StatusCodes.OK).json(healthStatus);
});

// Get paginated list of conversations with performance monitoring
router.get('/',
  conversationRateLimiter,
  timeoutMiddleware,
  validateRequest('query', {
    page: { type: 'number', optional: true, min: 1 },
    limit: { type: 'number', optional: true, min: 1, max: 100 },
    status: { type: 'string', optional: true },
    agentId: { type: 'string', optional: true },
    startDate: { type: 'string', optional: true },
    endDate: { type: 'string', optional: true }
  }),
  async (req: Request, res: Response) => {
    try {
      await ConversationController.getConversations(req, res);
    } catch (error) {
      handleError(error, { path: req.path, method: req.method });
      res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
        error: 'Failed to retrieve conversations',
        code: 'CONVERSATION_RETRIEVAL_ERROR'
      });
    }
  }
);

// Get conversation by ID with validation and monitoring
router.get('/:id',
  conversationRateLimiter,
  timeoutMiddleware,
  validateRequest('params', {
    id: { type: 'string', required: true }
  }),
  async (req: Request, res: Response) => {
    try {
      await ConversationController.getConversationById(req, res);
    } catch (error) {
      handleError(error, { path: req.path, method: req.method });
      res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
        error: 'Failed to retrieve conversation',
        code: 'CONVERSATION_RETRIEVAL_ERROR'
      });
    }
  }
);

// Update conversation status with error handling
router.put('/:id/status',
  conversationRateLimiter,
  timeoutMiddleware,
  validateRequest('params', {
    id: { type: 'string', required: true }
  }),
  validateRequest('body', {
    status: { type: 'string', required: true }
  }),
  async (req: Request, res: Response) => {
    try {
      await ConversationController.updateConversationStatus(req, res);
    } catch (error) {
      handleError(error, { path: req.path, method: req.method });
      res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
        error: 'Failed to update conversation status',
        code: 'STATUS_UPDATE_ERROR'
      });
    }
  }
);

// Assign agent to conversation with validation
router.put('/:id/assign',
  conversationRateLimiter,
  timeoutMiddleware,
  validateRequest('params', {
    id: { type: 'string', required: true }
  }),
  validateRequest('body', {
    agentId: { type: 'string', required: true }
  }),
  async (req: Request, res: Response) => {
    try {
      await ConversationController.assignAgentToConversation(req, res);
    } catch (error) {
      handleError(error, { path: req.path, method: req.method });
      res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
        error: 'Failed to assign agent',
        code: 'AGENT_ASSIGNMENT_ERROR'
      });
    }
  }
);

// Unassign agent from conversation with monitoring
router.put('/:id/unassign',
  conversationRateLimiter,
  timeoutMiddleware,
  validateRequest('params', {
    id: { type: 'string', required: true }
  }),
  async (req: Request, res: Response) => {
    try {
      await ConversationController.unassignAgentFromConversation(req, res);
    } catch (error) {
      handleError(error, { path: req.path, method: req.method });
      res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
        error: 'Failed to unassign agent',
        code: 'AGENT_UNASSIGNMENT_ERROR'
      });
    }
  }
);

// Error handling middleware
router.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  handleError(err, { path: req.path, method: req.method });
  res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
    error: 'Internal server error',
    code: 'INTERNAL_SERVER_ERROR'
  });
});

export default router;