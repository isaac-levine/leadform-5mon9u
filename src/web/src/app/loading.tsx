'use client';

import React from 'react'; // ^18.0.0
import Loader from '../components/shared/Loader';

/**
 * Loading component for Next.js 14 route transitions and data fetching operations.
 * Provides an optimized, accessible full-page loading state following design system specifications.
 * 
 * Performance optimizations:
 * - CSS containment for layout and paint operations
 * - will-change property for animation optimization
 * - content-visibility for rendering performance
 * - Optimized animation properties
 * 
 * Accessibility:
 * - WCAG 2.1 Level AA compliant
 * - Proper ARIA labels and roles
 * - Screen reader support
 * 
 * @returns {JSX.Element} Rendered loading component
 */
export default function Loading(): JSX.Element {
  // Optimize performance with layout effect
  React.useLayoutEffect(() => {
    // Add performance class to body to prevent scrolling during loading
    document.body.classList.add('overflow-hidden');
    
    return () => {
      document.body.classList.remove('overflow-hidden');
    };
  }, []);

  return (
    <div
      className="
        min-h-screen flex items-center justify-center
        p-4 sm:p-6 md:p-8
        bg-white dark:bg-gray-900
        transition-opacity duration-300 ease-in-out
      "
      style={{
        contain: 'layout paint',
        willChange: 'opacity',
        contentVisibility: 'auto'
      }}
      role="status"
      aria-live="polite"
      aria-label="Loading page content"
      data-testid="page-loading"
    >
      <div
        className="
          transform-gpu
          animate-fade-in
          duration-300
          ease-in-out
        "
      >
        <Loader
          size="lg"
          color="primary"
          center
          ariaLabel="Loading page content"
          className="
            w-12 h-12 sm:w-16 sm:h-16
            text-primary-600 dark:text-primary-400
          "
        />
      </div>
    </div>
  );
}

/**
 * Error boundary fallback for loading component failures
 */
Loading.fallback = function LoadingFallback() {
  return (
    <div
      className="min-h-screen flex items-center justify-center"
      role="status"
      aria-live="polite"
    >
      <div className="animate-pulse">
        <div className="w-12 h-12 rounded-full bg-gray-200 dark:bg-gray-700" />
      </div>
    </div>
  );
};