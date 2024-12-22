'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { redirect } from 'next/navigation';
import { Header } from '../../components/layout/Header';
import { Sidebar } from '../../components/layout/Sidebar';
import { useAuth } from '../../hooks/useAuth';
import { UserPermission } from '../../types/auth';

/**
 * Interface for security violations in analytics
 */
interface SecurityViolation {
  type: 'SESSION' | 'ROLE' | 'PERMISSION';
  message: string;
  timestamp: Date;
}

/**
 * Interface for analytics layout props with security context
 */
interface AnalyticsLayoutProps {
  children: React.ReactNode;
  securityContext?: SecurityContext;
}

/**
 * Analytics layout component with enhanced security features and responsive design
 * Implements WCAG 2.1 Level AA compliance and role-based access control
 */
const AnalyticsLayout: React.FC<AnalyticsLayoutProps> = ({ 
  children,
  securityContext 
}) => {
  // Authentication and security hooks
  const { 
    user,
    hasPermission,
    validateSession,
    securityContext: authSecurityContext
  } = useAuth();

  // State for sidebar collapse and security monitoring
  const [isNavCollapsed, setIsNavCollapsed] = useState(false);
  const [securityViolations, setSecurityViolations] = useState<SecurityViolation[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  /**
   * Handles security violations with logging and user feedback
   */
  const handleSecurityViolation = useCallback((violation: SecurityViolation) => {
    setSecurityViolations(prev => [...prev, violation]);
    
    // Log security violation for monitoring
    console.error('Security violation:', {
      ...violation,
      userId: user?.id,
      path: '/analytics'
    });
  }, [user?.id]);

  /**
   * Validates security context and user permissions
   */
  const validateSecurityContext = useCallback(async (): Promise<boolean> => {
    // Validate user session
    if (!await validateSession()) {
      handleSecurityViolation({
        type: 'SESSION',
        message: 'Invalid session detected',
        timestamp: new Date()
      });
      return false;
    }

    // Validate security context
    if (securityContext && securityContext !== authSecurityContext) {
      handleSecurityViolation({
        type: 'SECURITY',
        message: 'Security context mismatch',
        timestamp: new Date()
      });
      return false;
    }

    // Validate analytics permission
    if (!hasPermission(UserPermission.VIEW_ANALYTICS)) {
      handleSecurityViolation({
        type: 'PERMISSION',
        message: 'Insufficient analytics permissions',
        timestamp: new Date()
      });
      return false;
    }

    return true;
  }, [validateSession, securityContext, authSecurityContext, hasPermission, handleSecurityViolation]);

  /**
   * Handle sidebar toggle with state persistence
   */
  const handleNavToggle = useCallback(() => {
    setIsNavCollapsed(prev => {
      // Persist preference in localStorage
      localStorage.setItem('analytics-nav-collapsed', String(!prev));
      return !prev;
    });
  }, []);

  // Initial security validation and setup
  useEffect(() => {
    const initializeLayout = async () => {
      setIsLoading(true);
      
      try {
        const isValid = await validateSecurityContext();
        if (!isValid) {
          redirect('/dashboard');
        }

        // Restore sidebar state preference
        const savedCollapsed = localStorage.getItem('analytics-nav-collapsed');
        if (savedCollapsed !== null) {
          setIsNavCollapsed(savedCollapsed === 'true');
        }
      } catch (error) {
        console.error('Layout initialization error:', error);
        redirect('/dashboard');
      } finally {
        setIsLoading(false);
      }
    };

    initializeLayout();
  }, [validateSecurityContext]);

  // Periodic security validation
  useEffect(() => {
    const securityCheck = setInterval(async () => {
      const isValid = await validateSecurityContext();
      if (!isValid) {
        redirect('/dashboard');
      }
    }, 60000); // Check every minute

    return () => clearInterval(securityCheck);
  }, [validateSecurityContext]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary-600" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Header 
        isNavCollapsed={isNavCollapsed}
        onNavToggle={handleNavToggle}
        aria-label="Analytics header"
      />
      
      <div className="flex h-screen overflow-hidden pt-16">
        <Sidebar
          isCollapsed={isNavCollapsed}
          onToggle={handleNavToggle}
          securityContext={securityContext}
          onSecurityViolation={handleSecurityViolation}
          className="flex-shrink-0"
        />
        
        <main 
          className="flex-1 overflow-x-hidden overflow-y-auto bg-gray-50 relative"
          role="main"
          aria-label="Analytics content"
        >
          <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-8">
            {/* Error boundary for security violations */}
            {securityViolations.length > 0 && (
              <div 
                className="mb-4 p-4 border border-red-500 rounded-md bg-red-50"
                role="alert"
              >
                <h2 className="text-red-700 font-medium">Security Alert</h2>
                <p className="text-red-600">
                  A security violation has been detected. Please refresh the page or contact support.
                </p>
              </div>
            )}
            
            {children}
          </div>
        </main>
      </div>
    </div>
  );
};

export default AnalyticsLayout;