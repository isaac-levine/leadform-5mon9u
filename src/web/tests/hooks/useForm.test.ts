// @ts-check
import { renderHook, act } from '@testing-library/react-hooks'; // v8.0.1
import { Provider } from 'react-redux'; // v9.0.0
import { configureStore } from '@reduxjs/toolkit'; // v2.0.0
import { jest } from '@jest/globals'; // v29.0.0

import { useForm } from '../../src/hooks/useForm';
import { FormState, ValidationError } from '../../src/types/form';
import { formActions } from '../../src/store/slices/formSlice';
import { DEFAULT_FORM_STATE, VALIDATION_RULES } from '../../src/lib/constants/forms';
import { FieldType, ValidationRuleType } from '../../../backend/shared/types/form.types';

// Mock Redux store
const mockStore = configureStore({
  reducer: {
    form: (state = {
      currentForm: null,
      loading: false,
      error: null,
      isOptimisticUpdate: false,
      lastSaved: null
    }, action) => state
  }
});

// Mock validation cache
jest.mock('../../src/lib/utils/validation', () => ({
  validateFormState: jest.fn(),
  validateFormField: jest.fn()
}));

describe('useForm hook', () => {
  // Test setup variables
  let mockDispatch: jest.SpyInstance;
  let wrapper: React.FC;

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();
    
    // Mock dispatch
    mockDispatch = jest.spyOn(mockStore, 'dispatch');
    
    // Setup wrapper with Redux Provider
    wrapper = ({ children }: { children: React.ReactNode }) => (
      <Provider store={mockStore}>{children}</Provider>
    );
  });

  afterEach(() => {
    mockDispatch.mockRestore();
  });

  it('should initialize with default state', () => {
    const { result } = renderHook(() => useForm('test-form'), { wrapper });

    expect(result.current.formState).toEqual(DEFAULT_FORM_STATE);
    expect(result.current.validationState).toEqual({
      isValid: true,
      errors: []
    });
  });

  it('should update field value and trigger validation', async () => {
    const { result } = renderHook(() => useForm('test-form'), { wrapper });

    await act(async () => {
      await result.current.updateField('field1', 'test value');
    });

    expect(mockDispatch).toHaveBeenCalledWith(
      formActions.setOptimisticUpdate(true)
    );
    expect(result.current.formState.isDirty).toBe(true);
  });

  it('should handle batch updates efficiently', async () => {
    const { result } = renderHook(() => useForm('test-form'), { wrapper });
    const updates = [
      { fieldId: 'field1', value: 'value1' },
      { fieldId: 'field2', value: 'value2' }
    ];

    await act(async () => {
      await result.current.batchUpdate(updates);
    });

    expect(mockDispatch).toHaveBeenCalledTimes(2);
    expect(result.current.formState.isDirty).toBe(true);
  });

  it('should validate form state completely', async () => {
    const mockValidationResult = {
      isValid: false,
      errors: [{
        field: 'field1',
        message: 'Required field',
        type: ValidationRuleType.REQUIRED
      }]
    };

    require('../../src/lib/utils/validation').validateFormState.mockResolvedValue(mockValidationResult);

    const { result } = renderHook(() => useForm('test-form'), { wrapper });

    await act(async () => {
      await result.current.validateForm();
    });

    expect(result.current.validationState.isValid).toBe(false);
    expect(result.current.validationState.errors).toEqual(mockValidationResult.errors);
  });

  it('should handle optimistic updates with rollback', async () => {
    const { result } = renderHook(() => useForm('test-form', {
      enableOptimisticUpdates: true
    }), { wrapper });

    const mockError = new Error('Update failed');

    await act(async () => {
      await result.current.updateField('field1', 'test value');
      // Simulate API error
      mockDispatch.mockRejectedValueOnce(mockError);
    });

    expect(result.current.formError).toBeDefined();
    expect(mockDispatch).toHaveBeenCalledWith(formActions.resetError());
  });

  it('should cache validation results for performance', async () => {
    const { result } = renderHook(() => useForm('test-form'), { wrapper });
    const validateFormStateSpy = jest.spyOn(require('../../src/lib/utils/validation'), 'validateFormState');

    // First validation
    await act(async () => {
      await result.current.validateForm();
    });

    // Second validation with same values
    await act(async () => {
      await result.current.validateForm();
    });

    expect(validateFormStateSpy).toHaveBeenCalledTimes(1);
  });

  it('should handle autosave functionality', async () => {
    jest.useFakeTimers();

    const { result } = renderHook(() => useForm('test-form', {
      autosave: true,
      autosaveDelay: 1000
    }), { wrapper });

    await act(async () => {
      await result.current.updateField('field1', 'test value');
      jest.advanceTimersByTime(1000);
    });

    expect(mockDispatch).toHaveBeenCalledWith(
      formActions.setCurrentForm(expect.any(Object))
    );

    jest.useRealTimers();
  });

  it('should clean up resources on unmount', () => {
    const { unmount } = renderHook(() => useForm('test-form'), { wrapper });
    const clearTimeoutSpy = jest.spyOn(global, 'clearTimeout');

    unmount();

    expect(clearTimeoutSpy).toHaveBeenCalled();
  });

  it('should handle complex validation rules', async () => {
    const complexForm: Partial<FormState> = {
      fields: [{
        id: 'email',
        type: FieldType.EMAIL,
        label: 'Email',
        value: 'invalid-email',
        validation: [VALIDATION_RULES.EMAIL],
        isValid: false,
        isTouched: true,
        errors: []
      }]
    };

    const { result } = renderHook(() => useForm('test-form'), { wrapper });

    await act(async () => {
      await result.current.updateField('email', 'invalid-email');
    });

    expect(result.current.validationState.isValid).toBe(false);
  });

  it('should handle dependent field validation', async () => {
    const dependentForm: Partial<FormState> = {
      fields: [{
        id: 'password',
        type: FieldType.TEXT,
        label: 'Password',
        value: 'password123',
        validation: [],
        isValid: true,
        isTouched: true,
        errors: []
      }, {
        id: 'confirmPassword',
        type: FieldType.TEXT,
        label: 'Confirm Password',
        value: 'password124',
        validation: [{
          type: ValidationRuleType.DEPENDENT,
          message: 'Passwords must match',
          dependentFields: ['password']
        }],
        isValid: false,
        isTouched: true,
        errors: []
      }]
    };

    const { result } = renderHook(() => useForm('test-form'), { wrapper });

    await act(async () => {
      await result.current.batchUpdate([
        { fieldId: 'password', value: 'password123' },
        { fieldId: 'confirmPassword', value: 'password124' }
      ]);
    });

    expect(result.current.validationState.isValid).toBe(false);
  });

  it('should handle file upload validation', async () => {
    const mockFile = new File(['test'], 'test.pdf', { type: 'application/pdf' });
    const { result } = renderHook(() => useForm('test-form'), { wrapper });

    await act(async () => {
      await result.current.updateField('file', mockFile);
    });

    expect(mockDispatch).toHaveBeenCalled();
  });

  it('should prevent memory leaks', () => {
    const { result, unmount } = renderHook(() => useForm('test-form'), { wrapper });
    const weakMap = new WeakMap();
    weakMap.set(result.current, true);

    unmount();

    expect(weakMap.has(result.current)).toBe(false);
  });

  it('should handle performance optimization verification', async () => {
    const { result } = renderHook(() => useForm('test-form'), { wrapper });
    const start = performance.now();

    await act(async () => {
      for (let i = 0; i < 100; i++) {
        await result.current.updateField(`field${i}`, `value${i}`);
      }
    });

    const end = performance.now();
    expect(end - start).toBeLessThan(1000); // Should complete within 1 second
  });
});