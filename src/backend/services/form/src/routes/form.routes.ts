import { Router } from 'express'; // v4.18.2
import { authenticate } from 'express-jwt'; // v8.4.1
import helmet from 'helmet'; // v7.0.0
import rateLimit from 'express-rate-limit'; // v6.7.0
import { StatusCodes } from 'http-status-codes'; // v2.2.0
import { FormController } from '../controllers/form.controller';
import { validateFormSchema } from '../validators/form.validator';
import { handleError } from '../../../shared/utils/error-handler';
import { Logger } from '../../../shared/utils/logger';
import { API_CONFIG, FORM_CONFIG } from '../../../shared/constants';

// Initialize logger for form routes
const logger = new Logger('FormRoutes', 'form-service');

// Route configuration constants
const ROUTE_PREFIX = '/api/v1/forms';
const RATE_LIMIT_WINDOW = API_CONFIG.RATE_LIMIT_WINDOW;
const RATE_LIMIT_MAX = API_CONFIG.MAX_REQUESTS;

/**
 * Middleware for audit logging of form operations
 */
const auditLog = (operation: string) => (req: any, res: any, next: any) => {
  logger.info(`Form ${operation} operation initiated`, {
    operation,
    userId: req.user?.id,
    organizationId: req.user?.organizationId,
    formId: req.params.id,
    requestId: req.id
  });
  next();
};

/**
 * Middleware for form version control
 */
const versionControl = async (req: any, res: any, next: any) => {
  try {
    const { version } = req.body;
    if (!version) {
      return res.status(StatusCodes.BAD_REQUEST).json({
        success: false,
        error: 'Version field is required for updates'
      });
    }
    next();
  } catch (error) {
    next(error);
  }
};

/**
 * Middleware for pagination handling
 */
const pagination = (req: any, res: any, next: any) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;
  req.pagination = {
    page,
    limit: Math.min(limit, FORM_CONFIG.MAX_FIELDS)
  };
  next();
};

/**
 * Middleware for soft delete operations
 */
const softDelete = async (req: any, res: any, next: any) => {
  req.softDelete = true;
  next();
};

// Initialize router and controller
const router = Router();
const formController = new FormController();

// Apply base security middleware to all routes
router.use(helmet());

// Configure rate limiting per organization
const formRateLimiter = rateLimit({
  windowMs: RATE_LIMIT_WINDOW,
  max: RATE_LIMIT_MAX,
  keyGenerator: (req: any) => req.user?.organizationId || req.ip,
  handler: (req: any, res: any) => {
    logger.warn('Rate limit exceeded', {
      organizationId: req.user?.organizationId,
      ip: req.ip
    });
    res.status(StatusCodes.TOO_MANY_REQUESTS).json({
      success: false,
      error: 'Rate limit exceeded'
    });
  }
});

// Form creation route
router.post('/',
  helmet(),
  formRateLimiter,
  authenticate(),
  validateFormSchema,
  auditLog('create'),
  async (req, res) => {
    try {
      await formController.createForm(req, res);
    } catch (error) {
      const errorResponse = handleError(error, {
        path: req.path,
        method: req.method,
        organizationId: req.user?.organizationId
      });
      res.status(errorResponse.status).json(errorResponse);
    }
  }
);

// Get form by ID route
router.get('/:id',
  helmet(),
  authenticate(),
  auditLog('read'),
  async (req, res) => {
    try {
      await formController.getForm(req, res);
    } catch (error) {
      const errorResponse = handleError(error, {
        path: req.path,
        method: req.method,
        formId: req.params.id
      });
      res.status(errorResponse.status).json(errorResponse);
    }
  }
);

// Update form route
router.put('/:id',
  helmet(),
  formRateLimiter,
  authenticate(),
  validateFormSchema,
  versionControl,
  auditLog('update'),
  async (req, res) => {
    try {
      await formController.updateForm(req, res);
    } catch (error) {
      const errorResponse = handleError(error, {
        path: req.path,
        method: req.method,
        formId: req.params.id
      });
      res.status(errorResponse.status).json(errorResponse);
    }
  }
);

// Delete form route
router.delete('/:id',
  helmet(),
  authenticate(),
  softDelete,
  auditLog('delete'),
  async (req, res) => {
    try {
      await formController.deleteForm(req, res);
    } catch (error) {
      const errorResponse = handleError(error, {
        path: req.path,
        method: req.method,
        formId: req.params.id
      });
      res.status(errorResponse.status).json(errorResponse);
    }
  }
);

// List forms route with pagination
router.get('/',
  helmet(),
  authenticate(),
  pagination,
  auditLog('list'),
  async (req, res) => {
    try {
      await formController.listForms(req, res);
    } catch (error) {
      const errorResponse = handleError(error, {
        path: req.path,
        method: req.method,
        pagination: req.pagination
      });
      res.status(errorResponse.status).json(errorResponse);
    }
  }
);

// Bulk update forms route
router.post('/bulk',
  helmet(),
  formRateLimiter,
  authenticate(),
  validateFormSchema,
  versionControl,
  auditLog('bulk-update'),
  async (req, res) => {
    try {
      await formController.bulkUpdateForms(req, res);
    } catch (error) {
      const errorResponse = handleError(error, {
        path: req.path,
        method: req.method,
        formsCount: req.body?.forms?.length
      });
      res.status(errorResponse.status).json(errorResponse);
    }
  }
);

export default router;