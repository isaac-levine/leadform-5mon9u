import express from 'express'; // ^4.18.0
import compression from 'compression'; // ^1.7.4
import cors from 'cors'; // ^2.8.5
import helmet from 'helmet'; // ^4.6.0
import { RateLimiterMemory } from 'rate-limiter-flexible'; // ^2.4.1

import { SubmissionController } from '../controllers/submission.controller';
import { validateSubmissionData } from '../validators/submission.validator';
import { errorMiddleware } from '../../../shared/middleware/error.middleware';
import { Logger } from '../../../shared/utils/logger';
import { API_CONFIG } from '../../../shared/constants';

// Initialize logger
const logger = new Logger('SubmissionRoutes', 'form-service');

// Initialize rate limiter
const rateLimiter = new RateLimiterMemory({
  points: API_CONFIG.MAX_REQUESTS,
  duration: API_CONFIG.RATE_LIMIT_WINDOW,
  blockDuration: API_CONFIG.RATE_LIMIT_WINDOW
});

/**
 * Rate limiting middleware with enhanced monitoring
 */
const rateLimitMiddleware = async (req: express.Request, res: express.Response, next: express.NextFunction) => {
  try {
    await rateLimiter.consume(req.ip);
    next();
  } catch (error) {
    logger.warn('Rate limit exceeded', {
      ip: req.ip,
      path: req.path,
      correlationId: req.headers['x-correlation-id']
    });
    res.status(429).json({
      error: 'Too many requests',
      code: 'RATE_LIMIT_EXCEEDED'
    });
  }
};

/**
 * CORS configuration with security enhancements
 */
const corsOptions = {
  origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000'],
  methods: ['POST', 'GET'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Correlation-ID'],
  exposedHeaders: ['X-Total-Count', 'X-Page', 'X-Per-Page'],
  maxAge: 600, // 10 minutes
  credentials: true
};

/**
 * Compression options for response optimization
 */
const compressionOptions = {
  level: 6,
  threshold: 1024,
  filter: (req: express.Request) => {
    return req.headers['accept-encoding']?.includes('gzip') || false;
  }
};

/**
 * Initialize and configure submission routes with enhanced security
 */
export function initializeSubmissionRoutes(): express.Router {
  const router = express.Router();
  const submissionController = new SubmissionController();

  // Apply global middleware
  router.use(helmet());
  router.use(cors(corsOptions));
  router.use(compression(compressionOptions));
  router.use(express.json({ limit: '5mb' }));
  router.use(rateLimitMiddleware);

  // Request logging middleware
  router.use((req: express.Request, res: express.Response, next: express.NextFunction) => {
    logger.info('Incoming submission request', {
      method: req.method,
      path: req.path,
      correlationId: req.headers['x-correlation-id']
    });
    next();
  });

  /**
   * POST /api/v1/submissions
   * Create new form submission with enhanced validation and security
   */
  router.post(
    '/api/v1/submissions',
    validateSubmissionData,
    async (req: express.Request, res: express.Response, next: express.NextFunction) => {
      try {
        await submissionController.createSubmission(req, res);
      } catch (error) {
        next(error);
      }
    }
  );

  /**
   * GET /api/v1/submissions/:id
   * Retrieve specific submission with security checks
   */
  router.get(
    '/api/v1/submissions/:id',
    async (req: express.Request, res: express.Response, next: express.NextFunction) => {
      try {
        await submissionController.getSubmission(req, res);
      } catch (error) {
        next(error);
      }
    }
  );

  /**
   * GET /api/v1/forms/:formId/submissions
   * Retrieve all submissions for a form with pagination
   */
  router.get(
    '/api/v1/forms/:formId/submissions',
    async (req: express.Request, res: express.Response, next: express.NextFunction) => {
      try {
        await submissionController.getFormSubmissions(req, res);
      } catch (error) {
        next(error);
      }
    }
  );

  // Apply error handling middleware
  router.use(errorMiddleware);

  return router;
}

// Export configured router
export const submissionRouter = initializeSubmissionRoutes();