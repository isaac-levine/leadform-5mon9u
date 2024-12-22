// @ts-check
import React, { memo } from 'react'; // ^18.0.0
import clsx from 'clsx'; // ^2.0.0

/**
 * Props interface for Card component with support for variants, padding, and HTML div attributes
 * @interface CardProps
 * @extends {React.HTMLAttributes<HTMLDivElement>}
 */
export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Visual style variant of the card */
  variant?: 'default' | 'elevated' | 'bordered';
  /** Padding size applied to the card */
  padding?: 'none' | 'sm' | 'md' | 'lg';
  /** Content to be rendered inside the card */
  children: React.ReactNode;
  /** Additional CSS classes to apply */
  className?: string;
}

/**
 * Generates card className string based on variant and padding options
 * @param {CardProps['variant']} variant - Visual style variant
 * @param {CardProps['padding']} padding - Padding size
 * @param {string | undefined} className - Additional custom classes
 * @returns {string} Combined className string
 */
const getCardClasses = (
  variant: CardProps['variant'],
  padding: CardProps['padding'],
  className?: string
): string => {
  // Base styles following design system specifications
  const baseClasses = 'rounded-lg bg-white transition-shadow duration-200';

  // Variant-specific styles
  const variantClasses = {
    default: 'border border-neutral-200 hover:border-neutral-300',
    elevated: 'shadow-md hover:shadow-lg',
    bordered: 'border-2 border-primary-500 hover:border-primary-600'
  }[variant ?? 'default'];

  // Padding styles based on design system spacing
  const paddingClasses = {
    none: 'p-0',
    sm: 'p-3',
    md: 'p-4',
    lg: 'p-6'
  }[padding ?? 'md'];

  return clsx(
    baseClasses,
    variantClasses,
    paddingClasses,
    className
  );
};

/**
 * A reusable card component implementing the design system's card styles and layout patterns.
 * Provides a consistent container for content display with support for multiple variants,
 * padding options, and accessibility features.
 *
 * @component
 * @example
 * ```tsx
 * <Card variant="elevated" padding="lg">
 *   <h2>Card Title</h2>
 *   <p>Card content goes here</p>
 * </Card>
 * ```
 */
export const Card = memo<CardProps>(({
  variant = 'default',
  padding = 'md',
  className,
  children,
  role = 'article',
  ...props
}) => {
  const cardClasses = getCardClasses(variant, padding, className);

  return (
    <div
      role={role}
      className={cardClasses}
      {...props}
    >
      {children}
    </div>
  );
});

// Display name for debugging purposes
Card.displayName = 'Card';

// Default props
Card.defaultProps = {
  variant: 'default',
  padding: 'md',
  role: 'article'
} as Partial<CardProps>;

// Export named variants and padding options for external use
export const CardVariants = {
  DEFAULT: 'default',
  ELEVATED: 'elevated',
  BORDERED: 'bordered'
} as const;

export const CardPadding = {
  NONE: 'none',
  SMALL: 'sm',
  MEDIUM: 'md',
  LARGE: 'lg'
} as const;

// Default export
export default Card;