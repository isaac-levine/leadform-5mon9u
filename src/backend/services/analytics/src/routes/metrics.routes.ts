/**
 * Analytics Metrics Router Configuration
 * Implements secure, monitored endpoints for analytics metrics access
 * with comprehensive error handling and performance optimization
 * @version 1.0.0
 */

import { Router } from 'express'; // ^4.18.2
import { authenticate } from 'passport'; // ^0.6.0
import compression from 'compression'; // ^1.7.4
import rateLimit from 'express-rate-limit'; // ^6.7.0
import { MetricsController } from '../controllers/metrics.controller';
import { errorMiddleware } from '../../../shared/middleware/error.middleware';
import { requestLoggingMiddleware } from '../../../shared/middleware/logging.middleware';
import { MetricType, TimeRange } from '../../../shared/types/analytics.types';
import { ERROR_THRESHOLDS, API_CONFIG } from '../../../shared/constants';

// Route path constants
const METRICS_BASE_PATH = '/metrics';
const OVERVIEW_PATH = '/overview';
const LEADS_PATH = '/leads';
const ENGAGEMENT_PATH = '/engagement';

// Rate limiting configuration
const RATE_LIMIT_WINDOW = API_CONFIG.RATE_LIMIT_WINDOW;
const RATE_LIMIT_MAX = API_CONFIG.MAX_REQUESTS;

// Cache duration for metrics data (5 minutes)
const CACHE_DURATION = 300000;

/**
 * Configures and returns the metrics router with comprehensive middleware chain
 * and secure endpoints for analytics data access
 * @returns Configured Express router with security and monitoring
 */
export function configureMetricsRoutes(): Router {
  const router = Router();
  const metricsController = new MetricsController();

  // Apply global middleware
  router.use(compression()); // Optimize response size
  router.use(requestLoggingMiddleware); // Request tracking and monitoring

  // Configure rate limiting
  const limiter = rateLimit({
    windowMs: RATE_LIMIT_WINDOW,
    max: RATE_LIMIT_MAX,
    message: 'Too many requests from this IP, please try again later',
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req) => req.user?.organizationId || req.ip // Organization-based limiting
  });
  router.use(limiter);

  // Require authentication for all metrics routes
  router.use(authenticate('jwt', { session: false }));

  /**
   * GET /metrics
   * Retrieves metrics with organization filtering and validation
   */
  router.get(METRICS_BASE_PATH, async (req, res, next) => {
    try {
      const { organizationId, type, timeRange } = req.query;

      // Validate required parameters
      if (!organizationId || !type || !timeRange) {
        return res.status(400).json({
          error: 'Missing required parameters',
          requiredParams: ['organizationId', 'type', 'timeRange']
        });
      }

      // Validate metric type
      if (!Object.values(MetricType).includes(type as MetricType)) {
        return res.status(400).json({
          error: 'Invalid metric type',
          allowedTypes: Object.values(MetricType)
        });
      }

      const metrics = await metricsController.getMetrics(
        organizationId as string,
        type as MetricType,
        timeRange as TimeRange
      );

      res.json(metrics);
    } catch (error) {
      next(error);
    }
  });

  /**
   * GET /metrics/overview
   * Retrieves comprehensive analytics overview with caching
   */
  router.get(`${METRICS_BASE_PATH}${OVERVIEW_PATH}`, async (req, res, next) => {
    try {
      const { organizationId } = req.query;

      if (!organizationId) {
        return res.status(400).json({
          error: 'Missing organization ID'
        });
      }

      // Set cache headers
      res.set('Cache-Control', `private, max-age=${CACHE_DURATION / 1000}`);

      const overview = await metricsController.getOverview(organizationId as string);
      res.json(overview);
    } catch (error) {
      next(error);
    }
  });

  /**
   * GET /metrics/leads
   * Retrieves lead-specific metrics with filtering
   */
  router.get(`${METRICS_BASE_PATH}${LEADS_PATH}`, async (req, res, next) => {
    try {
      const { organizationId, timeRange } = req.query;

      if (!organizationId || !timeRange) {
        return res.status(400).json({
          error: 'Missing required parameters',
          requiredParams: ['organizationId', 'timeRange']
        });
      }

      const leadMetrics = await metricsController.getLeadMetrics(
        organizationId as string,
        timeRange as TimeRange
      );

      res.json(leadMetrics);
    } catch (error) {
      next(error);
    }
  });

  /**
   * GET /metrics/engagement
   * Retrieves engagement metrics with performance monitoring
   */
  router.get(`${METRICS_BASE_PATH}${ENGAGEMENT_PATH}`, async (req, res, next) => {
    try {
      const { organizationId, timeRange } = req.query;

      if (!organizationId || !timeRange) {
        return res.status(400).json({
          error: 'Missing required parameters',
          requiredParams: ['organizationId', 'timeRange']
        });
      }

      // Track request start time for performance monitoring
      const startTime = process.hrtime();

      const engagementMetrics = await metricsController.getEngagementMetrics(
        organizationId as string,
        timeRange as TimeRange
      );

      // Check performance against threshold
      const [seconds, nanoseconds] = process.hrtime(startTime);
      const duration = seconds * 1000 + nanoseconds / 1000000;

      if (duration > ERROR_THRESHOLDS.RECOVERY_TIME) {
        console.warn(`Engagement metrics request exceeded performance threshold: ${duration}ms`);
      }

      res.json(engagementMetrics);
    } catch (error) {
      next(error);
    }
  });

  // Apply error handling middleware last
  router.use(errorMiddleware);

  return router;
}