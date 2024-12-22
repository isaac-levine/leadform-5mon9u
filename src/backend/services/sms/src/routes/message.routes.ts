/**
 * @fileoverview Express router configuration for SMS message endpoints with enhanced monitoring,
 * security features, and AI confidence tracking.
 * @version 1.0.0
 */

import { Router } from 'express'; // ^4.18.0
import { container } from 'tsyringe'; // ^4.8.0
import rateLimit from 'express-rate-limit'; // ^6.7.0
import { MessageController } from '../controllers/message.controller';
import { requestLoggingMiddleware } from '../../../shared/middleware/logging.middleware';
import { errorMiddleware } from '../../../shared/middleware/error.middleware';
import { AI_CONFIG, API_CONFIG } from '../../../shared/constants';

// Constants for route configuration
const BASE_PATH = '/api/v1/messages';
const RATE_LIMIT_WINDOW = API_CONFIG.RATE_LIMIT_WINDOW;
const RATE_LIMIT_MAX_REQUESTS = API_CONFIG.MAX_REQUESTS;
const CACHE_TTL = 300; // 5 minutes cache for status endpoints

/**
 * Configures and returns Express router with enhanced message endpoints
 * Implements comprehensive monitoring, security features, and AI confidence tracking
 * 
 * @returns {Router} Configured Express router instance
 */
export function configureMessageRoutes(): Router {
    const router = Router();
    const messageController = container.resolve(MessageController);

    // Apply rate limiting middleware
    const messageLimiter = rateLimit({
        windowMs: RATE_LIMIT_WINDOW,
        max: RATE_LIMIT_MAX_REQUESTS,
        standardHeaders: true,
        legacyHeaders: false,
        message: {
            status: 'error',
            message: 'Too many requests, please try again later.'
        }
    });

    // Apply request logging middleware with performance tracking
    router.use(requestLoggingMiddleware);

    /**
     * POST /api/v1/messages/send
     * Send new SMS message with AI processing
     * 
     * @security JWT
     * @rateLimit 100 requests per 15 minutes
     */
    router.post('/send', messageLimiter, async (req, res, next) => {
        try {
            const startTime = Date.now();
            await messageController.sendMessage(req, res);
            
            // Monitor processing time against technical requirements
            const processingTime = Date.now() - startTime;
            if (processingTime > AI_CONFIG.PROCESSING_TIMEOUT) {
                console.warn(`Message processing exceeded ${AI_CONFIG.PROCESSING_TIMEOUT}ms threshold: ${processingTime}ms`);
            }
        } catch (error) {
            next(error);
        }
    });

    /**
     * GET /api/v1/messages/:id/status
     * Retrieve message status with delivery tracking
     * 
     * @security JWT
     * @cache 5 minutes
     */
    router.get('/:id/status', async (req, res, next) => {
        try {
            res.set('Cache-Control', `public, max-age=${CACHE_TTL}`);
            await messageController.getMessageStatus(req, res);
        } catch (error) {
            next(error);
        }
    });

    /**
     * PUT /api/v1/messages/:id/status
     * Update message status with validation
     * 
     * @security JWT
     */
    router.put('/:id/status', async (req, res, next) => {
        try {
            await messageController.updateMessageStatus(req, res);
        } catch (error) {
            next(error);
        }
    });

    /**
     * PUT /api/v1/messages/:id/confidence
     * Update AI confidence score with validation
     * 
     * @security JWT
     */
    router.put('/:id/confidence', async (req, res, next) => {
        try {
            await messageController.updateAIConfidence(req, res);
        } catch (error) {
            next(error);
        }
    });

    /**
     * GET /api/v1/messages/health
     * Service health check endpoint with queue metrics
     * 
     * @security JWT
     * @cache 1 minute
     */
    router.get('/health', async (req, res, next) => {
        try {
            res.set('Cache-Control', 'public, max-age=60');
            await messageController.getQueueHealth(req, res);
        } catch (error) {
            next(error);
        }
    });

    // Apply error handling middleware
    router.use(errorMiddleware);

    return router;
}

export default configureMessageRoutes;