import React from 'react'; // ^18.0.0
import clsx from 'clsx'; // ^2.0.0

// Define size options for the loader component
type LoaderSize = 'sm' | 'md' | 'lg';

// Component props interface with comprehensive documentation
interface LoaderProps {
  /**
   * Size variant of the loader
   * @default 'md'
   */
  size?: LoaderSize;
  
  /**
   * Additional CSS classes to apply to the loader
   */
  className?: string;
  
  /**
   * Custom color for the loader - accepts design system tokens or hex values
   * @default 'primary'
   */
  color?: string;
  
  /**
   * Whether to center the loader in its container
   * @default false
   */
  center?: boolean;
  
  /**
   * Accessible label for screen readers
   * @default 'Loading'
   */
  ariaLabel?: string;
}

/**
 * Maps size prop to appropriate Tailwind classes for responsive behavior
 */
const getLoaderSize = (size: LoaderSize = 'md'): string => {
  const sizes = {
    sm: 'w-4 h-4 border-2',
    md: 'w-8 h-8 border-3',
    lg: 'w-12 h-12 border-4'
  };
  
  return sizes[size] || sizes.md;
};

/**
 * Processes color prop to return appropriate CSS color value
 */
const getLoaderColor = (color: string = 'primary'): string => {
  // Design system color tokens
  const colorTokens = {
    primary: '#2563EB',
    secondary: '#3B82F6',
    success: '#10B981',
    error: '#EF4444'
  };

  // Return color token if it exists, otherwise return the provided color
  return colorTokens[color] || color;
};

/**
 * Loader component that provides visual feedback for loading states
 * with accessibility and performance optimizations.
 */
const Loader: React.FC<LoaderProps> = ({
  size = 'md',
  className,
  color = 'primary',
  center = false,
  ariaLabel = 'Loading'
}) => {
  // Optimize animation performance
  React.useEffect(() => {
    const loader = document.querySelector('.loader-spinner');
    if (loader) {
      loader.style.willChange = 'transform';
    }

    return () => {
      if (loader) {
        loader.style.willChange = 'auto';
      }
    };
  }, []);

  // Process the loader color
  const borderColor = getLoaderColor(color);
  
  // Combine all classes
  const loaderClasses = clsx(
    'loader-spinner',
    'rounded-full',
    'border-solid',
    'animate-spin',
    getLoaderSize(size),
    {
      'mx-auto': center,
      'border-t-transparent': true,
      'border-l-transparent': true,
    },
    className
  );

  // Apply container classes if centered
  const containerClasses = clsx(
    'inline-block',
    {
      'flex items-center justify-center w-full': center
    }
  );

  return (
    <div className={containerClasses}>
      <div
        className={loaderClasses}
        style={{
          borderColor: `${borderColor}`,
          borderTopColor: 'transparent',
          borderLeftColor: 'transparent'
        }}
        role="status"
        aria-label={ariaLabel}
        data-testid="loader"
      >
        {/* Hidden text for screen readers */}
        <span className="sr-only">{ariaLabel}</span>
      </div>
    </div>
  );
};

// Add display name for debugging
Loader.displayName = 'Loader';

export default Loader;