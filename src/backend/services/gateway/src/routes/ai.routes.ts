/**
 * @fileoverview AI Service Routes Configuration
 * @version 1.0.0
 * 
 * Implements secure routing and middleware configuration for AI-driven conversation
 * processing and intent classification with comprehensive monitoring, performance
 * optimization, and error handling.
 */

import express, { Request, Response, NextFunction } from 'express'; // v4.18.0
import { StatusCodes } from 'http-status-codes'; // v2.2.0
import { v4 as uuidv4 } from 'uuid'; // v9.0.0
import { authenticate, authorize } from '../middleware/auth.middleware';
import { rateLimitMiddleware } from '../middleware/ratelimit.middleware';
import { Logger } from '../../../../shared/utils/logger';
import { createError, handleError } from '../../../../shared/utils/error-handler';
import { AI_CONFIG, ERROR_THRESHOLDS } from '../../../../shared/constants';
import { MessageDirection, ConversationStatus } from '../../../../shared/types/sms.types';

// Initialize router and logger
const router = express.Router();
const logger = new Logger('AIRoutes', 'ApiGateway');

// Constants for route configuration
const AI_ROUTES = {
  PROCESS_MESSAGE: '/api/v1/conversations',
  ANALYZE_INTENT: '/api/v1/intents'
} as const;

// Interface definitions
interface ProcessMessageRequest {
  conversation_id: string;
  content: string;
  direction: MessageDirection;
  metadata?: Record<string, any>;
  timeout?: number;
}

interface IntentAnalysisRequest {
  message_id: string;
  content: string;
  metadata?: Record<string, any>;
  timeout?: number;
}

interface AIResponse {
  processed_content: string;
  confidence_score: number;
  processing_time: number;
  requires_human: boolean;
  metadata: Record<string, any>;
}

/**
 * Validates request payload against schema
 */
function validateMessageRequest(req: Request): ProcessMessageRequest {
  const { conversation_id, content, direction, metadata, timeout } = req.body;

  if (!conversation_id || !content || !direction) {
    throw createError(
      'Missing required fields',
      StatusCodes.BAD_REQUEST,
      'INVALID_REQUEST'
    );
  }

  if (!Object.values(MessageDirection).includes(direction)) {
    throw createError(
      'Invalid message direction',
      StatusCodes.BAD_REQUEST,
      'INVALID_DIRECTION'
    );
  }

  return {
    conversation_id,
    content,
    direction,
    metadata: metadata || {},
    timeout: timeout || AI_CONFIG.PROCESSING_TIMEOUT
  };
}

/**
 * Processes incoming messages with AI analysis and confidence scoring
 */
async function processMessage(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const correlationId = uuidv4();
  const startTime = Date.now();

  try {
    // Validate request payload
    const payload = validateMessageRequest(req);
    
    // Start performance monitoring
    logger.info('Processing message request', {
      correlationId,
      conversationId: payload.conversation_id,
      direction: payload.direction
    });

    // Set processing timeout
    const timeout = Math.min(
      payload.timeout || AI_CONFIG.PROCESSING_TIMEOUT,
      AI_CONFIG.PROCESSING_TIMEOUT
    );

    // Process message with timeout
    const result = await Promise.race([
      processAIResponse(payload, correlationId),
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error('AI processing timeout')), timeout)
      )
    ]) as AIResponse;

    // Validate AI confidence
    if (result.confidence_score < AI_CONFIG.CONFIDENCE_THRESHOLD) {
      logger.warn('Low confidence AI response', {
        correlationId,
        confidence: result.confidence_score,
        conversationId: payload.conversation_id
      });
    }

    // Log performance metrics
    const processingTime = Date.now() - startTime;
    logger.info('Message processing completed', {
      correlationId,
      processingTime,
      confidence: result.confidence_score
    });

    res.status(StatusCodes.OK).json({
      ...result,
      correlation_id: correlationId,
      processing_time: processingTime
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Analyzes message intent with confidence scoring
 */
async function analyzeIntent(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const correlationId = uuidv4();
  const startTime = Date.now();

  try {
    const { message_id, content, metadata, timeout } = req.body;

    if (!message_id || !content) {
      throw createError(
        'Missing required fields',
        StatusCodes.BAD_REQUEST,
        'INVALID_REQUEST'
      );
    }

    // Process intent analysis
    const result = await Promise.race([
      analyzeMessageIntent({
        message_id,
        content,
        metadata: metadata || {},
        timeout: timeout || AI_CONFIG.PROCESSING_TIMEOUT
      }, correlationId),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Intent analysis timeout')),
        AI_CONFIG.PROCESSING_TIMEOUT)
      )
    ]) as AIResponse;

    // Log performance metrics
    const processingTime = Date.now() - startTime;
    logger.info('Intent analysis completed', {
      correlationId,
      processingTime,
      confidence: result.confidence_score
    });

    res.status(StatusCodes.OK).json({
      ...result,
      correlation_id: correlationId,
      processing_time: processingTime
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Configure routes with authentication, authorization, and rate limiting
 */

// Process message route
router.post(
  AI_ROUTES.PROCESS_MESSAGE,
  authenticate,
  authorize(['agent', 'manager', 'admin']),
  rateLimitMiddleware,
  processMessage
);

// Analyze intent route
router.post(
  AI_ROUTES.ANALYZE_INTENT,
  authenticate,
  authorize(['agent', 'manager', 'admin']),
  rateLimitMiddleware,
  analyzeIntent
);

// Error handling middleware
router.use((error: Error, req: Request, res: Response, next: NextFunction) => {
  const errorResponse = handleError(error, {
    path: req.path,
    method: req.method,
    headers: req.headers
  });
  
  res.status(errorResponse.status).json(errorResponse);
});

// Helper functions
async function processAIResponse(
  payload: ProcessMessageRequest,
  correlationId: string
): Promise<AIResponse> {
  // Implementation would integrate with AI service
  // This is a placeholder for the actual implementation
  throw new Error('AI service integration not implemented');
}

async function analyzeMessageIntent(
  payload: IntentAnalysisRequest,
  correlationId: string
): Promise<AIResponse> {
  // Implementation would integrate with AI service
  // This is a placeholder for the actual implementation
  throw new Error('AI service integration not implemented');
}

export default router;