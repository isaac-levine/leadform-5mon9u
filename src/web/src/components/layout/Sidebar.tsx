import React, { memo, useCallback, useEffect } from 'react';
import clsx from 'clsx'; // ^2.0.0
import { Navigation } from './Navigation';
import { Button } from '../shared/Button';
import { useAuth } from '../../hooks/useAuth';
import { useAnalytics } from '../../hooks/useAnalytics';
import { UserRole } from '../../types/auth';

/**
 * Interface for security violations in the sidebar
 */
interface SecurityViolation {
  type: 'SESSION' | 'ROLE' | 'PERMISSION';
  message: string;
  timestamp: Date;
}

/**
 * Enhanced props interface for Sidebar component with security features
 */
interface SidebarProps {
  isCollapsed: boolean;
  onToggle: () => void;
  className?: string;
  securityContext?: SecurityContext;
  onSecurityViolation?: (violation: SecurityViolation) => void;
}

/**
 * Enhanced sidebar component with security features and responsive behavior
 */
export const Sidebar = memo<SidebarProps>(({
  isCollapsed = false,
  onToggle,
  className = '',
  securityContext,
  onSecurityViolation
}) => {
  const { 
    user, 
    handleLogout, 
    validateSession,
    securityContext: authSecurityContext 
  } = useAuth();

  const { trackNavigation } = useAnalytics();

  /**
   * Validates current security context and user permissions
   */
  const validateSecurityContext = useCallback(async (): Promise<boolean> => {
    if (!await validateSession()) {
      onSecurityViolation?.({
        type: 'SESSION',
        message: 'Invalid session detected',
        timestamp: new Date()
      });
      return false;
    }

    if (securityContext && securityContext !== authSecurityContext) {
      onSecurityViolation?.({
        type: 'SECURITY',
        message: 'Security context mismatch',
        timestamp: new Date()
      });
      return false;
    }

    return true;
  }, [validateSession, securityContext, authSecurityContext, onSecurityViolation]);

  /**
   * Enhanced logout handler with security cleanup
   */
  const handleLogoutClick = useCallback(async () => {
    try {
      await validateSecurityContext();
      trackNavigation({
        path: '/logout',
        timestamp: new Date(),
        userId: user?.id
      });
      await handleLogout();
    } catch (error) {
      console.error('Logout error:', error);
      onSecurityViolation?.({
        type: 'SESSION',
        message: 'Logout security violation',
        timestamp: new Date()
      });
    }
  }, [handleLogout, validateSecurityContext, trackNavigation, user, onSecurityViolation]);

  // Periodic security context validation
  useEffect(() => {
    const securityCheck = setInterval(async () => {
      await validateSecurityContext();
    }, 60000); // Check every minute

    return () => clearInterval(securityCheck);
  }, [validateSecurityContext]);

  // Apply enhanced responsive classes
  const sidebarClasses = clsx(
    'flex flex-col h-screen bg-white border-r border-gray-200 transition-all duration-300',
    {
      'w-20 animate-collapse': isCollapsed,
      'w-64 animate-expand': !isCollapsed
    },
    className
  );

  return (
    <aside className={sidebarClasses} role="complementary" aria-label="Main sidebar">
      {/* Header with security indicator */}
      <div className="p-4 flex items-center justify-between border-b border-gray-200">
        <div className={clsx('flex items-center space-x-3 transition-opacity', {
          'opacity-0': isCollapsed
        })}>
          <img 
            src="/logo.svg" 
            alt="AI-SMS Platform" 
            className="h-8 w-8"
            aria-hidden={isCollapsed} 
          />
          {!isCollapsed && <span className="font-semibold text-gray-900">AI-SMS Platform</span>}
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={onToggle}
          ariaLabel={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          className="p-1"
        >
          <svg 
            className="h-5 w-5 text-gray-500"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path 
              strokeLinecap="round" 
              strokeLinejoin="round" 
              strokeWidth={2} 
              d={isCollapsed ? 'M13 5l7 7-7 7M5 5l7 7-7 7' : 'M11 19l-7-7 7-7M19 19l-7-7 7-7'} 
            />
          </svg>
        </Button>
      </div>

      {/* Main navigation with security context */}
      <div className="flex-1 overflow-y-auto scrollbar-thin">
        <Navigation />
      </div>

      {/* User profile and logout section */}
      <div className="p-4 border-t border-gray-200 bg-gray-50">
        {user && (
          <div className="flex items-center space-x-3 mb-4 p-2 rounded-lg hover:bg-gray-100">
            <div className="h-10 w-10 rounded-full bg-gray-200 border-2 border-primary-500 flex items-center justify-center">
              {user.firstName[0]}{user.lastName[0]}
            </div>
            {!isCollapsed && (
              <div className="flex flex-col">
                <span className="text-sm font-medium text-gray-900 flex items-center gap-2">
                  {user.firstName} {user.lastName}
                  {user.role === UserRole.ADMIN && (
                    <span className="text-xs font-medium text-primary-600 bg-primary-50 px-2 py-0.5 rounded-full">
                      Admin
                    </span>
                  )}
                </span>
                <span className="text-xs text-gray-500 truncate max-w-[180px]">
                  {user.email}
                </span>
              </div>
            )}
          </div>
        )}
        
        <Button
          variant="ghost"
          size="sm"
          fullWidth
          onClick={handleLogoutClick}
          className="justify-start text-left text-gray-600 hover:text-gray-900 focus:ring-2"
          ariaLabel="Logout from platform"
        >
          <svg 
            className="h-5 w-5 mr-2" 
            fill="none" 
            viewBox="0 0 24 24" 
            stroke="currentColor"
          >
            <path 
              strokeLinecap="round" 
              strokeLinejoin="round" 
              strokeWidth={2} 
              d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" 
            />
          </svg>
          {!isCollapsed && 'Logout'}
        </Button>
      </div>
    </aside>
  );
});

Sidebar.displayName = 'Sidebar';

export default Sidebar;