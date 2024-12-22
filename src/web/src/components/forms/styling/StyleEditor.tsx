import React, { useCallback, useMemo, useState } from 'react';
import clsx from 'clsx'; // v2.0.0
import { debounce } from 'lodash'; // v4.17.21
import { FormFieldStyle, Breakpoint } from '../../../types/form';
import Input from '../../shared/Input';
import Select from '../../shared/Select';
import { DEFAULT_FIELD_STYLES, RESPONSIVE_BREAKPOINTS } from '../../../lib/constants/forms';

/**
 * Interface for color validation result
 */
interface ColorValidationResult {
  isValid: boolean;
  message?: string;
}

/**
 * Props interface for StyleEditor component
 */
interface StyleEditorProps {
  style: FormFieldStyle;
  onStyleChange: (style: FormFieldStyle) => void;
  showPreview?: boolean;
  breakpoints?: Breakpoint[];
}

/**
 * Enhanced form style editor component with real-time preview and validation
 */
const StyleEditor: React.FC<StyleEditorProps> = React.memo(({
  style = DEFAULT_FIELD_STYLES,
  onStyleChange,
  showPreview = true,
  breakpoints = Object.values(Breakpoint)
}) => {
  // Local state for active breakpoint and validation
  const [activeBreakpoint, setActiveBreakpoint] = useState<Breakpoint | null>(null);
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});

  /**
   * Validates color format (hex, rgb, rgba)
   */
  const validateColor = useCallback((color: string): ColorValidationResult => {
    const hexRegex = /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/;
    const rgbRegex = /^rgb\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)$/;
    const rgbaRegex = /^rgba\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*,\s*([01]\.?\d*)\)$/;

    if (hexRegex.test(color) || rgbRegex.test(color) || rgbaRegex.test(color)) {
      return { isValid: true };
    }
    return { 
      isValid: false, 
      message: 'Invalid color format. Use hex (#RRGGBB) or rgb(r,g,b) or rgba(r,g,b,a)' 
    };
  }, []);

  /**
   * Validates size units (px, rem, em, %)
   */
  const validateSize = useCallback((size: string): boolean => {
    const sizeRegex = /^(\d*\.?\d+)(px|rem|em|%)$/;
    return sizeRegex.test(size);
  }, []);

  /**
   * Debounced style change handler with validation
   */
  const handleStyleChange = useMemo(() => debounce((
    property: keyof FormFieldStyle,
    value: string,
    breakpoint?: Breakpoint
  ) => {
    // Validate input based on property type
    let isValid = true;
    let errorMessage = '';

    if (['backgroundColor', 'textColor', 'borderColor'].includes(property)) {
      const colorValidation = validateColor(value);
      isValid = colorValidation.isValid;
      errorMessage = colorValidation.message || '';
    } else if (['fontSize', 'padding', 'borderRadius'].includes(property)) {
      isValid = validateSize(value);
      errorMessage = isValid ? '' : 'Invalid size format. Use px, rem, em, or %';
    }

    // Update validation errors
    setValidationErrors(prev => ({
      ...prev,
      [property]: isValid ? '' : errorMessage
    }));

    if (!isValid) return;

    // Update style with breakpoint support
    const newStyle = { ...style };
    if (breakpoint) {
      newStyle.responsive = {
        ...newStyle.responsive,
        [breakpoint]: {
          ...(newStyle.responsive?.[breakpoint] || {}),
          [property]: value
        }
      };
    } else {
      newStyle[property] = value;
    }

    onStyleChange(newStyle);
  }, 200), [style, onStyleChange, validateColor, validateSize]);

  /**
   * Breakpoint selector options
   */
  const breakpointOptions = useMemo(() => [
    { value: '', label: 'Base Styles' },
    ...breakpoints.map(bp => ({
      value: bp,
      label: RESPONSIVE_BREAKPOINTS.breakpoints[bp.toLowerCase()]
        ? `${RESPONSIVE_BREAKPOINTS.breakpoints[bp.toLowerCase()]}px and up`
        : bp
    }))
  ], [breakpoints]);

  /**
   * Get current style value considering breakpoints
   */
  const getStyleValue = useCallback((
    property: keyof FormFieldStyle,
    breakpoint?: Breakpoint
  ): string => {
    if (breakpoint) {
      return style.responsive?.[breakpoint]?.[property] || style[property] || '';
    }
    return style[property] || '';
  }, [style]);

  return (
    <div className="style-editor" role="region" aria-label="Form Style Editor">
      {/* Breakpoint Selector */}
      <div className="style-editor__breakpoints mb-4">
        <Select
          id="breakpoint-selector"
          name="breakpoint"
          value={activeBreakpoint || ''}
          options={breakpointOptions}
          onChange={(value) => setActiveBreakpoint(value as Breakpoint)}
          style={DEFAULT_FIELD_STYLES}
          ariaProps={{
            label: 'Select responsive breakpoint',
            description: 'Choose a breakpoint to edit styles for specific screen sizes'
          }}
        />
      </div>

      {/* Color Controls */}
      <div className="style-editor__section mb-4">
        <h3 className="text-lg font-semibold mb-2">Colors</h3>
        <div className="grid gap-4">
          <Input
            name="backgroundColor"
            type="text"
            label="Background Color"
            value={getStyleValue('backgroundColor', activeBreakpoint)}
            error={validationErrors.backgroundColor}
            onChange={(e) => handleStyleChange('backgroundColor', e.target.value, activeBreakpoint)}
            style={DEFAULT_FIELD_STYLES}
            ariaProps={{
              description: 'Enter a color in hex (#RRGGBB) or rgb(r,g,b) format'
            }}
          />
          <Input
            name="textColor"
            type="text"
            label="Text Color"
            value={getStyleValue('textColor', activeBreakpoint)}
            error={validationErrors.textColor}
            onChange={(e) => handleStyleChange('textColor', e.target.value, activeBreakpoint)}
            style={DEFAULT_FIELD_STYLES}
            ariaProps={{
              description: 'Enter a color in hex (#RRGGBB) or rgb(r,g,b) format'
            }}
          />
          <Input
            name="borderColor"
            type="text"
            label="Border Color"
            value={getStyleValue('borderColor', activeBreakpoint)}
            error={validationErrors.borderColor}
            onChange={(e) => handleStyleChange('borderColor', e.target.value, activeBreakpoint)}
            style={DEFAULT_FIELD_STYLES}
            ariaProps={{
              description: 'Enter a color in hex (#RRGGBB) or rgb(r,g,b) format'
            }}
          />
        </div>
      </div>

      {/* Size Controls */}
      <div className="style-editor__section mb-4">
        <h3 className="text-lg font-semibold mb-2">Dimensions</h3>
        <div className="grid gap-4">
          <Input
            name="fontSize"
            type="text"
            label="Font Size"
            value={getStyleValue('fontSize', activeBreakpoint)}
            error={validationErrors.fontSize}
            onChange={(e) => handleStyleChange('fontSize', e.target.value, activeBreakpoint)}
            style={DEFAULT_FIELD_STYLES}
            ariaProps={{
              description: 'Enter a size with units (px, rem, em, %)'
            }}
          />
          <Input
            name="padding"
            type="text"
            label="Padding"
            value={getStyleValue('padding', activeBreakpoint)}
            error={validationErrors.padding}
            onChange={(e) => handleStyleChange('padding', e.target.value, activeBreakpoint)}
            style={DEFAULT_FIELD_STYLES}
            ariaProps={{
              description: 'Enter padding with units (px, rem, em, %)'
            }}
          />
          <Input
            name="borderRadius"
            type="text"
            label="Border Radius"
            value={getStyleValue('borderRadius', activeBreakpoint)}
            error={validationErrors.borderRadius}
            onChange={(e) => handleStyleChange('borderRadius', e.target.value, activeBreakpoint)}
            style={DEFAULT_FIELD_STYLES}
            ariaProps={{
              description: 'Enter border radius with units (px, rem, em, %)'
            }}
          />
        </div>
      </div>

      {/* Preview */}
      {showPreview && (
        <div className="style-editor__preview mt-6">
          <h3 className="text-lg font-semibold mb-2">Preview</h3>
          <div 
            className={clsx(
              'style-preview p-4 border rounded',
              activeBreakpoint && 'style-preview--responsive'
            )}
          >
            <Input
              name="preview"
              type="text"
              label="Preview Input"
              value="Sample Text"
              disabled
              style={{
                ...style,
                ...(activeBreakpoint && style.responsive?.[activeBreakpoint])
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
});

StyleEditor.displayName = 'StyleEditor';

export default StyleEditor;