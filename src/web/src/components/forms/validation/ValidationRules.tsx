import React, { useCallback, useMemo, useState } from 'react';
import { z } from 'zod'; // v3.22.0
import { validateFormField } from '../../../lib/utils/validation';
import { VALIDATION_RULES, VALIDATION_MESSAGES } from '../../../lib/constants/forms';
import { FormState, ValidationError } from '../../../types/form';
import { FieldType, ValidationRuleType } from '../../../backend/shared/types/form.types';

interface ValidationRulesProps {
  field: FormState['fields'][0];
  onFieldUpdate: (field: FormState['fields'][0]) => void;
  options?: {
    maxRules?: number;
    disabledRules?: ValidationRuleType[];
    customValidators?: Array<{
      type: ValidationRuleType.CUSTOM;
      name: string;
      validatorFn: string;
    }>;
  };
}

interface ValidationRuleConfig {
  type: ValidationRuleType;
  label: string;
  configurable: boolean;
  paramType?: 'number' | 'string' | 'array' | 'function';
  defaultMessage: string;
}

const RULE_CONFIGS: Record<ValidationRuleType, ValidationRuleConfig> = {
  [ValidationRuleType.REQUIRED]: {
    type: ValidationRuleType.REQUIRED,
    label: 'Required',
    configurable: false,
    defaultMessage: VALIDATION_MESSAGES.messages[ValidationRuleType.REQUIRED]
  },
  [ValidationRuleType.EMAIL]: {
    type: ValidationRuleType.EMAIL,
    label: 'Email',
    configurable: false,
    defaultMessage: VALIDATION_MESSAGES.messages[ValidationRuleType.EMAIL]
  },
  [ValidationRuleType.PHONE]: {
    type: ValidationRuleType.PHONE,
    label: 'Phone',
    configurable: false,
    defaultMessage: VALIDATION_MESSAGES.messages[ValidationRuleType.PHONE]
  },
  [ValidationRuleType.MIN_LENGTH]: {
    type: ValidationRuleType.MIN_LENGTH,
    label: 'Minimum Length',
    configurable: true,
    paramType: 'number',
    defaultMessage: VALIDATION_MESSAGES.templates.minLength(0)
  },
  [ValidationRuleType.MAX_LENGTH]: {
    type: ValidationRuleType.MAX_LENGTH,
    label: 'Maximum Length',
    configurable: true,
    paramType: 'number',
    defaultMessage: VALIDATION_MESSAGES.templates.maxLength(0)
  },
  [ValidationRuleType.FILE_SIZE]: {
    type: ValidationRuleType.FILE_SIZE,
    label: 'File Size',
    configurable: true,
    paramType: 'number',
    defaultMessage: VALIDATION_MESSAGES.messages[ValidationRuleType.FILE_SIZE]
  },
  [ValidationRuleType.FILE_TYPE]: {
    type: ValidationRuleType.FILE_TYPE,
    label: 'File Type',
    configurable: true,
    paramType: 'array',
    defaultMessage: VALIDATION_MESSAGES.messages[ValidationRuleType.FILE_TYPE]
  },
  [ValidationRuleType.CUSTOM]: {
    type: ValidationRuleType.CUSTOM,
    label: 'Custom',
    configurable: true,
    paramType: 'function',
    defaultMessage: VALIDATION_MESSAGES.messages[ValidationRuleType.CUSTOM]
  },
  [ValidationRuleType.ASYNC]: {
    type: ValidationRuleType.ASYNC,
    label: 'Async',
    configurable: true,
    paramType: 'function',
    defaultMessage: VALIDATION_RULES.ASYNC.message
  },
  [ValidationRuleType.DEPENDENT]: {
    type: ValidationRuleType.DEPENDENT,
    label: 'Dependent',
    configurable: true,
    paramType: 'function',
    defaultMessage: VALIDATION_RULES.DEPENDENT.message
  }
};

export const ValidationRules: React.FC<ValidationRulesProps> = ({
  field,
  onFieldUpdate,
  options = {}
}) => {
  const [validationErrors, setValidationErrors] = useState<ValidationError[]>([]);
  const [isEditing, setIsEditing] = useState<string | null>(null);

  const availableRules = useMemo(() => {
    const rules = Object.values(RULE_CONFIGS).filter(rule => {
      // Filter out disabled rules
      if (options.disabledRules?.includes(rule.type)) return false;
      
      // Filter rules based on field type compatibility
      switch (field.type) {
        case FieldType.EMAIL:
          return rule.type !== ValidationRuleType.PHONE;
        case FieldType.PHONE:
          return rule.type !== ValidationRuleType.EMAIL;
        case FieldType.FILE:
          return [
            ValidationRuleType.REQUIRED,
            ValidationRuleType.FILE_SIZE,
            ValidationRuleType.FILE_TYPE,
            ValidationRuleType.CUSTOM
          ].includes(rule.type);
        default:
          return true;
      }
    });

    // Add custom validators if provided
    if (options.customValidators) {
      rules.push(...options.customValidators.map(validator => ({
        type: ValidationRuleType.CUSTOM,
        label: validator.name,
        configurable: true,
        paramType: 'function',
        defaultMessage: VALIDATION_MESSAGES.messages[ValidationRuleType.CUSTOM]
      })));
    }

    return rules;
  }, [field.type, options.disabledRules, options.customValidators]);

  const handleRuleAdd = useCallback(async (ruleType: ValidationRuleType) => {
    const config = RULE_CONFIGS[ruleType];
    if (!config) return;

    // Check if rule already exists for non-repeatable rules
    if (!config.configurable && field.validation.some(r => r.type === ruleType)) {
      setValidationErrors([{
        field: 'validation',
        message: 'This rule is already applied',
        type: ruleType
      }]);
      return;
    }

    // Check max rules limit
    if (options.maxRules && field.validation.length >= options.maxRules) {
      setValidationErrors([{
        field: 'validation',
        message: `Maximum ${options.maxRules} rules allowed`,
        type: ruleType
      }]);
      return;
    }

    const newRule = {
      type: ruleType,
      message: config.defaultMessage,
      isAsync: ruleType === ValidationRuleType.ASYNC,
      validatorFn: '',
      value: config.paramType === 'number' ? 0 : config.paramType === 'array' ? [] : ''
    };

    const updatedField = {
      ...field,
      validation: [...field.validation, newRule]
    };

    // Validate the field with new rule
    const validationResult = await validateFormField(
      field.value,
      updatedField.validation,
      field.type as FieldType
    );

    onFieldUpdate({
      ...updatedField,
      isValid: validationResult.isValid,
      errors: validationResult.errors
    });
  }, [field, options.maxRules, onFieldUpdate]);

  const handleRuleRemove = useCallback(async (ruleIndex: number) => {
    const updatedValidation = field.validation.filter((_, index) => index !== ruleIndex);
    const updatedField = {
      ...field,
      validation: updatedValidation
    };

    // Revalidate field after rule removal
    const validationResult = await validateFormField(
      field.value,
      updatedValidation,
      field.type as FieldType
    );

    onFieldUpdate({
      ...updatedField,
      isValid: validationResult.isValid,
      errors: validationResult.errors
    });
  }, [field, onFieldUpdate]);

  const handleRuleUpdate = useCallback(async (
    ruleIndex: number,
    updates: Partial<typeof field.validation[0]>
  ) => {
    const updatedValidation = field.validation.map((rule, index) =>
      index === ruleIndex ? { ...rule, ...updates } : rule
    );

    const updatedField = {
      ...field,
      validation: updatedValidation
    };

    // Revalidate field with updated rule
    const validationResult = await validateFormField(
      field.value,
      updatedValidation,
      field.type as FieldType
    );

    onFieldUpdate({
      ...updatedField,
      isValid: validationResult.isValid,
      errors: validationResult.errors
    });
  }, [field, onFieldUpdate]);

  return (
    <div className="validation-rules" role="region" aria-label="Validation Rules">
      <div className="validation-rules__header">
        <h3>Validation Rules</h3>
        {validationErrors.length > 0 && (
          <div className="validation-rules__errors" role="alert">
            {validationErrors.map((error, index) => (
              <p key={index} className="error-message">
                {error.message}
              </p>
            ))}
          </div>
        )}
      </div>

      <div className="validation-rules__list">
        {field.validation.map((rule, index) => (
          <div
            key={`${rule.type}-${index}`}
            className="validation-rule"
            role="group"
            aria-label={`${RULE_CONFIGS[rule.type].label} Rule`}
          >
            <div className="validation-rule__header">
              <span>{RULE_CONFIGS[rule.type].label}</span>
              <button
                type="button"
                onClick={() => handleRuleRemove(index)}
                aria-label={`Remove ${RULE_CONFIGS[rule.type].label} rule`}
              >
                Remove
              </button>
            </div>

            {RULE_CONFIGS[rule.type].configurable && (
              <div className="validation-rule__config">
                {isEditing === `${rule.type}-${index}` ? (
                  <div className="validation-rule__editor">
                    {/* Rule-specific configuration UI */}
                    {RULE_CONFIGS[rule.type].paramType === 'number' && (
                      <input
                        type="number"
                        value={rule.value as number}
                        onChange={(e) => handleRuleUpdate(index, {
                          value: parseInt(e.target.value, 10)
                        })}
                        aria-label={`${RULE_CONFIGS[rule.type].label} value`}
                      />
                    )}
                    {RULE_CONFIGS[rule.type].paramType === 'array' && (
                      <input
                        type="text"
                        value={(rule.value as string[]).join(', ')}
                        onChange={(e) => handleRuleUpdate(index, {
                          value: e.target.value.split(',').map(v => v.trim())
                        })}
                        aria-label={`${RULE_CONFIGS[rule.type].label} values`}
                      />
                    )}
                    {RULE_CONFIGS[rule.type].paramType === 'function' && (
                      <textarea
                        value={rule.validatorFn}
                        onChange={(e) => handleRuleUpdate(index, {
                          validatorFn: e.target.value
                        })}
                        aria-label={`${RULE_CONFIGS[rule.type].label} function`}
                      />
                    )}
                    <button
                      type="button"
                      onClick={() => setIsEditing(null)}
                      aria-label="Save configuration"
                    >
                      Save
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setIsEditing(`${rule.type}-${index}`)}
                    aria-label={`Edit ${RULE_CONFIGS[rule.type].label} configuration`}
                  >
                    Edit Configuration
                  </button>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="validation-rules__actions">
        <select
          onChange={(e) => handleRuleAdd(e.target.value as ValidationRuleType)}
          value=""
          aria-label="Add validation rule"
        >
          <option value="">Add Validation Rule</option>
          {availableRules.map(rule => (
            <option key={rule.type} value={rule.type}>
              {rule.label}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
};

export default ValidationRules;