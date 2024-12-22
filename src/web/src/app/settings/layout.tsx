'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Header from '../../components/layout/Header';
import Sidebar from '../../components/layout/Sidebar';
import { useAuth } from '../../hooks/useAuth';
import { UserRole } from '../../types/auth';

// Props interface for settings layout
interface SettingsLayoutProps {
  children: React.ReactNode;
  requiredRole?: UserRole[];
}

/**
 * Enhanced layout component for settings pages with security and accessibility features.
 * Implements WCAG 2.1 Level AA compliance and role-based access control.
 */
const SettingsLayout: React.FC<SettingsLayoutProps> = ({
  children,
  requiredRole = [UserRole.ADMIN]
}) => {
  // State and hooks
  const [isNavCollapsed, setIsNavCollapsed] = useState(false);
  const [isAccessible, setIsAccessible] = useState(false);
  const router = useRouter();
  const { user, validateSession, hasRole } = useAuth();

  /**
   * Enhanced security validation for settings access
   */
  const validateAccess = useCallback(async () => {
    // Validate active session
    const isSessionValid = await validateSession();
    if (!isSessionValid) {
      router.push('/auth/login?redirect=/settings');
      return false;
    }

    // Validate role-based access
    const hasRequiredRole = requiredRole.some(role => hasRole(role));
    if (!hasRequiredRole) {
      router.push('/dashboard');
      return false;
    }

    return true;
  }, [validateSession, hasRole, requiredRole, router]);

  /**
   * Enhanced sidebar toggle with accessibility announcements
   */
  const handleSidebarToggle = useCallback(() => {
    setIsNavCollapsed(prev => {
      const newState = !prev;
      
      // Announce state change to screen readers
      const announcement = document.getElementById('nav-announcement');
      if (announcement) {
        announcement.textContent = `Navigation ${newState ? 'collapsed' : 'expanded'}`;
      }

      // Persist preference
      localStorage.setItem('settings-nav-collapsed', String(newState));
      
      return newState;
    });
  }, []);

  // Initial setup and security validation
  useEffect(() => {
    const initializeLayout = async () => {
      // Validate access rights
      const hasAccess = await validateAccess();
      setIsAccessible(hasAccess);

      // Restore navigation state
      const savedState = localStorage.getItem('settings-nav-collapsed');
      if (savedState !== null) {
        setIsNavCollapsed(savedState === 'true');
      }
    };

    initializeLayout();
  }, [validateAccess]);

  // Security check interval
  useEffect(() => {
    const securityInterval = setInterval(async () => {
      const hasAccess = await validateAccess();
      if (!hasAccess) {
        setIsAccessible(false);
      }
    }, 60000); // Check every minute

    return () => clearInterval(securityInterval);
  }, [validateAccess]);

  // Handle unauthorized access
  if (!isAccessible || !user) {
    return null; // Router will handle redirect
  }

  return (
    <div className="min-h-screen bg-gray-50 relative">
      {/* Skip link for keyboard navigation */}
      <a 
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 focus:px-4 focus:py-2 focus:bg-white focus:ring-2 focus:ring-primary-500"
      >
        Skip to main content
      </a>

      {/* Screen reader announcements */}
      <div 
        id="nav-announcement" 
        role="status" 
        aria-live="polite" 
        className="sr-only"
      />

      {/* Enhanced header with security context */}
      <Header
        isNavCollapsed={isNavCollapsed}
        onNavToggle={handleSidebarToggle}
        aria-label="Settings header"
      />

      <div className="flex h-[calc(100vh-64px)] relative">
        {/* Enhanced sidebar with role-based access */}
        <Sidebar
          isCollapsed={isNavCollapsed}
          onToggle={handleSidebarToggle}
          className="h-full"
        />

        {/* Main content area with accessibility features */}
        <main
          id="main-content"
          className={`
            flex-1 overflow-y-auto p-6 focus-visible:outline-none
            ${isNavCollapsed ? 'ml-20' : 'ml-64'}
            transition-all duration-200
          `}
          tabIndex={-1}
          role="main"
          aria-label="Settings content"
        >
          {children}
        </main>
      </div>
    </div>
  );
};

export default SettingsLayout;