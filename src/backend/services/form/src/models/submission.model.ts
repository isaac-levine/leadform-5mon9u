import mongoose from 'mongoose'; // v7.5.0
import { z } from 'zod'; // v3.22.0
import type { FormSubmission } from '../../../shared/types/form.types';
import { validateFormSubmission } from '../../../shared/utils/validation';
import { Logger } from '../../../shared/utils/logger';
import { createError } from '../../../shared/utils/error-handler';
import { FORM_CONFIG } from '../../../shared/constants';

// Constants for submission handling
const SUBMISSION_COLLECTION = 'submissions';
const MAX_DATA_SIZE = 5 * 1024 * 1024; // 5MB limit for submission data
const VALIDATION_ERROR_CACHE_TTL = 3600; // 1 hour cache for validation errors
const MAX_RETRIES = 3;

/**
 * Interface for submission documents with enhanced tracking
 */
interface ISubmissionDocument extends mongoose.Document {
  formId: string;
  data: Record<string, any>;
  source: string;
  metadata: Record<string, any>;
  correlationId: string;
  createdAt: Date;
  updatedAt: Date;
  retryCount: number;
}

/**
 * Enhanced Mongoose model class for secure form submissions
 */
class SubmissionModel {
  private schema: mongoose.Schema;
  private logger: Logger;

  constructor() {
    this.logger = new Logger('SubmissionModel', 'form-service');

    // Define submission schema with security constraints
    this.schema = new mongoose.Schema({
      formId: {
        type: String,
        required: true,
        index: true
      },
      data: {
        type: Map,
        of: mongoose.Schema.Types.Mixed,
        required: true,
        validate: {
          validator: (data: Record<string, any>) => {
            return Object.keys(data).length <= FORM_CONFIG.MAX_FIELDS;
          },
          message: `Submission data cannot exceed ${FORM_CONFIG.MAX_FIELDS} fields`
        }
      },
      source: {
        type: String,
        required: true,
        trim: true
      },
      metadata: {
        type: Map,
        of: mongoose.Schema.Types.Mixed,
        default: {}
      },
      correlationId: {
        type: String,
        required: true,
        index: true
      },
      retryCount: {
        type: Number,
        default: 0
      }
    }, {
      timestamps: true,
      versionKey: true,
      collection: SUBMISSION_COLLECTION
    });

    // Add compound indexes for efficient querying
    this.schema.index({ formId: 1, createdAt: -1 });
    this.schema.index({ correlationId: 1, formId: 1 }, { unique: true });

    // Add pre-save middleware for validation and security
    this.schema.pre('save', async function(next) {
      try {
        const doc = this as ISubmissionDocument;
        await this.validateSubmission(doc);
        next();
      } catch (error) {
        next(error);
      }
    });
  }

  /**
   * Validates submission data with enhanced security checks
   */
  private async validateSubmission(doc: ISubmissionDocument): Promise<void> {
    const correlationId = doc.correlationId;

    try {
      // Check data size limits
      const dataSize = Buffer.from(JSON.stringify(doc.data)).length;
      if (dataSize > MAX_DATA_SIZE) {
        throw createError(
          'Submission data exceeds size limit',
          400,
          'VALIDATION_ERROR',
          'error',
          { correlationId, size: dataSize }
        );
      }

      // Define Zod schema for submission validation
      const submissionSchema = z.object({
        formId: z.string().uuid(),
        data: z.record(z.any()).refine(
          data => Object.keys(data).length <= FORM_CONFIG.MAX_FIELDS,
          { message: 'Maximum field limit exceeded' }
        ),
        source: z.string().min(1),
        metadata: z.record(z.any()).optional()
      });

      // Validate submission using enhanced validation
      const validationResult = await validateFormSubmission(
        { formId: doc.formId, data: doc.data, source: doc.source, metadata: doc.metadata },
        submissionSchema
      );

      if (!validationResult.isValid) {
        this.logger.error(
          'Submission validation failed',
          new Error('Validation errors detected'),
          {
            correlationId,
            errors: validationResult.errors
          }
        );

        throw createError(
          'Invalid submission data',
          400,
          'VALIDATION_ERROR',
          'error',
          { correlationId, errors: validationResult.errors }
        );
      }

      this.logger.info('Submission validation successful', {
        correlationId,
        formId: doc.formId
      });

    } catch (error) {
      this.logger.error('Submission validation error', error as Error, {
        correlationId,
        formId: doc.formId
      });
      throw error;
    }
  }

  /**
   * Creates a new form submission with retry capability
   */
  public async createSubmission(submission: FormSubmission): Promise<ISubmissionDocument> {
    const correlationId = submission.id;
    let retryCount = 0;

    while (retryCount < MAX_RETRIES) {
      try {
        this.logger.info('Creating form submission', {
          correlationId,
          formId: submission.formId,
          attempt: retryCount + 1
        });

        const submissionDoc = new mongoose.model<ISubmissionDocument>(
          SUBMISSION_COLLECTION,
          this.schema
        )({
          formId: submission.formId,
          data: submission.data,
          source: submission.source,
          metadata: submission.metadata,
          correlationId
        });

        const savedDoc = await submissionDoc.save();

        this.logger.info('Submission created successfully', {
          correlationId,
          formId: submission.formId,
          submissionId: savedDoc.id
        });

        return savedDoc;

      } catch (error) {
        retryCount++;
        
        if (retryCount === MAX_RETRIES) {
          this.logger.error('Max retries reached for submission creation', error as Error, {
            correlationId,
            formId: submission.formId
          });
          throw error;
        }

        // Exponential backoff before retry
        await new Promise(resolve => setTimeout(resolve, Math.pow(2, retryCount) * 1000));
      }
    }

    throw createError(
      'Failed to create submission after retries',
      500,
      'SUBMISSION_ERROR',
      'error',
      { correlationId, formId: submission.formId }
    );
  }
}

// Export submission model instance
export const submissionModel = new SubmissionModel();

// Export interfaces for type safety
export type { ISubmissionDocument };