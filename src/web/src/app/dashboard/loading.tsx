'use client';

import React from 'react'; // ^18.0.0
import Loader from '../../components/shared/Loader';
import Card from '../../components/shared/Card';

/**
 * Loading component for the dashboard page that displays skeleton loading states
 * while data is being fetched. Implements accessibility features and follows
 * Next.js 14 loading UI patterns.
 */
const DashboardLoading: React.FC = () => {
  // Check for reduced motion preference
  const prefersReducedMotion = React.useRef(
    typeof window !== 'undefined' 
      ? window.matchMedia('(prefers-reduced-motion: reduce)').matches 
      : false
  );

  // Announce loading state to screen readers
  React.useEffect(() => {
    const loadingMessage = 'Dashboard content is loading';
    const announcement = document.createElement('div');
    announcement.setAttribute('role', 'status');
    announcement.setAttribute('aria-live', 'polite');
    announcement.className = 'sr-only';
    announcement.textContent = loadingMessage;
    document.body.appendChild(announcement);

    return () => {
      document.body.removeChild(announcement);
    };
  }, []);

  return (
    <div 
      role="region" 
      aria-label="Dashboard loading state"
      className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 p-4"
    >
      {/* Metric Cards Loading States */}
      {[1, 2, 3].map((index) => (
        <Card
          key={`metric-skeleton-${index}`}
          variant="default"
          padding="lg"
          role="presentation"
          className="relative overflow-hidden"
        >
          <div 
            className={`
              h-32 
              ${!prefersReducedMotion.current ? 'animate-pulse' : ''} 
              bg-gray-200 dark:bg-gray-700 
              rounded 
              will-change-transform
              transition-all duration-300 ease-in-out
            `}
            aria-hidden="true"
          />
        </Card>
      ))}

      {/* Chart Cards Loading States */}
      {[1, 2].map((index) => (
        <Card
          key={`chart-skeleton-${index}`}
          variant="default"
          padding="lg"
          role="presentation"
          className="relative overflow-hidden lg:col-span-2"
        >
          <div 
            className={`
              h-64
              ${!prefersReducedMotion.current ? 'animate-pulse' : ''} 
              bg-gray-200 dark:bg-gray-700 
              rounded 
              will-change-transform
              transition-all duration-300 ease-in-out
            `}
            aria-hidden="true"
          />
        </Card>
      ))}

      {/* Center loading spinner */}
      <div className="fixed bottom-4 right-4">
        <Loader 
          size="md"
          center
          aria-label="Loading dashboard content"
          className="text-primary-500"
        />
      </div>

      {/* Reduced motion styles */}
      <style jsx global>{`
        @media (prefers-reduced-motion: reduce) {
          .animate-pulse {
            animation: none !important;
          }
        }
      `}</style>
    </div>
  );
};

DashboardLoading.displayName = 'DashboardLoading';

export default DashboardLoading;