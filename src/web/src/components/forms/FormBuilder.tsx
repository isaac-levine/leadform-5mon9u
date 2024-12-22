import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { DragDropContext, Droppable, Draggable } from 'react-beautiful-dnd'; // v13.1.1
import clsx from 'clsx'; // v2.0.0
import { TextField } from './fields/TextField';
import { useForm } from '../../hooks/useForm';
import { FormPreview } from './FormPreview';
import { StyleEditor } from './styling/StyleEditor';
import { useAnalytics } from '../../hooks/useAnalytics';
import { FormFieldStyle, FormState } from '../../types/form';
import { FieldType, ValidationRuleType } from '../../../backend/shared/types/form.types';
import { FIELD_TYPES, DEFAULT_FIELD_STYLES, FORM_BUILDER_CONFIG } from '../../lib/constants/forms';

/**
 * Props interface for FormBuilder component
 */
interface FormBuilderProps {
  formId: string;
  className?: string;
  theme?: {
    mode: 'light' | 'dark';
    colors: Record<string, string>;
  };
  errorBoundary?: {
    onError: (error: Error) => void;
    fallback: React.ReactNode;
  };
}

/**
 * Enhanced form builder component with drag-and-drop, real-time preview, and analytics
 */
const FormBuilder: React.FC<FormBuilderProps> = React.memo(({
  formId,
  className,
  theme,
  errorBoundary
}) => {
  // Hooks
  const { formState, updateField, validateForm } = useForm(formId);
  const { trackEvent } = useAnalytics();
  const [isDragging, setIsDragging] = useState(false);

  // Memoized field types for palette
  const availableFields = useMemo(() => Object.entries(FIELD_TYPES).map(([key, type]) => ({
    id: `field-type-${key.toLowerCase()}`,
    type,
    label: key.charAt(0) + key.slice(1).toLowerCase().replace('_', ' ')
  })), []);

  /**
   * Handles field addition with validation and analytics
   */
  const handleFieldAdd = useCallback(async (fieldType: FieldType) => {
    try {
      const fieldId = `field-${Date.now()}`;
      const newField = {
        id: fieldId,
        type: fieldType,
        label: `New ${fieldType.toLowerCase()} field`,
        value: null,
        validation: [],
        isValid: true,
        isTouched: false,
        errors: []
      };

      await updateField(fieldId, newField);

      trackEvent('field_added', {
        fieldType,
        fieldId,
        formId
      });
    } catch (error) {
      console.error('Error adding field:', error);
      errorBoundary?.onError(error as Error);
    }
  }, [formId, updateField, trackEvent, errorBoundary]);

  /**
   * Handles drag and drop reordering with analytics
   */
  const handleDragEnd = useCallback(async (result: any) => {
    if (!result.destination) return;

    const sourceIndex = result.source.index;
    const destinationIndex = result.destination.index;

    if (sourceIndex === destinationIndex) return;

    try {
      const newFields = Array.from(formState.fields);
      const [removed] = newFields.splice(sourceIndex, 1);
      newFields.splice(destinationIndex, 0, removed);

      // Update form state with new field order
      const updatedFormState = {
        ...formState,
        fields: newFields,
        isDirty: true
      };

      await validateForm();

      trackEvent('fields_reordered', {
        formId,
        fieldId: result.draggableId,
        sourceIndex,
        destinationIndex
      });

      setIsDragging(false);
    } catch (error) {
      console.error('Error reordering fields:', error);
      errorBoundary?.onError(error as Error);
    }
  }, [formId, formState, validateForm, trackEvent, errorBoundary]);

  /**
   * Handles style updates with theme integration
   */
  const handleStyleUpdate = useCallback((updatedStyle: FormFieldStyle) => {
    try {
      const newStyle = {
        ...updatedStyle,
        ...(theme?.mode === 'dark' && {
          backgroundColor: theme.colors.neutral,
          textColor: '#FFFFFF',
          borderColor: theme.colors.primary
        })
      };

      updateField('style', newStyle);

      trackEvent('style_updated', {
        formId,
        themeMode: theme?.mode
      });
    } catch (error) {
      console.error('Error updating style:', error);
      errorBoundary?.onError(error as Error);
    }
  }, [formId, theme, updateField, trackEvent, errorBoundary]);

  return (
    <div 
      className={clsx('form-builder', className)}
      role="main"
      aria-label="Form Builder Interface"
    >
      <div className="form-builder__container">
        {/* Field Palette */}
        <div 
          className="form-builder__palette"
          role="region"
          aria-label="Available Form Fields"
        >
          <h2 className="text-lg font-semibold mb-4">Form Elements</h2>
          {availableFields.map(field => (
            <button
              key={field.id}
              className={clsx(
                'form-builder__field-button',
                'w-full p-3 mb-2 rounded',
                'border border-neutral-200',
                'hover:border-primary-500 transition-colors'
              )}
              onClick={() => handleFieldAdd(field.type)}
              aria-label={`Add ${field.label} field`}
            >
              <span className="flex items-center">
                <i className={`icon-${field.type.toLowerCase()} mr-2`} />
                {field.label}
              </span>
            </button>
          ))}
        </div>

        {/* Form Preview with Drag & Drop */}
        <DragDropContext
          onDragStart={() => setIsDragging(true)}
          onDragEnd={handleDragEnd}
        >
          <div 
            className="form-builder__preview"
            role="region"
            aria-label="Form Preview"
          >
            <Droppable droppableId="form-fields">
              {(provided) => (
                <div
                  ref={provided.innerRef}
                  {...provided.droppableProps}
                  className={clsx(
                    'form-builder__fields',
                    isDragging && 'form-builder__fields--dragging'
                  )}
                >
                  {formState.fields.map((field, index) => (
                    <Draggable
                      key={field.id}
                      draggableId={field.id}
                      index={index}
                    >
                      {(provided, snapshot) => (
                        <div
                          ref={provided.innerRef}
                          {...provided.draggableProps}
                          {...provided.dragHandleProps}
                          className={clsx(
                            'form-builder__field',
                            snapshot.isDragging && 'form-builder__field--dragging'
                          )}
                        >
                          <FormPreview
                            formState={{
                              ...formState,
                              fields: [field]
                            }}
                            onFieldChange={updateField}
                            theme={theme}
                          />
                        </div>
                      )}
                    </Draggable>
                  ))}
                  {provided.placeholder}
                </div>
              )}
            </Droppable>
          </div>
        </DragDropContext>

        {/* Style Editor */}
        <div 
          className="form-builder__style-editor"
          role="region"
          aria-label="Style Editor"
        >
          <StyleEditor
            style={formState.style}
            onStyleChange={handleStyleUpdate}
            showPreview={true}
          />
        </div>
      </div>

      <style jsx>{`
        .form-builder {
          height: calc(100vh - 64px);
          overflow: hidden;
        }

        .form-builder__container {
          display: grid;
          grid-template-columns: 260px 1fr 300px;
          gap: 24px;
          height: 100%;
          padding: 24px;
        }

        .form-builder__palette {
          background: var(--palette-background);
          border-radius: 8px;
          padding: 16px;
          border: 1px solid var(--border-color);
          overflow-y: auto;
        }

        .form-builder__preview {
          background: var(--preview-background);
          border-radius: 8px;
          padding: 24px;
          overflow: auto;
        }

        .form-builder__style-editor {
          background: var(--editor-background);
          border-radius: 8px;
          padding: 16px;
          border: 1px solid var(--border-color);
          overflow-y: auto;
        }

        .form-builder__field {
          margin-bottom: 16px;
          transition: transform 0.2s ease;
        }

        .form-builder__field--dragging {
          transform: scale(1.02);
          box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
        }
      `}</style>
    </div>
  );
});

FormBuilder.displayName = 'FormBuilder';

export default FormBuilder;