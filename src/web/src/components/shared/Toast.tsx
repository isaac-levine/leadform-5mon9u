// External imports - versions specified as per requirements
import React, { useEffect, useCallback, useRef } from 'react'; // ^18.0.0
import clsx from 'clsx'; // ^2.0.0
import { AnimatePresence, motion } from 'framer-motion'; // ^10.0.0

// Type definitions
export type ToastType = 'success' | 'error' | 'warning' | 'info';
export type ToastPosition = 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left' | 'top-center' | 'bottom-center';

export interface ToastProps {
  type: ToastType;
  message: string | React.ReactNode;
  duration?: number;
  position?: ToastPosition;
  onDismiss?: () => void;
  icon?: React.ReactNode;
  disableAutoClose?: boolean;
}

// Helper function to get toast styles based on type and position
const getToastStyles = (type: ToastType, position: ToastPosition): string => {
  const baseStyles = 'fixed flex items-center gap-3 p-4 rounded-lg shadow-lg max-w-md w-full';
  
  // Type-specific styles following design system colors
  const typeStyles = {
    success: 'bg-[#10B981] text-white',
    error: 'bg-[#EF4444] text-white',
    warning: 'bg-[#F59E0B] text-white',
    info: 'bg-[#3B82F6] text-white'
  };

  // Position-specific styles
  const positionStyles = {
    'top-right': 'top-4 right-4',
    'top-left': 'top-4 left-4',
    'bottom-right': 'bottom-4 right-4',
    'bottom-left': 'bottom-4 left-4',
    'top-center': 'top-4 left-1/2 -translate-x-1/2',
    'bottom-center': 'bottom-4 left-1/2 -translate-x-1/2'
  };

  return clsx(
    baseStyles,
    typeStyles[type],
    positionStyles[position],
    'z-50',
    'sm:max-w-sm md:max-w-md'
  );
};

const Toast: React.FC<ToastProps> = ({
  type,
  message,
  duration = 5000,
  position = 'top-right',
  onDismiss,
  icon,
  disableAutoClose = false
}) => {
  const timerRef = useRef<NodeJS.Timeout>();
  const toastRef = useRef<HTMLDivElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  // Animation variants
  const toastAnimationVariants = {
    initial: { opacity: 0, y: 50, scale: 0.3 },
    animate: { opacity: 1, y: 0, scale: 1 },
    exit: { opacity: 0, scale: 0.5, transition: { duration: 0.2 } }
  };

  const handleDismiss = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }

    // Restore focus to previous element
    if (previousFocusRef.current) {
      previousFocusRef.current.focus();
    }

    onDismiss?.();
  }, [onDismiss]);

  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    if (event.key === 'Escape') {
      handleDismiss();
    }
  }, [handleDismiss]);

  useEffect(() => {
    // Store previously focused element
    previousFocusRef.current = document.activeElement as HTMLElement;
    
    // Focus the toast for accessibility
    toastRef.current?.focus();

    // Set up auto-dismiss timer if not disabled
    if (!disableAutoClose && duration > 0) {
      timerRef.current = setTimeout(handleDismiss, duration);
    }

    // Add keyboard event listener
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [duration, handleDismiss, handleKeyDown, disableAutoClose]);

  return (
    <AnimatePresence>
      <motion.div
        ref={toastRef}
        role="alert"
        aria-live="polite"
        tabIndex={0}
        className={getToastStyles(type, position)}
        initial="initial"
        animate="animate"
        exit="exit"
        variants={toastAnimationVariants}
      >
        {/* Icon section */}
        {icon && (
          <span className="flex-shrink-0" aria-hidden="true">
            {icon}
          </span>
        )}

        {/* Message content */}
        <div className="flex-1 mr-2">
          {typeof message === 'string' ? (
            <p className="text-sm font-medium">{message}</p>
          ) : (
            message
          )}
        </div>

        {/* Dismiss button */}
        <button
          type="button"
          onClick={handleDismiss}
          className="flex-shrink-0 rounded p-1 hover:bg-white/20 focus:outline-none focus:ring-2 focus:ring-white/40"
          aria-label="Dismiss notification"
        >
          <svg
            className="w-4 h-4"
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        {/* Progress bar for auto-dismiss */}
        {!disableAutoClose && duration > 0 && (
          <motion.div
            className="absolute bottom-0 left-0 h-1 bg-white/30"
            initial={{ width: '100%' }}
            animate={{ width: '0%' }}
            transition={{ duration: duration / 1000, ease: 'linear' }}
          />
        )}
      </motion.div>
    </AnimatePresence>
  );
};

export default Toast;