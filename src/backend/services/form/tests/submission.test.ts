import { describe, test, expect, beforeAll, afterAll, beforeEach, jest } from '@jest/globals'; // ^29.6.0
import supertest from 'supertest'; // ^6.3.0
import { MongoMemoryServer } from 'mongodb-memory-server'; // ^8.15.0
import mongoose from 'mongoose'; // ^7.5.0
import { StatusCodes } from 'http-status-codes';

import { SubmissionModel } from '../src/models/submission.model';
import { validateSubmissionData } from '../src/validators/submission.validator';
import { SubmissionController } from '../src/controllers/submission.controller';
import { FORM_CONFIG } from '../../../shared/constants';
import type { FormSubmission } from '../../../shared/types/form.types';

// Test constants
const TEST_TIMEOUT = 5000;
const VALID_FORM_ID = '550e8400-e29b-41d4-a716-446655440000';
const MOCK_SUBMISSION_DATA = {
  formId: VALID_FORM_ID,
  data: {
    name: 'Test User',
    email: 'test@example.com',
    phone: '+1234567890'
  },
  source: 'web',
  metadata: {
    userAgent: 'test-agent',
    ipAddress: '127.0.0.1',
    correlationId: 'test-correlation-id'
  }
};

// Mock setup
let mongoServer: MongoMemoryServer;
let submissionController: SubmissionController;
const mockSubmissionModel = jest.spyOn(SubmissionModel.prototype, 'createSubmission');
const mockValidateSubmission = jest.spyOn(validateSubmissionData, 'validateSubmissionData');

describe('Submission Model Tests', () => {
  beforeAll(async () => {
    // Setup MongoDB memory server
    mongoServer = await MongoMemoryServer.create();
    const mongoUri = mongoServer.getUri();
    await mongoose.connect(mongoUri);

    submissionController = new SubmissionController();
  }, TEST_TIMEOUT);

  afterAll(async () => {
    await mongoose.disconnect();
    await mongoServer.stop();
    jest.clearAllMocks();
  });

  beforeEach(async () => {
    await mongoose.connection.dropDatabase();
    jest.clearAllMocks();
  });

  describe('Submission Creation Tests', () => {
    test('should create valid submission with proper data', async () => {
      const submission = { ...MOCK_SUBMISSION_DATA };
      mockValidateSubmission.mockResolvedValueOnce({ isValid: true, errors: {}, securityFlags: [] });
      mockSubmissionModel.mockResolvedValueOnce({ id: 'test-id', ...submission });

      const result = await submissionController.createSubmission(
        {
          body: submission,
          headers: { 'x-correlation-id': 'test-correlation-id' },
          ip: '127.0.0.1'
        } as any,
        {
          status: jest.fn().mockReturnThis(),
          json: jest.fn()
        } as any
      );

      expect(result.status).toHaveBeenCalledWith(StatusCodes.CREATED);
      expect(mockSubmissionModel).toHaveBeenCalledTimes(1);
    });

    test('should reject submission with invalid data formats', async () => {
      const invalidSubmission = {
        ...MOCK_SUBMISSION_DATA,
        data: {
          email: 'invalid-email'
        }
      };

      mockValidateSubmission.mockResolvedValueOnce({
        isValid: false,
        errors: { email: ['Invalid email format'] },
        securityFlags: []
      });

      const result = await submissionController.createSubmission(
        {
          body: invalidSubmission,
          headers: { 'x-correlation-id': 'test-correlation-id' },
          ip: '127.0.0.1'
        } as any,
        {
          status: jest.fn().mockReturnThis(),
          json: jest.fn()
        } as any
      );

      expect(result.status).toHaveBeenCalledWith(StatusCodes.BAD_REQUEST);
    });

    test('should enforce data size limits and constraints', async () => {
      const largeSubmission = {
        ...MOCK_SUBMISSION_DATA,
        data: {
          content: 'a'.repeat(FORM_CONFIG.MAX_FIELD_LENGTH + 1)
        }
      };

      const result = await submissionController.createSubmission(
        {
          body: largeSubmission,
          headers: {
            'x-correlation-id': 'test-correlation-id',
            'content-length': String(FORM_CONFIG.MAX_FIELD_LENGTH + 1000)
          },
          ip: '127.0.0.1'
        } as any,
        {
          status: jest.fn().mockReturnThis(),
          json: jest.fn()
        } as any
      );

      expect(result.status).toHaveBeenCalledWith(StatusCodes.BAD_REQUEST);
    });
  });

  describe('Submission Security Tests', () => {
    test('should prevent XSS in submission data', async () => {
      const maliciousSubmission = {
        ...MOCK_SUBMISSION_DATA,
        data: {
          name: '<script>alert("xss")</script>Test User'
        }
      };

      mockValidateSubmission.mockResolvedValueOnce({
        isValid: false,
        errors: {},
        securityFlags: ['Potentially malicious content detected in field: name']
      });

      const result = await submissionController.createSubmission(
        {
          body: maliciousSubmission,
          headers: { 'x-correlation-id': 'test-correlation-id' },
          ip: '127.0.0.1'
        } as any,
        {
          status: jest.fn().mockReturnThis(),
          json: jest.fn()
        } as any
      );

      expect(result.status).toHaveBeenCalledWith(StatusCodes.BAD_REQUEST);
    });

    test('should reject malicious file uploads', async () => {
      const maliciousFileSubmission = {
        ...MOCK_SUBMISSION_DATA,
        data: {
          file: {
            name: 'malicious.php',
            type: 'application/x-httpd-php'
          }
        }
      };

      mockValidateSubmission.mockResolvedValueOnce({
        isValid: false,
        errors: { file: ['Potentially dangerous file type'] },
        securityFlags: ['Security threat detected in file upload: file']
      });

      const result = await submissionController.createSubmission(
        {
          body: maliciousFileSubmission,
          headers: { 'x-correlation-id': 'test-correlation-id' },
          ip: '127.0.0.1'
        } as any,
        {
          status: jest.fn().mockReturnThis(),
          json: jest.fn()
        } as any
      );

      expect(result.status).toHaveBeenCalledWith(StatusCodes.BAD_REQUEST);
    });
  });

  describe('Submission Performance Tests', () => {
    test('should process submission within 500ms', async () => {
      const startTime = Date.now();
      
      await submissionController.createSubmission(
        {
          body: MOCK_SUBMISSION_DATA,
          headers: { 'x-correlation-id': 'test-correlation-id' },
          ip: '127.0.0.1'
        } as any,
        {
          status: jest.fn().mockReturnThis(),
          json: jest.fn()
        } as any
      );

      const processingTime = Date.now() - startTime;
      expect(processingTime).toBeLessThan(500);
    });

    test('should handle multiple concurrent submissions', async () => {
      const submissions = Array(10).fill(MOCK_SUBMISSION_DATA);
      mockValidateSubmission.mockResolvedValue({ isValid: true, errors: {}, securityFlags: [] });
      mockSubmissionModel.mockResolvedValue({ id: 'test-id' });

      const results = await Promise.all(
        submissions.map(submission =>
          submissionController.createSubmission(
            {
              body: submission,
              headers: { 'x-correlation-id': 'test-correlation-id' },
              ip: '127.0.0.1'
            } as any,
            {
              status: jest.fn().mockReturnThis(),
              json: jest.fn()
            } as any
          )
        )
      );

      results.forEach(result => {
        expect(result.status).toHaveBeenCalledWith(StatusCodes.CREATED);
      });
    });
  });

  describe('Submission Retrieval Tests', () => {
    test('should retrieve submission by ID', async () => {
      const submissionId = 'test-submission-id';
      mockSubmissionModel.mockResolvedValueOnce({
        id: submissionId,
        ...MOCK_SUBMISSION_DATA
      });

      const result = await submissionController.getSubmission(
        {
          params: { submissionId },
          headers: { 'x-correlation-id': 'test-correlation-id' }
        } as any,
        {
          status: jest.fn().mockReturnThis(),
          json: jest.fn(),
          set: jest.fn()
        } as any
      );

      expect(result.status).toHaveBeenCalledWith(StatusCodes.OK);
    });

    test('should handle pagination for form submissions', async () => {
      mockSubmissionModel.mockResolvedValueOnce({
        data: [MOCK_SUBMISSION_DATA],
        total: 1
      });

      const result = await submissionController.getFormSubmissions(
        {
          params: { formId: VALID_FORM_ID },
          query: { page: '1', limit: '10' },
          headers: { 'x-correlation-id': 'test-correlation-id' }
        } as any,
        {
          status: jest.fn().mockReturnThis(),
          json: jest.fn(),
          set: jest.fn()
        } as any
      );

      expect(result.status).toHaveBeenCalledWith(StatusCodes.OK);
    });
  });
});