// @ts-check
import { useState, useMemo, useCallback, useRef, useEffect } from 'react'; // v18.0.0
import { useDispatch, useSelector } from 'react-redux'; // v9.0.0
import debounce from 'lodash/debounce'; // v4.17.21
import { 
  FormState, 
  ValidationError, 
  isValidFormState 
} from '../../types/form';
import { 
  formActions, 
  selectCurrentForm, 
  selectFormError, 
  selectIsOptimisticUpdate 
} from '../../store/slices/formSlice';
import { validateFormState } from '../lib/utils/validation';
import { DEFAULT_FORM_STATE, FORM_BUILDER_CONFIG } from '../lib/constants/forms';

/**
 * Options for useForm hook configuration
 */
interface UseFormOptions {
  validateOnChange?: boolean;
  validateOnBlur?: boolean;
  revalidateOnStateChange?: boolean;
  enableOptimisticUpdates?: boolean;
  autosave?: boolean;
  autosaveDelay?: number;
}

/**
 * Enhanced form state management hook with validation and optimistic updates
 * @param formId - Unique identifier for the form
 * @param options - Configuration options for form behavior
 */
export const useForm = (
  formId: string,
  options: UseFormOptions = {}
) => {
  const dispatch = useDispatch();
  const currentForm = useSelector(selectCurrentForm);
  const formError = useSelector(selectFormError);
  const isOptimisticUpdate = useSelector(selectIsOptimisticUpdate);

  // Default options
  const {
    validateOnChange = true,
    validateOnBlur = true,
    revalidateOnStateChange = true,
    enableOptimisticUpdates = true,
    autosave = true,
    autosaveDelay = FORM_BUILDER_CONFIG.AUTOSAVE_DELAY
  } = options;

  // Local state for form management
  const [localFormState, setLocalFormState] = useState<FormState>(
    currentForm || DEFAULT_FORM_STATE
  );
  const [validationState, setValidationState] = useState<{
    isValid: boolean;
    errors: ValidationError[];
    lastValidated?: Date;
  }>({
    isValid: true,
    errors: []
  });

  // Refs for tracking form state
  const isDirtyRef = useRef(false);
  const lastSavedRef = useRef<Date | null>(null);
  const validationTimeoutRef = useRef<NodeJS.Timeout>();

  /**
   * Memoized validation function with debouncing
   */
  const debouncedValidate = useMemo(
    () => debounce(async (state: FormState) => {
      const validationResult = await validateFormState(state);
      setValidationState({
        isValid: validationResult.isValid,
        errors: validationResult.errors,
        lastValidated: new Date()
      });
      return validationResult;
    }, 300),
    []
  );

  /**
   * Updates a single form field with validation
   */
  const updateField = useCallback(async (
    fieldId: string,
    value: unknown,
    shouldValidate = validateOnChange
  ) => {
    setLocalFormState(prevState => {
      const updatedState = {
        ...prevState,
        fields: prevState.fields.map(field =>
          field.id === fieldId
            ? { ...field, value, isTouched: true }
            : field
        ),
        isDirty: true
      };

      if (enableOptimisticUpdates) {
        dispatch(formActions.setOptimisticUpdate(true));
        dispatch(formActions.setCurrentForm(updatedState));
      }

      isDirtyRef.current = true;
      return updatedState;
    });

    if (shouldValidate) {
      if (validationTimeoutRef.current) {
        clearTimeout(validationTimeoutRef.current);
      }
      validationTimeoutRef.current = setTimeout(() => {
        debouncedValidate(localFormState);
      }, 300);
    }
  }, [dispatch, debouncedValidate, enableOptimisticUpdates, validateOnChange]);

  /**
   * Performs batch updates to form fields
   */
  const batchUpdate = useCallback(async (
    updates: Array<{ fieldId: string; value: unknown }>,
    shouldValidate = validateOnChange
  ) => {
    setLocalFormState(prevState => {
      const updatedState = {
        ...prevState,
        fields: prevState.fields.map(field => {
          const update = updates.find(u => u.fieldId === field.id);
          return update
            ? { ...field, value: update.value, isTouched: true }
            : field
        }),
        isDirty: true
      };

      if (enableOptimisticUpdates) {
        dispatch(formActions.setOptimisticUpdate(true));
        dispatch(formActions.setCurrentForm(updatedState));
      }

      isDirtyRef.current = true;
      return updatedState;
    });

    if (shouldValidate) {
      const validationResult = await validateFormState(localFormState);
      setValidationState({
        isValid: validationResult.isValid,
        errors: validationResult.errors,
        lastValidated: new Date()
      });
    }
  }, [dispatch, enableOptimisticUpdates, validateOnChange]);

  /**
   * Validates the entire form state
   */
  const validateForm = useCallback(async () => {
    const validationResult = await validateFormState(localFormState);
    setValidationState({
      isValid: validationResult.isValid,
      errors: validationResult.errors,
      lastValidated: new Date()
    });
    return validationResult;
  }, [localFormState]);

  /**
   * Resets validation state
   */
  const resetValidation = useCallback(() => {
    setValidationState({
      isValid: true,
      errors: [],
      lastValidated: new Date()
    });
    dispatch(formActions.resetError());
  }, [dispatch]);

  /**
   * Autosave functionality
   */
  useEffect(() => {
    if (!autosave || !isDirtyRef.current) return;

    const saveTimeout = setTimeout(() => {
      if (isValidFormState(localFormState)) {
        dispatch(formActions.setCurrentForm(localFormState));
        lastSavedRef.current = new Date();
        isDirtyRef.current = false;
      }
    }, autosaveDelay);

    return () => clearTimeout(saveTimeout);
  }, [localFormState, autosave, autosaveDelay, dispatch]);

  /**
   * Cleanup effect
   */
  useEffect(() => {
    return () => {
      if (validationTimeoutRef.current) {
        clearTimeout(validationTimeoutRef.current);
      }
      debouncedValidate.cancel();
    };
  }, [debouncedValidate]);

  return {
    formState: localFormState,
    validationState,
    updateField,
    batchUpdate,
    validateForm,
    resetValidation,
    isOptimisticUpdate,
    formError,
    lastSaved: lastSavedRef.current
  };
};

export default useForm;