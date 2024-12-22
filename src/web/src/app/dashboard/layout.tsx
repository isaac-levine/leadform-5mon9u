'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { useMediaQuery } from '@mui/material';
import { ErrorBoundary } from '@sentry/react'; // ^7.0.0
import Header from '../../components/layout/Header';
import Sidebar from '../../components/layout/Sidebar';
import { useAuth } from '../../hooks/useAuth';
import { UserRole } from '../../types/auth';

// Interface for security context tracking
interface SecurityContext {
  deviceTrusted: boolean;
  lastLoginLocation: string;
  sessionId: string;
  methodUsed?: string;
  verifiedAt?: Date;
}

// Props interface with security and validation requirements
interface DashboardLayoutProps {
  children: React.ReactNode;
  securityContext?: SecurityContext;
  userRole?: UserRole;
}

/**
 * Error fallback component for layout failures
 */
const LayoutErrorFallback = () => (
  <div className="min-h-screen flex items-center justify-center bg-gray-50">
    <div className="text-center">
      <h2 className="text-xl font-semibold text-gray-900">Dashboard Layout Error</h2>
      <p className="mt-2 text-gray-600">Please try refreshing the page or contact support.</p>
    </div>
  </div>
);

/**
 * Main dashboard layout component with enhanced security and performance features.
 * Implements responsive design, security validation, and performance monitoring.
 */
const DashboardLayout: React.FC<DashboardLayoutProps> = ({
  children,
  securityContext,
  userRole
}) => {
  // State for sidebar collapse and performance monitoring
  const [isNavCollapsed, setIsNavCollapsed] = useState(false);
  const [lastRenderTime, setLastRenderTime] = useState<number>(0);

  // Hooks for responsive behavior and authentication
  const isMobile = useMediaQuery('(max-width: 768px)');
  const { validateSession, user, securityContext: authContext } = useAuth();

  /**
   * Security context validation with performance tracking
   */
  const validateSecurityContext = useCallback(async (): Promise<boolean> => {
    const startTime = performance.now();

    try {
      // Validate session and security context
      const isSessionValid = await validateSession();
      const isContextValid = securityContext?.sessionId === authContext?.sessionId;

      // Track validation performance
      const validationTime = performance.now() - startTime;
      if (validationTime > 100) {
        console.warn('Security validation performance degraded:', validationTime);
      }

      return isSessionValid && isContextValid;
    } catch (error) {
      console.error('Security validation failed:', error);
      return false;
    }
  }, [validateSession, securityContext, authContext]);

  /**
   * Handle sidebar toggle with performance monitoring
   */
  const handleNavToggle = useCallback(() => {
    const toggleStart = performance.now();
    
    setIsNavCollapsed(prev => !prev);
    
    // Monitor toggle performance
    const toggleDuration = performance.now() - toggleStart;
    if (toggleDuration > 16.67) { // 60fps threshold
      console.warn('Navigation toggle performance degraded:', toggleDuration);
    }
  }, []);

  /**
   * Effect for security validation and mobile responsiveness
   */
  useEffect(() => {
    // Initial security validation
    validateSecurityContext();

    // Set initial collapse state for mobile
    setIsNavCollapsed(isMobile);

    // Monitor memory usage
    const memoryInterval = setInterval(() => {
      if (performance?.memory) {
        const { usedJSHeapSize, jsHeapSizeLimit } = performance.memory;
        const memoryUsage = (usedJSHeapSize / jsHeapSizeLimit) * 100;
        
        if (memoryUsage > 80) {
          console.warn('High memory usage detected:', memoryUsage.toFixed(2) + '%');
        }
      }
    }, 30000);

    return () => {
      clearInterval(memoryInterval);
    };
  }, [isMobile, validateSecurityContext]);

  /**
   * Performance monitoring for renders
   */
  useEffect(() => {
    const renderTime = performance.now() - lastRenderTime;
    setLastRenderTime(performance.now());

    if (renderTime > 16.67) { // 60fps threshold
      console.warn('Layout render time exceeded frame budget:', renderTime);
    }
  });

  return (
    <ErrorBoundary fallback={<LayoutErrorFallback />}>
      <div className="min-h-screen bg-gray-50">
        <Header 
          isNavCollapsed={isNavCollapsed}
          onNavToggle={handleNavToggle}
          validateSecurityContext={validateSecurityContext}
        />
        
        <div className="flex h-[calc(100vh-64px)]">
          <Sidebar
            isCollapsed={isNavCollapsed}
            onToggle={handleNavToggle}
            securityContext={securityContext}
          />
          
          <main 
            className={`
              flex-1 overflow-auto transition-all duration-300 ease-in-out
              ${isNavCollapsed ? 'ml-20' : 'ml-64'}
              p-6 max-w-[1280px] mx-auto w-full
            `}
            role="main"
            aria-label="Main content"
          >
            {children}
          </main>
        </div>
      </div>

      <style jsx>{`
        /* Performance optimizations */
        .min-h-screen {
          contain: layout size;
          content-visibility: auto;
        }
        
        /* Smooth transitions */
        .transition-all {
          will-change: transform;
          transform: translateZ(0);
        }
        
        /* Memory optimizations */
        main {
          contain: content;
          isolation: isolate;
        }
      `}</style>
    </ErrorBoundary>
  );
};

export default DashboardLayout;