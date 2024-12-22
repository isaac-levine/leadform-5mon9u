import React, { useCallback, useRef, useState } from 'react';
import classNames from 'classnames'; // v2.3.2
import { FormFieldStyle } from '../../../types/form';
import { validateFormField } from '../../../lib/utils/validation';
import Input from '../../shared/Input';

/**
 * Props interface for FileField component with enhanced accessibility and validation
 */
interface FileFieldProps {
  id: string;
  name: string;
  label: string;
  acceptedTypes: string[];
  maxSize: number;
  required?: boolean;
  disabled?: boolean;
  style?: FormFieldStyle;
  onChange: (file: File) => void;
  onBlur?: () => void;
  ariaLabel?: string;
  ariaDescribedBy?: string;
  showProgress?: boolean;
  onError?: (error: string) => void;
}

/**
 * Enhanced file upload field component with drag-and-drop, accessibility, and validation
 */
const FileField: React.FC<FileFieldProps> = ({
  id,
  name,
  label,
  acceptedTypes,
  maxSize,
  required = false,
  disabled = false,
  style,
  onChange,
  onBlur,
  ariaLabel,
  ariaDescribedBy,
  showProgress = false,
  onError
}) => {
  const [isDragOver, setIsDragOver] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dragCountRef = useRef(0);

  /**
   * Validates the selected file against type and size constraints
   */
  const validateFile = useCallback(async (file: File): Promise<boolean> => {
    try {
      const result = await validateFormField(
        file,
        [
          {
            type: 'FILE_TYPE',
            value: acceptedTypes,
            message: `Accepted file types: ${acceptedTypes.join(', ')}`
          },
          {
            type: 'FILE_SIZE',
            value: maxSize,
            message: `Maximum file size: ${maxSize}MB`
          }
        ],
        'FILE'
      );

      if (!result.isValid) {
        const errorMessage = result.errors[0]?.message || 'Invalid file';
        setError(errorMessage);
        onError?.(errorMessage);
        return false;
      }

      setError(null);
      return true;
    } catch (err) {
      console.error('File validation error:', err);
      const errorMessage = 'File validation failed';
      setError(errorMessage);
      onError?.(errorMessage);
      return false;
    }
  }, [acceptedTypes, maxSize, onError]);

  /**
   * Handles file selection from input or drop
   */
  const handleFileSelection = useCallback(async (file: File) => {
    const isValid = await validateFile(file);
    if (isValid) {
      setSelectedFile(file);
      onChange(file);

      // Simulate upload progress if showProgress is enabled
      if (showProgress) {
        const interval = setInterval(() => {
          setUploadProgress(prev => {
            if (prev >= 100) {
              clearInterval(interval);
              return 100;
            }
            return prev + 10;
          });
        }, 100);
      }
    }
  }, [onChange, showProgress, validateFile]);

  /**
   * Handles file input change event
   */
  const handleInputChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      await handleFileSelection(files[0]);
    }
  }, [handleFileSelection]);

  /**
   * Handles drag over event with counter for nested elements
   */
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCountRef.current++;
    
    if (!isDragOver) {
      setIsDragOver(true);
    }
  }, [isDragOver]);

  /**
   * Handles drag leave event with counter for nested elements
   */
  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCountRef.current--;
    
    if (dragCountRef.current === 0) {
      setIsDragOver(false);
    }
  }, []);

  /**
   * Handles file drop event
   */
  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
    dragCountRef.current = 0;

    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      await handleFileSelection(files[0]);
    }
  }, [handleFileSelection]);

  /**
   * Handles click on the drop zone
   */
  const handleDropZoneClick = useCallback(() => {
    if (!disabled && fileInputRef.current) {
      fileInputRef.current.click();
    }
  }, [disabled]);

  /**
   * Formats file size for display
   */
  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
  };

  // Generate class names for the drop zone
  const dropZoneClasses = classNames(
    'file-field__drop-zone',
    {
      'file-field__drop-zone--drag-over': isDragOver,
      'file-field__drop-zone--disabled': disabled,
      'file-field__drop-zone--has-file': selectedFile,
      'file-field__drop-zone--error': error
    }
  );

  return (
    <div className="file-field" style={style}>
      <Input
        ref={fileInputRef}
        type="file"
        id={id}
        name={name}
        accept={acceptedTypes.join(',')}
        onChange={handleInputChange}
        onBlur={onBlur}
        style={{ display: 'none' }}
        aria-hidden="true"
        tabIndex={-1}
      />

      <div
        className={dropZoneClasses}
        onClick={handleDropZoneClick}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        role="button"
        tabIndex={disabled ? -1 : 0}
        aria-label={ariaLabel || `Upload ${label}`}
        aria-describedby={ariaDescribedBy}
        aria-required={required}
        aria-disabled={disabled}
        aria-invalid={!!error}
      >
        <div className="file-field__content">
          {selectedFile ? (
            <>
              <span className="file-field__file-name">{selectedFile.name}</span>
              <span className="file-field__file-size">
                ({formatFileSize(selectedFile.size)})
              </span>
              {showProgress && uploadProgress < 100 && (
                <div 
                  className="file-field__progress"
                  role="progressbar"
                  aria-valuenow={uploadProgress}
                  aria-valuemin={0}
                  aria-valuemax={100}
                >
                  <div 
                    className="file-field__progress-bar"
                    style={{ width: `${uploadProgress}%` }}
                  />
                </div>
              )}
            </>
          ) : (
            <>
              <span className="file-field__placeholder">
                Drop a file here or click to select
              </span>
              <span className="file-field__help-text">
                Accepted types: {acceptedTypes.join(', ')} (Max: {maxSize}MB)
              </span>
            </>
          )}
        </div>
      </div>

      {error && (
        <div 
          className="file-field__error"
          role="alert"
          aria-live="polite"
        >
          {error}
        </div>
      )}
    </div>
  );
};

export default FileField;