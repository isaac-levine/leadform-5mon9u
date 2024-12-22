// @ts-check
import React, { useCallback, useMemo, useState } from 'react'; // v18.0.0
import { FormState, FormFieldStyle, ValidationRule } from '../../types/form';
import { useForm } from '../../hooks/useForm';
import { VALIDATION_RULES, DEFAULT_FIELD_STYLES, FORM_BUILDER_CONFIG } from '../../lib/constants/forms';
import { validateFormState } from '../../lib/utils/validation';

/**
 * Props interface for FormSettings component
 */
interface FormSettingsProps {
  formId: string;
  onSave: () => void;
  errorFallback?: React.ComponentType<{ error: Error }>;
}

/**
 * Enhanced form settings component with accessibility and analytics support
 * @component
 */
const FormSettings: React.FC<FormSettingsProps> = React.memo(({ 
  formId, 
  onSave, 
  errorFallback: ErrorFallback 
}) => {
  // Form management hook
  const { 
    formState, 
    updateStyle, 
    updateValidation, 
    saveForm, 
    trackSettingsChange 
  } = useForm(formId);

  // Local state for settings management
  const [activeTab, setActiveTab] = useState<'validation' | 'styling' | 'notifications' | 'integrations'>('validation');
  const [isSaving, setIsSaving] = useState(false);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);

  /**
   * Handles validation rule changes with async validation support
   */
  const handleValidationChange = useCallback(async (rule: ValidationRule) => {
    try {
      // Validate rule format and dependencies
      const validationResult = await validateFormState({
        ...formState,
        validation: [...formState.validation, rule]
      });

      if (!validationResult.isValid) {
        setValidationErrors(validationResult.errors.map(error => error.message));
        return;
      }

      // Track validation change in analytics
      trackSettingsChange({
        type: 'validation',
        action: 'add_rule',
        ruleType: rule.type
      });

      // Update form validation state
      await updateValidation([...formState.validation, rule]);
      setValidationErrors([]);
    } catch (error) {
      console.error('Validation change error:', error);
      setValidationErrors(['Failed to update validation rules']);
    }
  }, [formState, updateValidation, trackSettingsChange]);

  /**
   * Handles style changes with theme integration
   */
  const handleStyleChange = useCallback((style: Partial<FormFieldStyle>) => {
    try {
      // Apply theme overrides and update style
      const updatedStyle = {
        ...formState.style,
        ...style,
        // Preserve responsive styles
        responsive: {
          ...formState.style.responsive,
          ...style.responsive
        }
      };

      // Track style change in analytics
      trackSettingsChange({
        type: 'styling',
        action: 'update_style',
        properties: Object.keys(style)
      });

      updateStyle(updatedStyle);
    } catch (error) {
      console.error('Style change error:', error);
    }
  }, [formState.style, updateStyle, trackSettingsChange]);

  /**
   * Handles form settings save with validation
   */
  const handleSave = useCallback(async () => {
    try {
      setIsSaving(true);

      // Validate entire form state before saving
      const validationResult = await validateFormState(formState);
      if (!validationResult.isValid) {
        setValidationErrors(validationResult.errors.map(error => error.message));
        return;
      }

      await saveForm();
      onSave();
      
      // Track successful save in analytics
      trackSettingsChange({
        type: 'settings',
        action: 'save_settings',
        success: true
      });
    } catch (error) {
      console.error('Save error:', error);
      setValidationErrors(['Failed to save form settings']);
      
      // Track failed save in analytics
      trackSettingsChange({
        type: 'settings',
        action: 'save_settings',
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    } finally {
      setIsSaving(false);
    }
  }, [formState, saveForm, onSave, trackSettingsChange]);

  /**
   * Memoized settings sections for performance
   */
  const settingsSections = useMemo(() => ({
    validation: (
      <section 
        aria-labelledby="validation-settings-title"
        className="settings-section"
      >
        <h2 id="validation-settings-title" className="settings-title">
          Validation Rules
        </h2>
        <div className="validation-rules-container">
          {formState.validation.map((rule, index) => (
            <div 
              key={`${rule.type}-${index}`}
              className="validation-rule-item"
              role="group"
              aria-label={`Validation rule ${index + 1}`}
            >
              {/* Rule configuration UI */}
              <select
                value={rule.type}
                onChange={(e) => handleValidationChange({
                  ...rule,
                  type: e.target.value as ValidationRule['type']
                })}
                aria-label="Rule type"
              >
                {Object.entries(VALIDATION_RULES).map(([key, value]) => (
                  <option key={key} value={value.type}>
                    {key}
                  </option>
                ))}
              </select>
              {/* Additional rule configuration fields */}
            </div>
          ))}
          <button
            onClick={() => handleValidationChange({
              type: VALIDATION_RULES.REQUIRED.type,
              message: VALIDATION_RULES.REQUIRED.message,
              isAsync: false,
              schema: null
            })}
            className="add-rule-button"
            aria-label="Add validation rule"
          >
            Add Rule
          </button>
        </div>
      </section>
    ),
    styling: (
      <section 
        aria-labelledby="styling-settings-title"
        className="settings-section"
      >
        <h2 id="styling-settings-title" className="settings-title">
          Form Styling
        </h2>
        <div className="style-controls-container">
          {/* Color picker for background */}
          <div className="style-control-item">
            <label htmlFor="backgroundColor">Background Color</label>
            <input
              type="color"
              id="backgroundColor"
              value={formState.style.backgroundColor}
              onChange={(e) => handleStyleChange({ backgroundColor: e.target.value })}
            />
          </div>
          {/* Additional style controls */}
        </div>
      </section>
    )
  }), [formState, handleValidationChange, handleStyleChange]);

  // Error boundary fallback
  if (ErrorFallback) {
    return (
      <ErrorBoundary FallbackComponent={ErrorFallback}>
        {/* Component content */}
      </ErrorBoundary>
    );
  }

  return (
    <div 
      className="form-settings-container"
      role="region"
      aria-label="Form settings"
    >
      {/* Settings navigation */}
      <nav role="tablist" className="settings-tabs">
        {['validation', 'styling', 'notifications', 'integrations'].map((tab) => (
          <button
            key={tab}
            role="tab"
            aria-selected={activeTab === tab}
            aria-controls={`${tab}-panel`}
            onClick={() => setActiveTab(tab as typeof activeTab)}
            className={`tab-button ${activeTab === tab ? 'active' : ''}`}
          >
            {tab.charAt(0).toUpperCase() + tab.slice(1)}
          </button>
        ))}
      </nav>

      {/* Settings content */}
      <div 
        role="tabpanel"
        id={`${activeTab}-panel`}
        aria-labelledby={`${activeTab}-tab`}
        className="settings-content"
      >
        {settingsSections[activeTab]}
      </div>

      {/* Validation errors */}
      {validationErrors.length > 0 && (
        <div 
          role="alert"
          className="validation-errors"
        >
          {validationErrors.map((error, index) => (
            <p key={index} className="error-message">{error}</p>
          ))}
        </div>
      )}

      {/* Save button */}
      <button
        onClick={handleSave}
        disabled={isSaving || validationErrors.length > 0}
        className="save-button"
        aria-busy={isSaving}
      >
        {isSaving ? 'Saving...' : 'Save Settings'}
      </button>
    </div>
  );
});

FormSettings.displayName = 'FormSettings';

export default FormSettings;