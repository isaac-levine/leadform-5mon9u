import React, { memo, useCallback } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '../../hooks/useAuth';
import { useAnalytics } from '../../hooks/useAnalytics';
import { Button } from '../shared/Button';
import { UserRole, UserPermission } from '../../types/auth';

/**
 * Interface for navigation menu items with security and accessibility properties
 */
interface NavigationItem {
  path: string;
  label: string;
  icon: React.ReactNode;
  requiredRole: UserRole | null;
  requiredPermission: UserPermission | null;
  ariaLabel: string;
  testId: string;
}

/**
 * Navigation items configuration with role-based access control
 */
const NAVIGATION_ITEMS: NavigationItem[] = [
  {
    path: '/dashboard',
    label: 'Dashboard',
    icon: <DashboardIcon className="h-5 w-5" />,
    requiredRole: null,
    requiredPermission: null,
    ariaLabel: 'Navigate to Dashboard',
    testId: 'nav-dashboard'
  },
  {
    path: '/conversations',
    label: 'Conversations',
    icon: <ChatIcon className="h-5 w-5" />,
    requiredRole: null,
    requiredPermission: UserPermission.VIEW_CONVERSATIONS,
    ariaLabel: 'Navigate to Conversations',
    testId: 'nav-conversations'
  },
  {
    path: '/forms',
    label: 'Forms',
    icon: <FormIcon className="h-5 w-5" />,
    requiredRole: null,
    requiredPermission: UserPermission.MANAGE_FORMS,
    ariaLabel: 'Navigate to Forms',
    testId: 'nav-forms'
  },
  {
    path: '/analytics',
    label: 'Analytics',
    icon: <AnalyticsIcon className="h-5 w-5" />,
    requiredRole: null,
    requiredPermission: UserPermission.VIEW_ANALYTICS,
    ariaLabel: 'Navigate to Analytics',
    testId: 'nav-analytics'
  },
  {
    path: '/settings',
    label: 'Settings',
    icon: <SettingsIcon className="h-5 w-5" />,
    requiredRole: UserRole.ADMIN,
    requiredPermission: null,
    ariaLabel: 'Navigate to Settings',
    testId: 'nav-settings'
  }
];

/**
 * Determines if a navigation item is currently active
 */
const isActiveLink = (path: string, currentPath: string): boolean => {
  // Normalize paths
  const normalizedPath = path.endsWith('/') ? path.slice(0, -1) : path;
  const normalizedCurrentPath = currentPath.endsWith('/') ? currentPath.slice(0, -1) : currentPath;

  // Check exact match or if current path is a child of navigation path
  return normalizedCurrentPath === normalizedPath || 
         (normalizedPath !== '/' && normalizedCurrentPath.startsWith(normalizedPath));
};

/**
 * Validates user access to navigation items with security context
 */
const validateNavigationAccess = (
  item: NavigationItem,
  user: User | null,
  hasRole: (role: UserRole) => boolean,
  hasPermission: (permission: UserPermission) => boolean
): boolean => {
  if (!user) return false;

  // Check role-based access
  if (item.requiredRole && !hasRole(item.requiredRole)) {
    return false;
  }

  // Check permission-based access
  if (item.requiredPermission && !hasPermission(item.requiredPermission)) {
    return false;
  }

  return true;
};

/**
 * Enhanced main navigation component with security and accessibility features
 */
export const Navigation = memo(() => {
  const pathname = usePathname();
  const { user, hasRole, hasPermission, validateSession } = useAuth();
  const { trackNavigation } = useAnalytics();

  /**
   * Handles navigation click with analytics tracking
   */
  const handleNavigationClick = useCallback((path: string) => {
    trackNavigation({
      path,
      timestamp: new Date(),
      userId: user?.id
    });
  }, [user, trackNavigation]);

  // Filter navigation items based on user access
  const accessibleItems = NAVIGATION_ITEMS.filter(item => 
    validateNavigationAccess(item, user, hasRole, hasPermission)
  );

  return (
    <nav
      className="flex flex-col space-y-1 p-2"
      role="navigation"
      aria-label="Main navigation"
    >
      {accessibleItems.map((item) => {
        const isActive = isActiveLink(item.path, pathname);
        
        return (
          <Link
            key={item.path}
            href={item.path}
            onClick={() => handleNavigationClick(item.path)}
            className={`
              flex items-center px-3 py-2 text-sm font-medium rounded-md
              transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500
              ${isActive 
                ? 'bg-primary-100 text-primary-900' 
                : 'text-gray-600 hover:bg-gray-100'
              }
            `}
            aria-current={isActive ? 'page' : undefined}
            aria-label={item.ariaLabel}
            data-testid={item.testId}
          >
            <span className="mr-3 text-gray-400" aria-hidden="true">
              {item.icon}
            </span>
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
});

Navigation.displayName = 'Navigation';

// SVG Icons Components (simplified for brevity)
const DashboardIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} viewBox="0 0 20 20" fill="currentColor">
    <path d="M3 4a1 1 0 011-1h12a1 1 0 011 1v2a1 1 0 01-1 1H4a1 1 0 01-1-1V4zM3 10a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H4a1 1 0 01-1-1v-6zM14 9a1 1 0 00-1 1v6a1 1 0 001 1h2a1 1 0 001-1v-6a1 1 0 00-1-1h-2z" />
  </svg>
);

const ChatIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} viewBox="0 0 20 20" fill="currentColor">
    <path fillRule="evenodd" d="M18 10c0 3.866-3.582 7-8 7a8.841 8.841 0 01-4.083-.98L2 17l1.338-3.123C2.493 12.767 2 11.434 2 10c0-3.866 3.582-7 8-7s8 3.134 8 7zM7 9H5v2h2V9zm8 0h-2v2h2V9zM9 9h2v2H9V9z" clipRule="evenodd" />
  </svg>
);

const FormIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} viewBox="0 0 20 20" fill="currentColor">
    <path d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" />
  </svg>
);

const AnalyticsIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} viewBox="0 0 20 20" fill="currentColor">
    <path d="M2 11a1 1 0 011-1h2a1 1 0 011 1v5a1 1 0 01-1 1H3a1 1 0 01-1-1v-5zM8 7a1 1 0 011-1h2a1 1 0 011 1v9a1 1 0 01-1 1H9a1 1 0 01-1-1V7zM14 4a1 1 0 011-1h2a1 1 0 011 1v12a1 1 0 01-1 1h-2a1 1 0 01-1-1V4z" />
  </svg>
);

const SettingsIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} viewBox="0 0 20 20" fill="currentColor">
    <path fillRule="evenodd" d="M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0a1.532 1.532 0 01-2.286.948c-1.372-.836-2.942.734-2.106 2.106.54.886.061 2.042-.947 2.287-1.561.379-1.561 2.6 0 2.978a1.532 1.532 0 01.947 2.287c-.836 1.372.734 2.942 2.106 2.106a1.532 1.532 0 012.287.947c.379 1.561 2.6 1.561 2.978 0a1.533 1.533 0 012.287-.947c1.372.836 2.942-.734 2.106-2.106a1.533 1.533 0 01.947-2.287c1.561-.379 1.561-2.6 0-2.978a1.532 1.532 0 01-.947-2.287c.836-1.372-.734-2.942-2.106-2.106a1.532 1.532 0 01-2.287-.947zM10 13a3 3 0 100-6 3 3 0 000 6z" clipRule="evenodd" />
  </svg>
);

export default Navigation;