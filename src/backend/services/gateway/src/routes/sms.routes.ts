/**
 * @fileoverview SMS Routes Configuration for API Gateway
 * @version 1.0.0
 * 
 * Implements secure, scalable SMS and conversation management endpoints with:
 * - Authentication and authorization
 * - Rate limiting and abuse prevention
 * - Error handling and logging
 * - Request validation and sanitization
 */

import { Router, Request, Response, NextFunction } from 'express'; // v4.18.2
import axios from 'axios'; // v1.6.0
import { StatusCodes } from 'http-status-codes'; // v2.2.0
import { authenticate } from '../middleware/auth.middleware';
import { authorize } from '../middleware/auth.middleware';
import { rateLimitMiddleware } from '../middleware/ratelimit.middleware';
import config from '../config';
import { Logger } from '../../../../shared/utils/logger';
import { createError } from '../../../../shared/utils/error-handler';
import { ConversationStatus, MessageDirection } from '../../../../shared/types/sms.types';

// Initialize logger
const logger = new Logger('SMSRoutes', 'ApiGateway');

// Constants
const AXIOS_TIMEOUT = 5000;
const MAX_RETRIES = 3;
const RETRY_DELAY = 1000;

// Create axios instance for SMS service communication
const smsServiceClient = axios.create({
  baseURL: config.services.sms.url,
  timeout: AXIOS_TIMEOUT,
  headers: {
    'Content-Type': 'application/json'
  }
});

// Interfaces
interface ConversationFilters {
  status?: ConversationStatus;
  assignedAgent?: string | null;
  startDate?: Date;
  endDate?: Date;
  page: number;
  limit: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

interface MessagePayload {
  conversationId: string;
  content: string;
  metadata?: Record<string, any>;
  priority?: 'normal' | 'high';
  retryCount?: number;
  callbackUrl?: string;
}

// Create router instance
const router = Router();

/**
 * GET /conversations
 * Retrieves paginated list of SMS conversations with filtering
 */
router.get(
  '/conversations',
  authenticate,
  authorize(['admin', 'agent']),
  rateLimitMiddleware,
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      // Extract and validate query parameters
      const filters: ConversationFilters = {
        status: req.query.status as ConversationStatus,
        assignedAgent: req.query.assignedAgent as string,
        startDate: req.query.startDate ? new Date(req.query.startDate as string) : undefined,
        endDate: req.query.endDate ? new Date(req.query.endDate as string) : undefined,
        page: parseInt(req.query.page as string) || 1,
        limit: parseInt(req.query.limit as string) || 10,
        sortBy: req.query.sortBy as string,
        sortOrder: req.query.sortOrder as 'asc' | 'desc'
      };

      // Validate date range
      if (filters.startDate && filters.endDate && filters.startDate > filters.endDate) {
        throw createError(
          'Invalid date range',
          StatusCodes.BAD_REQUEST,
          'INVALID_DATE_RANGE'
        );
      }

      // Forward request to SMS service
      const response = await smsServiceClient.get('/conversations', {
        params: filters,
        headers: {
          'X-User-Id': (req as any).user.userId,
          'X-Correlation-Id': (req as any).correlationId
        }
      });

      logger.info('Conversations retrieved successfully', {
        userId: (req as any).user.userId,
        filters
      });

      res.status(StatusCodes.OK).json(response.data);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /messages
 * Sends new SMS message with validation and delivery confirmation
 */
router.post(
  '/messages',
  authenticate,
  authorize(['admin', 'agent']),
  rateLimitMiddleware,
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      // Validate request payload
      const messagePayload: MessagePayload = {
        conversationId: req.body.conversationId,
        content: req.body.content?.trim(),
        metadata: req.body.metadata,
        priority: req.body.priority || 'normal',
        retryCount: req.body.retryCount || 0,
        callbackUrl: req.body.callbackUrl
      };

      if (!messagePayload.conversationId || !messagePayload.content) {
        throw createError(
          'Missing required fields',
          StatusCodes.BAD_REQUEST,
          'INVALID_PAYLOAD'
        );
      }

      // Implement retry logic for message sending
      let lastError: Error | null = null;
      for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
        try {
          const response = await smsServiceClient.post('/messages', {
            ...messagePayload,
            direction: MessageDirection.OUTBOUND,
            sender: (req as any).user.userId
          }, {
            headers: {
              'X-User-Id': (req as any).user.userId,
              'X-Correlation-Id': (req as any).correlationId
            }
          });

          logger.info('Message sent successfully', {
            userId: (req as any).user.userId,
            conversationId: messagePayload.conversationId,
            messageId: response.data.id
          });

          return res.status(StatusCodes.CREATED).json(response.data);
        } catch (error) {
          lastError = error as Error;
          if (attempt < MAX_RETRIES) {
            await new Promise(resolve => setTimeout(resolve, RETRY_DELAY * Math.pow(2, attempt)));
          }
        }
      }

      // If all retries failed
      throw lastError;
    } catch (error) {
      next(error);
    }
  }
);

/**
 * PUT /conversations/:id/takeover
 * Initiates human takeover for AI-managed conversation
 */
router.put(
  '/conversations/:id/takeover',
  authenticate,
  authorize(['admin', 'agent']),
  rateLimitMiddleware,
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const conversationId = req.params.id;

      const response = await smsServiceClient.put(`/conversations/${conversationId}/takeover`, {
        agentId: (req as any).user.userId
      }, {
        headers: {
          'X-User-Id': (req as any).user.userId,
          'X-Correlation-Id': (req as any).correlationId
        }
      });

      logger.info('Conversation takeover successful', {
        userId: (req as any).user.userId,
        conversationId
      });

      res.status(StatusCodes.OK).json(response.data);
    } catch (error) {
      next(error);
    }
  }
);

export default router;