// @ts-check
import { createSlice, createAsyncThunk, createSelector, PayloadAction } from '@reduxjs/toolkit'; // v2.0.0
import { FormState, ValidationError, isValidFormState } from '../../types/form';
import { createForm, updateForm, deleteForm } from '../../lib/api/forms';
import { validateFormState } from '../../lib/utils/validation';
import { DEFAULT_FORM_STATE } from '../../lib/constants/forms';

/**
 * Interface for form slice state with caching and error handling
 */
interface FormSliceState {
  currentForm: FormState | null;
  formCache: Record<string, FormState>;
  loading: boolean;
  error: ValidationError[] | null;
  isOptimisticUpdate: boolean;
  lastSaved: Date | null;
}

/**
 * Initial state for form slice
 */
const initialState: FormSliceState = {
  currentForm: null,
  formCache: {},
  loading: false,
  error: null,
  isOptimisticUpdate: false,
  lastSaved: null
};

/**
 * Async thunk for creating a new form
 */
export const createFormThunk = createAsyncThunk(
  'form/create',
  async (formState: FormState, { rejectWithValue }) => {
    try {
      // Validate form state before submission
      const validationResult = await validateFormState(formState);
      if (!validationResult.isValid) {
        return rejectWithValue(validationResult.errors);
      }

      // Create form through API
      const createdForm = await createForm(formState);
      return createdForm;
    } catch (error) {
      return rejectWithValue((error as Error).message);
    }
  }
);

/**
 * Async thunk for updating form with optimistic updates
 */
export const updateFormThunk = createAsyncThunk(
  'form/update',
  async ({ formId, formState }: { formId: string; formState: FormState }, 
    { rejectWithValue, dispatch }) => {
    try {
      // Validate form state
      if (!isValidFormState(formState)) {
        return rejectWithValue('Invalid form state');
      }

      // Apply optimistic update
      dispatch(formSlice.actions.setOptimisticUpdate(true));
      dispatch(formSlice.actions.setCurrentForm(formState));

      // Update form through API
      const updatedForm = await updateForm(formId, formState);
      return updatedForm;
    } catch (error) {
      return rejectWithValue((error as Error).message);
    } finally {
      dispatch(formSlice.actions.setOptimisticUpdate(false));
    }
  }
);

/**
 * Async thunk for deleting form with confirmation
 */
export const deleteFormThunk = createAsyncThunk(
  'form/delete',
  async (formId: string, { rejectWithValue }) => {
    try {
      await deleteForm(formId);
      return formId;
    } catch (error) {
      return rejectWithValue((error as Error).message);
    }
  }
);

/**
 * Form slice with reducers and actions
 */
export const formSlice = createSlice({
  name: 'form',
  initialState,
  reducers: {
    setCurrentForm: (state, action: PayloadAction<FormState | null>) => {
      state.currentForm = action.payload;
      state.error = null;
    },
    updateFormField: (state, action: PayloadAction<{
      fieldId: string;
      updates: Partial<FormState['fields'][0]>;
    }>) => {
      if (state.currentForm) {
        const fieldIndex = state.currentForm.fields.findIndex(
          field => field.id === action.payload.fieldId
        );
        if (fieldIndex !== -1) {
          state.currentForm.fields[fieldIndex] = {
            ...state.currentForm.fields[fieldIndex],
            ...action.payload.updates
          };
          state.currentForm.isDirty = true;
        }
      }
    },
    updateFormStyle: (state, action: PayloadAction<Partial<FormState['style']>>) => {
      if (state.currentForm) {
        state.currentForm.style = {
          ...state.currentForm.style,
          ...action.payload
        };
        state.currentForm.isDirty = true;
      }
    },
    addFormField: (state, action: PayloadAction<FormState['fields'][0]>) => {
      if (state.currentForm) {
        state.currentForm.fields.push(action.payload);
        state.currentForm.isDirty = true;
      }
    },
    removeFormField: (state, action: PayloadAction<string>) => {
      if (state.currentForm) {
        state.currentForm.fields = state.currentForm.fields.filter(
          field => field.id !== action.payload
        );
        state.currentForm.isDirty = true;
      }
    },
    reorderFormFields: (state, action: PayloadAction<string[]>) => {
      if (state.currentForm) {
        const reorderedFields = action.payload.map(fieldId =>
          state.currentForm!.fields.find(field => field.id === fieldId)!
        );
        state.currentForm.fields = reorderedFields;
        state.currentForm.isDirty = true;
      }
    },
    setOptimisticUpdate: (state, action: PayloadAction<boolean>) => {
      state.isOptimisticUpdate = action.payload;
    },
    resetError: (state) => {
      state.error = null;
    },
    clearCache: (state) => {
      state.formCache = {};
    },
    resetForm: (state) => {
      state.currentForm = DEFAULT_FORM_STATE;
      state.error = null;
      state.isOptimisticUpdate = false;
    }
  },
  extraReducers: (builder) => {
    builder
      // Create form reducers
      .addCase(createFormThunk.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(createFormThunk.fulfilled, (state, action) => {
        state.loading = false;
        state.currentForm = action.payload;
        state.formCache[action.payload.id] = action.payload;
        state.lastSaved = new Date();
      })
      .addCase(createFormThunk.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as ValidationError[];
      })
      // Update form reducers
      .addCase(updateFormThunk.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(updateFormThunk.fulfilled, (state, action) => {
        state.loading = false;
        state.currentForm = action.payload;
        state.formCache[action.payload.id] = action.payload;
        state.lastSaved = new Date();
      })
      .addCase(updateFormThunk.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as ValidationError[];
        // Revert optimistic update on failure
        if (state.currentForm?.id) {
          state.currentForm = state.formCache[state.currentForm.id];
        }
      })
      // Delete form reducers
      .addCase(deleteFormThunk.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(deleteFormThunk.fulfilled, (state, action) => {
        state.loading = false;
        state.currentForm = null;
        delete state.formCache[action.payload];
      })
      .addCase(deleteFormThunk.rejected, (state, action) => {
        state.loading = false;
        state.error = [{ field: 'form', message: action.payload as string, type: 'ERROR' }];
      });
  }
});

// Selectors
export const selectCurrentForm = (state: { form: FormSliceState }) => state.form.currentForm;
export const selectFormLoading = (state: { form: FormSliceState }) => state.form.loading;
export const selectFormError = (state: { form: FormSliceState }) => state.form.error;
export const selectIsOptimisticUpdate = (state: { form: FormSliceState }) => 
  state.form.isOptimisticUpdate;

// Memoized selectors
export const selectFormFromCache = createSelector(
  [(state: { form: FormSliceState }) => state.form.formCache, 
   (_: { form: FormSliceState }, formId: string) => formId],
  (cache, formId) => cache[formId]
);

export const selectFormValidation = createSelector(
  [selectCurrentForm],
  (form) => form?.validation ?? []
);

// Export actions and reducer
export const { 
  setCurrentForm, 
  updateFormField, 
  updateFormStyle,
  addFormField,
  removeFormField,
  reorderFormFields,
  resetError,
  clearCache,
  resetForm 
} = formSlice.actions;

export default formSlice.reducer;