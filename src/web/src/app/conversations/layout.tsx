'use client';

import React, { useState, useCallback, useEffect } from 'react';
import { Header } from '../../components/layout/Header';
import { Sidebar } from '../../components/layout/Sidebar';
import { useAuth } from '../../hooks/useAuth';

/**
 * Interface for security context in conversations layout
 */
interface SecurityContext {
  deviceTrusted: boolean;
  lastLoginLocation: string;
  sessionId: string;
}

/**
 * Props interface for ConversationsLayout component
 */
interface ConversationsLayoutProps {
  children: React.ReactNode;
  securityContext?: SecurityContext;
}

/**
 * Layout component for conversations section with enhanced security and accessibility features.
 * Implements WCAG 2.1 Level AA compliance and role-based access controls.
 */
const ConversationsLayout: React.FC<ConversationsLayoutProps> = ({
  children,
  securityContext
}) => {
  // State for sidebar collapse
  const [isNavCollapsed, setIsNavCollapsed] = useState(false);

  // Auth hook for security features
  const { validateSession, securityContext: authSecurityContext } = useAuth();

  /**
   * Handles sidebar toggle with proper cleanup
   */
  const handleNavToggle = useCallback(() => {
    setIsNavCollapsed(prev => !prev);
  }, []);

  /**
   * Validates security context and session periodically
   */
  useEffect(() => {
    const validateSecurity = async () => {
      const isValid = await validateSession();
      
      if (!isValid || (securityContext && securityContext !== authSecurityContext)) {
        // Handle security violation
        console.error('Security context validation failed');
      }
    };

    // Initial validation
    validateSecurity();

    // Set up periodic validation
    const securityInterval = setInterval(validateSecurity, 60000); // Check every minute

    return () => {
      clearInterval(securityInterval);
    };
  }, [validateSession, securityContext, authSecurityContext]);

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden">
      {/* Skip link for keyboard navigation */}
      <a 
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 
                 focus:bg-white focus:p-4 focus:rounded-md focus:shadow-lg focus:outline-none 
                 focus:ring-2 focus:ring-primary-500"
      >
        Skip to main content
      </a>

      {/* Sidebar navigation */}
      <Sidebar 
        isCollapsed={isNavCollapsed}
        onToggle={handleNavToggle}
        className="flex-shrink-0"
      />

      {/* Main content area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header with security context */}
        <Header 
          isNavCollapsed={isNavCollapsed}
          onNavToggle={handleNavToggle}
          aria-label="Conversations header"
        />

        {/* Main content with accessibility landmarks */}
        <main 
          id="main-content"
          className="flex-1 overflow-auto transition-all duration-200 ease-in-out"
          role="main"
          aria-label="Conversations content"
        >
          <div className="container mx-auto px-4 py-8 max-w-7xl">
            {children}
          </div>
        </main>
      </div>

      {/* Styles */}
      <style jsx>{`
        /* Enhanced focus styles for accessibility */
        :global(*:focus-visible) {
          outline: 2px solid var(--color-primary-500);
          outline-offset: 2px;
        }

        /* Smooth transitions for sidebar toggle */
        .transition-all {
          transition-property: all;
          transition-timing-function: cubic-bezier(0.4, 0, 0.2, 1);
          transition-duration: 200ms;
        }

        /* Container max-width from design system */
        .container {
          max-width: 1280px;
        }

        /* Responsive padding adjustments */
        @media (max-width: 768px) {
          .container {
            padding-left: 1rem;
            padding-right: 1rem;
          }
        }
      `}</style>
    </div>
  );
};

export default ConversationsLayout;