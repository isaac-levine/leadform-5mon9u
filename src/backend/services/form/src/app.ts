import express from 'express'; // v4.18.2
import cors from 'cors'; // v2.8.5
import helmet from 'helmet'; // v7.0.0
import compression from 'compression'; // v1.7.4

// Import routers
import formRouter from './routes/form.routes';
import submissionRouter from './routes/submission.routes';

// Import middleware
import { errorMiddleware } from '../../shared/middleware/error.middleware';
import { requestLoggingMiddleware } from '../../shared/middleware/logging.middleware';

// Constants for security configuration
const CORS_OPTIONS = {
  origin: [
    process.env.FRONTEND_URL || 'http://localhost:3000',
    process.env.WIDGET_URL || 'http://localhost:3001'
  ],
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: [
    'Content-Type',
    'Authorization',
    'X-Request-ID',
    'X-Correlation-ID'
  ],
  credentials: true,
  maxAge: 86400, // 24 hours
  preflightContinue: false,
  optionsSuccessStatus: 204
};

// Enhanced security headers configuration
const HELMET_CONFIG = {
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"], // Required for form widget
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", 'data:', 'https:'],
      connectSrc: [
        "'self'",
        process.env.FRONTEND_URL || 'http://localhost:3000',
        process.env.WIDGET_URL || 'http://localhost:3001'
      ]
    }
  },
  crossOriginEmbedderPolicy: true,
  crossOriginOpenerPolicy: true,
  crossOriginResourcePolicy: { policy: 'cross-origin' }, // Allow widget embedding
  dnsPrefetchControl: true,
  frameguard: { action: 'deny' },
  hsts: {
    maxAge: 31536000, // 1 year
    includeSubDomains: true,
    preload: true
  },
  ieNoOpen: true,
  noSniff: true,
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
  xssFilter: true
};

/**
 * Initializes and configures the Express application with comprehensive
 * security, logging, and routing setup
 * @returns Configured Express application instance
 */
function initializeApp(): express.Application {
  const app = express();

  // Apply security middleware
  app.use(helmet(HELMET_CONFIG));
  app.use(cors(CORS_OPTIONS));
  app.use(compression());

  // Request parsing middleware with size limits
  app.use(express.json({ 
    limit: '10mb',
    strict: true
  }));
  app.use(express.urlencoded({ 
    extended: true,
    limit: '10mb'
  }));

  // Add request logging with correlation IDs
  app.use(requestLoggingMiddleware);

  // Mount API routes
  app.use('/api/v1/forms', formRouter);
  app.use('/api/v1/submissions', submissionRouter);

  // Health check endpoint
  app.get('/health', (req, res) => {
    res.status(200).json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      service: 'form-service'
    });
  });

  // Global error handling
  app.use(errorMiddleware);

  // Handle 404 errors
  app.use((req, res) => {
    res.status(404).json({
      error: 'Not Found',
      message: 'The requested resource does not exist',
      path: req.path
    });
  });

  return app;
}

// Initialize and export the configured app
const app = initializeApp();
export default app;