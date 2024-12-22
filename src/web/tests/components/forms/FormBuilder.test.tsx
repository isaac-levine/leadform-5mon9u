import React from 'react';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from '@axe-core/react'; // v4.7.0
import { Provider } from 'react-redux';
import { ThemeProvider } from '@mui/material';
import { vi } from 'vitest';
import { FormBuilder } from '../../src/components/forms/FormBuilder';
import { useForm } from '../../src/hooks/useForm';
import { useAnalytics } from '../../src/hooks/useAnalytics';
import { DEFAULT_FIELD_STYLES, FIELD_TYPES } from '../../src/lib/constants/forms';
import { FieldType } from '../../../backend/shared/types/form.types';

// Mock hooks
vi.mock('../../src/hooks/useForm', () => ({
  useForm: vi.fn()
}));

vi.mock('../../src/hooks/useAnalytics', () => ({
  useAnalytics: vi.fn()
}));

// Mock form state
const mockFormState = {
  id: 'test-form-id',
  fields: [
    {
      id: 'field-1',
      type: FieldType.TEXT,
      label: 'Test Field',
      required: true,
      validation: [
        {
          type: 'REQUIRED',
          message: 'This field is required'
        }
      ],
      isValid: true,
      isTouched: false,
      errors: []
    }
  ],
  style: DEFAULT_FIELD_STYLES,
  isDirty: false,
  isValid: true,
  submissionState: 'idle',
  errors: []
};

// Helper function to render component with providers
const renderWithProviders = (
  ui: React.ReactElement,
  {
    preloadedState = {},
    themeOptions = {},
    ...renderOptions
  } = {}
) => {
  const mockStore = {
    getState: () => preloadedState,
    subscribe: vi.fn(),
    dispatch: vi.fn()
  };

  return render(
    <Provider store={mockStore}>
      <ThemeProvider theme={{ ...themeOptions }}>
        {ui}
      </ThemeProvider>
    </Provider>,
    renderOptions
  );
};

describe('FormBuilder Component - Core Functionality', () => {
  beforeEach(() => {
    // Setup hook mocks
    (useForm as jest.Mock).mockReturnValue({
      formState: mockFormState,
      updateField: vi.fn(),
      validateForm: vi.fn()
    });

    (useAnalytics as jest.Mock).mockReturnValue({
      trackEvent: vi.fn()
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  test('renders form builder interface with all required sections', () => {
    renderWithProviders(<FormBuilder formId="test-form" />);

    // Verify main sections are present
    expect(screen.getByRole('region', { name: /available form fields/i })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: /form preview/i })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: /style editor/i })).toBeInTheDocument();
  });

  test('displays all available field types in palette', () => {
    renderWithProviders(<FormBuilder formId="test-form" />);

    Object.entries(FIELD_TYPES).forEach(([key, type]) => {
      const fieldButton = screen.getByRole('button', { name: new RegExp(key, 'i') });
      expect(fieldButton).toBeInTheDocument();
    });
  });

  test('adds new field on drag and drop', async () => {
    const updateField = vi.fn();
    (useForm as jest.Mock).mockReturnValue({
      formState: mockFormState,
      updateField,
      validateForm: vi.fn()
    });

    renderWithProviders(<FormBuilder formId="test-form" />);

    // Simulate drag and drop
    const fieldButton = screen.getByRole('button', { name: /add text field/i });
    fireEvent.dragStart(fieldButton);
    const dropZone = screen.getByRole('region', { name: /form preview/i });
    fireEvent.drop(dropZone);

    await waitFor(() => {
      expect(updateField).toHaveBeenCalled();
    });
  });

  test('tracks analytics events for field operations', async () => {
    const trackEvent = vi.fn();
    (useAnalytics as jest.Mock).mockReturnValue({ trackEvent });

    renderWithProviders(<FormBuilder formId="test-form" />);

    // Add field and verify tracking
    const fieldButton = screen.getByRole('button', { name: /add text field/i });
    await userEvent.click(fieldButton);

    expect(trackEvent).toHaveBeenCalledWith('field_added', expect.any(Object));
  });
});

describe('FormBuilder Component - Accessibility', () => {
  test('meets WCAG 2.1 Level AA requirements', async () => {
    const { container } = renderWithProviders(<FormBuilder formId="test-form" />);
    const results = await axe(container);
    expect(results.violations).toHaveLength(0);
  });

  test('supports keyboard navigation', async () => {
    renderWithProviders(<FormBuilder formId="test-form" />);

    // Tab through interactive elements
    await userEvent.tab();
    expect(screen.getByRole('button', { name: /add text field/i })).toHaveFocus();

    // Verify all interactive elements are reachable
    const interactiveElements = screen.getAllByRole('button');
    for (let i = 0; i < interactiveElements.length; i++) {
      await userEvent.tab();
      expect(interactiveElements[i]).toHaveFocus();
    }
  });

  test('provides appropriate ARIA labels and roles', () => {
    renderWithProviders(<FormBuilder formId="test-form" />);

    expect(screen.getByRole('main')).toHaveAttribute('aria-label', 'Form Builder Interface');
    expect(screen.getByRole('region', { name: /available form fields/i })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: /form preview/i })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: /style editor/i })).toBeInTheDocument();
  });
});

describe('FormBuilder Component - Style Editor Integration', () => {
  test('updates form styling through style editor', async () => {
    const updateField = vi.fn();
    (useForm as jest.Mock).mockReturnValue({
      formState: mockFormState,
      updateField,
      validateForm: vi.fn()
    });

    renderWithProviders(<FormBuilder formId="test-form" />);

    // Change background color
    const colorInput = screen.getByLabelText(/background color/i);
    await userEvent.type(colorInput, '#FF0000');
    await userEvent.tab();

    expect(updateField).toHaveBeenCalledWith('style', expect.objectContaining({
      backgroundColor: '#FF0000'
    }));
  });

  test('applies theme overrides correctly', () => {
    const theme = {
      mode: 'dark',
      colors: {
        primary: '#FFFFFF',
        neutral: '#000000'
      }
    };

    renderWithProviders(
      <FormBuilder formId="test-form" theme={theme} />,
      { themeOptions: theme }
    );

    const styleEditor = screen.getByRole('region', { name: /style editor/i });
    expect(styleEditor).toHaveStyle({
      backgroundColor: '#000000',
      color: '#FFFFFF'
    });
  });
});

describe('FormBuilder Component - Error Handling', () => {
  test('displays error boundary fallback on error', () => {
    const onError = vi.fn();
    const fallback = <div>Error occurred</div>;

    renderWithProviders(
      <FormBuilder 
        formId="test-form" 
        errorBoundary={{ onError, fallback }} 
      />
    );

    // Simulate error
    const error = new Error('Test error');
    (useForm as jest.Mock).mockImplementation(() => {
      throw error;
    });

    expect(onError).toHaveBeenCalledWith(error);
    expect(screen.getByText('Error occurred')).toBeInTheDocument();
  });

  test('validates field operations before updating', async () => {
    const validateForm = vi.fn();
    (useForm as jest.Mock).mockReturnValue({
      formState: mockFormState,
      updateField: vi.fn(),
      validateForm
    });

    renderWithProviders(<FormBuilder formId="test-form" />);

    // Attempt to add invalid field
    const fieldButton = screen.getByRole('button', { name: /add text field/i });
    await userEvent.click(fieldButton);

    expect(validateForm).toHaveBeenCalled();
  });
});