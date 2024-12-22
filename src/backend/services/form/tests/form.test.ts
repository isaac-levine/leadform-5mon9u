import { jest } from '@jest/globals'; // v29.6.0
import { StatusCodes } from 'http-status-codes'; // v2.2.0
import mongoose from 'mongoose'; // v7.5.0
import supertest from 'supertest'; // v6.3.3

import { FormController } from '../src/controllers/form.controller';
import { FormModel } from '../src/models/form.model';
import { validateFormSchema } from '../src/validators/form.validator';
import { createError } from '../../../shared/utils/error-handler';
import { Logger } from '../../../shared/utils/logger';
import { FieldType, ValidationRuleType } from '../../../shared/types/form.types';

// Test constants
const TEST_FORM_DATA = {
  name: 'Test Contact Form',
  description: 'A test contact form',
  fields: [
    {
      label: 'Full Name',
      type: FieldType.TEXT,
      required: true,
      validation: [{
        type: ValidationRuleType.PATTERN,
        value: '^[a-zA-Z\\s]*$',
        message: 'Only letters and spaces allowed',
        isAsync: false
      }]
    },
    {
      label: 'Email',
      type: FieldType.EMAIL,
      required: true,
      validation: [{
        type: ValidationRuleType.EMAIL,
        value: true,
        message: 'Invalid email format',
        isAsync: false
      }]
    },
    {
      label: 'Phone',
      type: FieldType.PHONE,
      required: true,
      validation: [{
        type: ValidationRuleType.PHONE,
        value: true,
        message: 'Invalid phone number',
        isAsync: false
      }]
    }
  ],
  styling: {
    theme: 'light',
    fontFamily: 'Inter',
    primaryColor: '#2563EB',
    borderRadius: '8px'
  },
  settings: {
    submitButtonText: 'Submit',
    successMessage: 'Thank you for your submission',
    errorMessage: 'Please correct the errors and try again',
    redirectUrl: 'https://example.com/thank-you'
  },
  organizationId: 'test-org-id',
  active: true
};

describe('FormController', () => {
  let formController: FormController;
  let mockReq: any;
  let mockRes: any;

  beforeAll(async () => {
    // Mock mongoose connection
    jest.spyOn(mongoose, 'connect').mockResolvedValue(mongoose);
    
    // Initialize form controller
    formController = new FormController();
  });

  beforeEach(() => {
    // Reset mocks before each test
    jest.clearAllMocks();

    // Setup request and response mocks
    mockReq = {
      user: { organizationId: 'test-org-id' },
      params: {},
      body: {}
    };

    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis()
    };
  });

  afterAll(async () => {
    jest.restoreAllMocks();
  });

  describe('createForm', () => {
    it('should create a form successfully with valid data', async () => {
      // Mock form model create
      jest.spyOn(FormModel, 'create').mockResolvedValueOnce({
        ...TEST_FORM_DATA,
        id: 'test-form-id',
        version: '1.0.0'
      });

      mockReq.body = TEST_FORM_DATA;

      await formController.createForm(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(StatusCodes.CREATED);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        data: expect.objectContaining({
          name: TEST_FORM_DATA.name,
          version: '1.0.0'
        })
      });
    });

    it('should handle validation errors for invalid fields', async () => {
      const invalidForm = {
        ...TEST_FORM_DATA,
        fields: [{
          label: '',
          type: 'INVALID_TYPE',
          required: true
        }]
      };

      mockReq.body = invalidForm;

      await formController.createForm(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(StatusCodes.BAD_REQUEST);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          errors: expect.any(Array)
        })
      );
    });

    it('should validate organization access', async () => {
      mockReq.user.organizationId = undefined;
      mockReq.body = TEST_FORM_DATA;

      await formController.createForm(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(StatusCodes.UNAUTHORIZED);
    });
  });

  describe('getForm', () => {
    it('should retrieve a form by ID successfully', async () => {
      const formId = 'test-form-id';
      mockReq.params.id = formId;

      jest.spyOn(FormModel, 'findOne').mockResolvedValueOnce({
        ...TEST_FORM_DATA,
        id: formId
      });

      await formController.getForm(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(StatusCodes.OK);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        data: expect.objectContaining({ id: formId })
      });
    });

    it('should handle non-existent form', async () => {
      mockReq.params.id = 'non-existent-id';
      jest.spyOn(FormModel, 'findOne').mockResolvedValueOnce(null);

      await formController.getForm(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(StatusCodes.NOT_FOUND);
    });

    it('should validate organization access for form retrieval', async () => {
      mockReq.params.id = 'test-form-id';
      mockReq.user.organizationId = 'different-org-id';

      jest.spyOn(FormModel, 'findOne').mockResolvedValueOnce(null);

      await formController.getForm(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(StatusCodes.NOT_FOUND);
    });
  });

  describe('updateForm', () => {
    it('should update form successfully with valid changes', async () => {
      const formId = 'test-form-id';
      const updateData = {
        name: 'Updated Form Name',
        version: '1.0.0'
      };

      mockReq.params.id = formId;
      mockReq.body = updateData;

      jest.spyOn(FormModel, 'findOne').mockResolvedValueOnce({
        ...TEST_FORM_DATA,
        id: formId,
        version: '1.0.0'
      });

      jest.spyOn(FormModel, 'findByIdAndUpdate').mockResolvedValueOnce({
        ...TEST_FORM_DATA,
        ...updateData,
        version: '1.0.1'
      });

      await formController.updateForm(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(StatusCodes.OK);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        data: expect.objectContaining({
          name: updateData.name,
          version: '1.0.1'
        })
      });
    });

    it('should handle version conflicts', async () => {
      mockReq.params.id = 'test-form-id';
      mockReq.body = {
        name: 'Updated Form',
        version: '1.0.0'
      };

      jest.spyOn(FormModel, 'findOne').mockResolvedValueOnce({
        ...TEST_FORM_DATA,
        version: '1.0.1'
      });

      await formController.updateForm(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(StatusCodes.CONFLICT);
    });

    it('should validate field updates', async () => {
      mockReq.params.id = 'test-form-id';
      mockReq.body = {
        fields: [{
          label: 'Invalid Field',
          type: 'INVALID_TYPE'
        }]
      };

      jest.spyOn(FormModel, 'findOne').mockResolvedValueOnce({
        ...TEST_FORM_DATA,
        id: 'test-form-id'
      });

      await formController.updateForm(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(StatusCodes.BAD_REQUEST);
    });
  });

  describe('deleteForm', () => {
    it('should delete form successfully', async () => {
      const formId = 'test-form-id';
      mockReq.params.id = formId;

      jest.spyOn(FormModel, 'findOneAndDelete').mockResolvedValueOnce({
        ...TEST_FORM_DATA,
        id: formId
      });

      await formController.deleteForm(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(StatusCodes.OK);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        message: expect.any(String)
      });
    });

    it('should handle non-existent form deletion', async () => {
      mockReq.params.id = 'non-existent-id';
      jest.spyOn(FormModel, 'findOneAndDelete').mockResolvedValueOnce(null);

      await formController.deleteForm(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(StatusCodes.NOT_FOUND);
    });
  });

  describe('listForms', () => {
    it('should list forms with pagination', async () => {
      const mockForms = [
        { ...TEST_FORM_DATA, id: 'form-1' },
        { ...TEST_FORM_DATA, id: 'form-2' }
      ];

      mockReq.query = {
        page: 1,
        limit: 10
      };

      jest.spyOn(FormModel, 'find').mockReturnValue({
        skip: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue(mockForms)
      } as any);

      jest.spyOn(FormModel, 'countDocuments').mockResolvedValue(2);

      await formController.listForms(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(StatusCodes.OK);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        data: mockForms,
        pagination: expect.objectContaining({
          total: 2,
          page: 1,
          limit: 10
        })
      });
    });

    it('should filter forms by organization', async () => {
      mockReq.query = {
        organizationId: 'test-org-id'
      };

      jest.spyOn(FormModel, 'find').mockReturnValue({
        exec: jest.fn().mockResolvedValue([])
      } as any);

      jest.spyOn(FormModel, 'countDocuments').mockResolvedValue(0);

      await formController.listForms(mockReq, mockRes);

      expect(FormModel.find).toHaveBeenCalledWith(
        expect.objectContaining({
          organizationId: 'test-org-id'
        })
      );
    });
  });
});