import React from 'react'; // ^18.0.0
import clsx from 'clsx'; // ^2.0.0

/**
 * Props interface for the Badge component with comprehensive typing
 */
interface BadgeProps {
  /** Content to be displayed inside the badge */
  children: React.ReactNode;
  /** Color variant matching design system tokens */
  variant?: 'success' | 'primary' | 'error' | 'neutral';
  /** Size variant following design system spacing scale */
  size?: 'sm' | 'md' | 'lg';
  /** Additional CSS classes for custom styling */
  className?: string;
}

/**
 * Generates optimized Tailwind classes for badge variants with proper color contrast
 * @param variant - The badge variant type
 * @returns Optimized Tailwind CSS classes for variant styling
 */
const getVariantClasses = (variant: BadgeProps['variant'] = 'neutral'): string => {
  const variantClasses = {
    success: 'bg-[#10B981] text-white hover:bg-[#059669]',
    primary: 'bg-[#2563EB] text-white hover:bg-[#1D4ED8]',
    error: 'bg-[#EF4444] text-white hover:bg-[#DC2626]',
    neutral: 'bg-[#1F2937] text-white hover:bg-[#111827]',
  };

  return variantClasses[variant];
};

/**
 * Generates responsive Tailwind classes for badge sizes following design system
 * @param size - The badge size variant
 * @returns Responsive Tailwind CSS classes for size styling
 */
const getSizeClasses = (size: BadgeProps['size'] = 'md'): string => {
  const sizeClasses = {
    sm: 'px-2 py-1 text-xs leading-4',
    md: 'px-3 py-1.5 text-sm leading-5',
    lg: 'px-4 py-2 text-base leading-6',
  };

  return sizeClasses[size];
};

/**
 * Badge component - A highly reusable, accessible badge element with comprehensive styling options
 * 
 * @component
 * @example
 * ```tsx
 * <Badge variant="success" size="md">New</Badge>
 * ```
 */
export const Badge: React.FC<BadgeProps> = ({
  children,
  variant = 'neutral',
  size = 'md',
  className,
}) => {
  return (
    <span
      className={clsx(
        // Base styles
        'inline-flex items-center rounded-full font-medium transition-all duration-150 ease-in-out whitespace-nowrap',
        // Variant-specific styles
        getVariantClasses(variant),
        // Size-specific styles
        getSizeClasses(size),
        // Custom classes
        className
      )}
      role="status"
      aria-label={typeof children === 'string' ? children : undefined}
    >
      {children}
    </span>
  );
};

/**
 * Default export for convenient importing
 */
export default Badge;

/**
 * Named exports for granular usage
 */
export type { BadgeProps };