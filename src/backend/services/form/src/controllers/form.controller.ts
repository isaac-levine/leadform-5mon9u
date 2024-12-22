import { Request, Response } from 'express'; // v4.18.2
import { StatusCodes } from 'http-status-codes'; // v2.2.0
import { rateLimit } from 'express-rate-limit'; // v6.7.0
import NodeCache from 'node-cache'; // v5.1.2

import { FormModel } from '../models/form.model';
import { validateFormSchema, validateFormFields } from '../validators/form.validator';
import { createError } from '../../../shared/utils/error-handler';
import { Logger } from '../../../shared/utils/logger';
import { FormSchema } from '../../../shared/types/form.types';

// Controller constants
const CONTROLLER_NAME = 'FormController';
const ERROR_MESSAGES = {
  FORM_NOT_FOUND: 'Form not found',
  INVALID_FORM_DATA: 'Invalid form data',
  VALIDATION_FAILED: 'Form validation failed',
  UNAUTHORIZED: 'Unauthorized access to form',
  RATE_LIMIT_EXCEEDED: 'Rate limit exceeded',
  VERSION_CONFLICT: 'Form version conflict',
  ORGANIZATION_ACCESS_DENIED: 'Organization access denied'
} as const;

// Configuration constants
const CACHE_TTL = 300; // 5 minutes cache TTL
const MAX_REQUESTS_PER_MINUTE = 100;
const BULK_OPERATION_LIMIT = 50;

/**
 * Enhanced form controller with advanced validation, caching, and security features
 */
@rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: MAX_REQUESTS_PER_MINUTE,
  message: ERROR_MESSAGES.RATE_LIMIT_EXCEEDED
})
export class FormController {
  private logger: Logger;
  private formModel: typeof FormModel;
  private cache: NodeCache;

  constructor() {
    this.logger = new Logger(CONTROLLER_NAME, 'form-service');
    this.formModel = FormModel;
    this.cache = new NodeCache({ 
      stdTTL: CACHE_TTL,
      checkperiod: 120,
      useClones: false
    });
  }

  /**
   * Creates a new form with enhanced validation and security checks
   */
  public async createForm(req: Request, res: Response): Promise<Response> {
    try {
      const { organizationId } = req.user;
      const formData: FormSchema = req.body;

      // Validate organization access
      if (!organizationId) {
        throw createError(
          ERROR_MESSAGES.UNAUTHORIZED,
          StatusCodes.UNAUTHORIZED,
          'UNAUTHORIZED_ACCESS',
          'error',
          { organizationId }
        );
      }

      // Validate form schema with security checks
      const schemaValidation = await validateFormSchema(formData);
      if (!schemaValidation.isValid) {
        return res.status(StatusCodes.BAD_REQUEST).json({
          success: false,
          errors: schemaValidation.errors,
          securityContext: schemaValidation.securityContext
        });
      }

      // Validate form fields
      const fieldValidation = await validateFormFields(formData.fields);
      if (!fieldValidation.isValid) {
        return res.status(StatusCodes.BAD_REQUEST).json({
          success: false,
          errors: fieldValidation.errors,
          securityFlags: fieldValidation.securityFlags
        });
      }

      // Create form with organization context
      const form = await this.formModel.create({
        ...formData,
        organizationId,
        version: '1.0.0',
        active: true
      });

      // Cache the created form
      this.cache.set(`form:${form.id}`, form);

      this.logger.info('Form created successfully', {
        formId: form.id,
        organizationId
      });

      return res.status(StatusCodes.CREATED).json({
        success: true,
        data: form
      });

    } catch (error) {
      this.logger.error('Form creation failed', error as Error, {
        organizationId: req.user?.organizationId
      });
      
      const errorResponse = createError(
        'Form creation failed',
        StatusCodes.INTERNAL_SERVER_ERROR,
        'FORM_CREATION_ERROR',
        'error',
        { error }
      );
      
      return res.status(errorResponse.statusCode).json(errorResponse);
    }
  }

  /**
   * Retrieves a form by ID with caching and security checks
   */
  public async getForm(req: Request, res: Response): Promise<Response> {
    try {
      const { id } = req.params;
      const { organizationId } = req.user;

      // Check cache first
      const cachedForm = this.cache.get(`form:${id}`);
      if (cachedForm) {
        return res.status(StatusCodes.OK).json({
          success: true,
          data: cachedForm,
          cached: true
        });
      }

      // Retrieve form with organization check
      const form = await this.formModel.findOne({
        _id: id,
        organizationId,
        active: true
      });

      if (!form) {
        throw createError(
          ERROR_MESSAGES.FORM_NOT_FOUND,
          StatusCodes.NOT_FOUND,
          'FORM_NOT_FOUND',
          'error',
          { formId: id }
        );
      }

      // Cache the form
      this.cache.set(`form:${id}`, form);

      return res.status(StatusCodes.OK).json({
        success: true,
        data: form,
        cached: false
      });

    } catch (error) {
      this.logger.error('Form retrieval failed', error as Error, {
        formId: req.params.id
      });
      
      const errorResponse = createError(
        'Form retrieval failed',
        StatusCodes.INTERNAL_SERVER_ERROR,
        'FORM_RETRIEVAL_ERROR',
        'error',
        { error }
      );
      
      return res.status(errorResponse.statusCode).json(errorResponse);
    }
  }

  /**
   * Updates a form with version control and validation
   */
  public async updateForm(req: Request, res: Response): Promise<Response> {
    try {
      const { id } = req.params;
      const { organizationId } = req.user;
      const updateData: Partial<FormSchema> = req.body;

      // Validate organization access
      const existingForm = await this.formModel.findOne({
        _id: id,
        organizationId
      });

      if (!existingForm) {
        throw createError(
          ERROR_MESSAGES.FORM_NOT_FOUND,
          StatusCodes.NOT_FOUND,
          'FORM_NOT_FOUND',
          'error',
          { formId: id }
        );
      }

      // Version conflict check
      if (updateData.version && updateData.version !== existingForm.version) {
        throw createError(
          ERROR_MESSAGES.VERSION_CONFLICT,
          StatusCodes.CONFLICT,
          'VERSION_CONFLICT',
          'error',
          { 
            currentVersion: existingForm.version,
            requestedVersion: updateData.version
          }
        );
      }

      // Validate update data
      if (updateData.fields) {
        const fieldValidation = await validateFormFields(updateData.fields);
        if (!fieldValidation.isValid) {
          return res.status(StatusCodes.BAD_REQUEST).json({
            success: false,
            errors: fieldValidation.errors,
            securityFlags: fieldValidation.securityFlags
          });
        }
      }

      // Update form with new version
      const updatedForm = await this.formModel.findByIdAndUpdate(
        id,
        {
          ...updateData,
          version: this.incrementVersion(existingForm.version)
        },
        { new: true }
      );

      // Invalidate cache
      this.cache.del(`form:${id}`);

      this.logger.info('Form updated successfully', {
        formId: id,
        organizationId
      });

      return res.status(StatusCodes.OK).json({
        success: true,
        data: updatedForm
      });

    } catch (error) {
      this.logger.error('Form update failed', error as Error, {
        formId: req.params.id
      });
      
      const errorResponse = createError(
        'Form update failed',
        StatusCodes.INTERNAL_SERVER_ERROR,
        'FORM_UPDATE_ERROR',
        'error',
        { error }
      );
      
      return res.status(errorResponse.statusCode).json(errorResponse);
    }
  }

  /**
   * Handles bulk form updates with transaction support
   */
  public async bulkUpdateForms(req: Request, res: Response): Promise<Response> {
    try {
      const { forms } = req.body;
      const { organizationId } = req.user;

      // Validate bulk operation limit
      if (!Array.isArray(forms) || forms.length > BULK_OPERATION_LIMIT) {
        throw createError(
          `Bulk operation limit exceeded (max: ${BULK_OPERATION_LIMIT})`,
          StatusCodes.BAD_REQUEST,
          'BULK_LIMIT_EXCEEDED',
          'error',
          { formsCount: forms?.length }
        );
      }

      const results = await Promise.allSettled(
        forms.map(async (formUpdate) => {
          // Verify organization access for each form
          const form = await this.formModel.findOne({
            _id: formUpdate.id,
            organizationId
          });

          if (!form) {
            throw new Error(`Form not found or access denied: ${formUpdate.id}`);
          }

          // Validate and update each form
          const fieldValidation = await validateFormFields(formUpdate.fields);
          if (!fieldValidation.isValid) {
            throw new Error(`Validation failed for form: ${formUpdate.id}`);
          }

          const updatedForm = await this.formModel.findByIdAndUpdate(
            formUpdate.id,
            {
              ...formUpdate,
              version: this.incrementVersion(form.version)
            },
            { new: true }
          );

          // Invalidate cache for updated form
          this.cache.del(`form:${formUpdate.id}`);

          return updatedForm;
        })
      );

      this.logger.info('Bulk form update completed', {
        organizationId,
        totalForms: forms.length,
        successCount: results.filter(r => r.status === 'fulfilled').length
      });

      return res.status(StatusCodes.OK).json({
        success: true,
        results: results.map((result, index) => ({
          formId: forms[index].id,
          status: result.status,
          data: result.status === 'fulfilled' ? result.value : null,
          error: result.status === 'rejected' ? result.reason.message : null
        }))
      });

    } catch (error) {
      this.logger.error('Bulk form update failed', error as Error, {
        organizationId: req.user?.organizationId
      });
      
      const errorResponse = createError(
        'Bulk form update failed',
        StatusCodes.INTERNAL_SERVER_ERROR,
        'BULK_UPDATE_ERROR',
        'error',
        { error }
      );
      
      return res.status(errorResponse.statusCode).json(errorResponse);
    }
  }

  /**
   * Increments the form version number
   */
  private incrementVersion(currentVersion: string): string {
    const [major, minor, patch] = currentVersion.split('.').map(Number);
    return `${major}.${minor}.${patch + 1}`;
  }
}