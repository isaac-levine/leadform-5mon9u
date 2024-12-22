import React, { memo } from 'react'; // ^18.0.0
import clsx from 'clsx'; // ^2.0.0

// Types for button variants, sizes, and props
type ButtonVariant = 'primary' | 'secondary' | 'success' | 'error' | 'ghost';
type ButtonSize = 'sm' | 'md' | 'lg';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  /** Visual style variant of the button */
  variant?: ButtonVariant;
  /** Size variant of the button */
  size?: ButtonSize;
  /** Loading state with spinner indicator */
  isLoading?: boolean;
  /** Disabled state with visual feedback */
  isDisabled?: boolean;
  /** Full width button option */
  fullWidth?: boolean;
  /** Button content */
  children: React.ReactNode;
  /** Optional custom classes */
  className?: string;
  /** Accessible label for screen readers */
  ariaLabel?: string;
}

// Utility function to generate button class names
const getButtonClasses = (
  variant: ButtonVariant = 'primary',
  size: ButtonSize = 'md',
  isDisabled: boolean = false,
  fullWidth: boolean = false,
  className: string = ''
): string => {
  // Base styles including layout, focus states, and accessibility
  const baseStyles = 'inline-flex items-center justify-center rounded-md font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 select-none';

  // Variant-specific styles
  const variantStyles = {
    primary: 'bg-primary-600 text-white hover:bg-primary-700 focus-visible:ring-primary-500 active:bg-primary-800',
    secondary: 'bg-secondary-100 text-secondary-900 hover:bg-secondary-200 focus-visible:ring-secondary-500 active:bg-secondary-300',
    success: 'bg-success-600 text-white hover:bg-success-700 focus-visible:ring-success-500 active:bg-success-800',
    error: 'bg-error-600 text-white hover:bg-error-700 focus-visible:ring-error-500 active:bg-error-800',
    ghost: 'hover:bg-neutral-100 text-neutral-900 focus-visible:ring-neutral-500 active:bg-neutral-200'
  };

  // Size-specific styles
  const sizeStyles = {
    sm: 'h-8 px-3 text-sm gap-1.5',
    md: 'h-10 px-4 text-base gap-2',
    lg: 'h-12 px-6 text-lg gap-2.5'
  };

  // Combine all styles using clsx
  return clsx(
    baseStyles,
    variantStyles[variant],
    sizeStyles[size],
    fullWidth && 'w-full',
    isDisabled && 'disabled:opacity-50',
    className
  );
};

// Loading spinner component
const LoadingSpinner: React.FC = () => (
  <svg
    className="animate-spin -ml-1 mr-2 h-4 w-4"
    xmlns="http://www.w3.org/2000/svg"
    fill="none"
    viewBox="0 0 24 24"
    aria-hidden="true"
  >
    <circle
      className="opacity-25"
      cx="12"
      cy="12"
      r="10"
      stroke="currentColor"
      strokeWidth="4"
    />
    <path
      className="opacity-75"
      fill="currentColor"
      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
    />
  </svg>
);

/**
 * Button component implementing the design system's button styles and behaviors.
 * Supports multiple variants, sizes, and states while ensuring accessibility compliance.
 */
export const Button = memo<ButtonProps>(({
  variant = 'primary',
  size = 'md',
  isLoading = false,
  isDisabled = false,
  fullWidth = false,
  children,
  className = '',
  ariaLabel,
  type = 'button',
  onClick,
  ...props
}) => {
  // Generate complete class list
  const buttonClasses = getButtonClasses(
    variant,
    size,
    isDisabled,
    fullWidth,
    className
  );

  return (
    <button
      type={type}
      className={buttonClasses}
      disabled={isDisabled || isLoading}
      aria-label={ariaLabel}
      aria-disabled={isDisabled || isLoading}
      aria-busy={isLoading}
      onClick={!isDisabled && !isLoading ? onClick : undefined}
      {...props}
    >
      {isLoading && <LoadingSpinner />}
      {children}
    </button>
  );
});

// Display name for debugging
Button.displayName = 'Button';

// Default export
export default Button;

// Named exports for variant and size types
export type { ButtonVariant, ButtonSize, ButtonProps };