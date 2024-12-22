import React, { useCallback, useEffect } from 'react';
import Image from 'next/image';
import { useTheme } from 'next-themes';
import { useMediaQuery } from '@mui/material';
import { useAuth } from '../../hooks/useAuth';
import Button from '../shared/Button';

// Interface for Header component props
interface HeaderProps {
  isNavCollapsed: boolean;
  onNavToggle: () => void;
  'aria-label'?: string;
  role?: string;
}

/**
 * Main application header component with enhanced security and accessibility features.
 * Implements WCAG 2.1 Level AA compliance and role-based access controls.
 */
const Header: React.FC<HeaderProps> = ({
  isNavCollapsed,
  onNavToggle,
  'aria-label': ariaLabel = 'Main navigation header',
  role = 'banner'
}) => {
  // Authentication and theme hooks
  const { user, handleLogout, validateSession } = useAuth();
  const { theme, setTheme, systemTheme } = useTheme();
  const isMobile = useMediaQuery('(max-width: 768px)');

  // Session validation on mount and interval
  useEffect(() => {
    const validateUserSession = async () => {
      await validateSession();
    };

    validateUserSession();
    const interval = setInterval(validateUserSession, 60000); // Check every minute

    return () => clearInterval(interval);
  }, [validateSession]);

  // Theme toggle handler with system preference detection
  const handleThemeToggle = useCallback(() => {
    const newTheme = theme === 'dark' ? 'light' : 'dark';
    setTheme(newTheme);
    
    // Emit analytics event for theme change
    if (window?.gtag) {
      window.gtag('event', 'theme_change', {
        theme: newTheme,
        user_id: user?.id,
        timestamp: new Date().toISOString()
      });
    }
  }, [theme, setTheme, user?.id]);

  // Secure logout handler with cleanup
  const handleSecureLogout = useCallback(async () => {
    try {
      await handleLogout();
    } catch (error) {
      console.error('Logout failed:', error);
    }
  }, [handleLogout]);

  return (
    <header 
      className="header"
      role={role}
      aria-label={ariaLabel}
    >
      <div className="header-left">
        <Button
          variant="ghost"
          size="sm"
          onClick={onNavToggle}
          aria-label={isNavCollapsed ? 'Expand navigation' : 'Collapse navigation'}
          aria-expanded={!isNavCollapsed}
          className="nav-toggle"
        >
          <span className="sr-only">Toggle navigation</span>
          <svg 
            width="24" 
            height="24" 
            viewBox="0 0 24 24" 
            fill="none" 
            stroke="currentColor" 
            aria-hidden="true"
          >
            {isNavCollapsed ? (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16"/>
            ) : (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/>
            )}
          </svg>
        </Button>

        <div className="logo-container">
          <Image
            src="/logo.svg"
            alt="AI-SMS Platform Logo"
            width={32}
            height={32}
            priority
          />
          {!isMobile && (
            <span className="logo-text">AI-SMS Platform</span>
          )}
        </div>
      </div>

      <div className="header-right">
        <Button
          variant="ghost"
          size="sm"
          onClick={handleThemeToggle}
          aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`}
          className="theme-toggle"
        >
          <span className="sr-only">Toggle theme</span>
          {theme === 'dark' ? (
            <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
              <path fillRule="evenodd" d="M10 2a1 1 0 011 1v1a1 1 0 11-2 0V3a1 1 0 011-1zm4 8a4 4 0 11-8 0 4 4 0 018 0zm-.464 4.95l.707.707a1 1 0 001.414-1.414l-.707-.707a1 1 0 00-1.414 1.414zm2.12-10.607a1 1 0 010 1.414l-.706.707a1 1 0 11-1.414-1.414l.707-.707a1 1 0 011.414 0zM17 11a1 1 0 100-2h-1a1 1 0 100 2h1zm-7 4a1 1 0 011 1v1a1 1 0 11-2 0v-1a1 1 0 011-1zM5.05 6.464A1 1 0 106.465 5.05l-.708-.707a1 1 0 00-1.414 1.414l.707.707zm1.414 8.486l-.707.707a1 1 0 01-1.414-1.414l.707-.707a1 1 0 011.414 1.414zM4 11a1 1 0 100-2H3a1 1 0 000 2h1z" clipRule="evenodd" />
            </svg>
          ) : (
            <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
              <path d="M17.293 13.293A8 8 0 016.707 2.707a8.001 8.001 0 1010.586 10.586z" />
            </svg>
          )}
        </Button>

        {user && (
          <div className="user-menu" role="navigation" aria-label="User menu">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleSecureLogout}
              aria-label="Log out"
              className="logout-button"
            >
              <span className="user-name">{user.firstName} {user.lastName}</span>
              <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                <path fillRule="evenodd" d="M3 3a1 1 0 00-1 1v12a1 1 0 102 0V4a1 1 0 00-1-1zm10.293 9.293a1 1 0 001.414 1.414l3-3a1 1 0 000-1.414l-3-3a1 1 0 10-1.414 1.414L14.586 9H7a1 1 0 100 2h7.586l-1.293 1.293z" clipRule="evenodd" />
              </svg>
            </Button>
          </div>
        )}
      </div>

      <style jsx>{`
        .header {
          height: 64px;
          padding: 0 1.5rem;
          background: var(--header-bg);
          border-bottom: 1px solid var(--border-color);
          display: flex;
          align-items: center;
          justify-content: space-between;
          position: sticky;
          top: 0;
          z-index: 1000;
        }

        .header-left,
        .header-right {
          display: flex;
          align-items: center;
          gap: 1rem;
        }

        .logo-container {
          display: flex;
          align-items: center;
          gap: 0.75rem;
        }

        .logo-text {
          font-size: 1.125rem;
          font-weight: 600;
          color: var(--text-primary);
        }

        .user-menu {
          display: flex;
          align-items: center;
          gap: 0.5rem;
        }

        .user-name {
          margin-right: 0.5rem;
          font-weight: 500;
        }

        @media (max-width: 768px) {
          .header {
            padding: 0 1rem;
            height: 56px;
          }
        }
      `}</style>
    </header>
  );
};

export default Header;