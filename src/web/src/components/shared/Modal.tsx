import React, { memo, useCallback, useEffect } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import clsx from 'clsx';
import Button from './Button';

// Types
interface ModalAction {
  label: string;
  onClick: () => void;
  variant?: ButtonProps['variant'];
  loading?: boolean;
}

export interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  description?: string | React.ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  children?: React.ReactNode;
  className?: string;
  showCloseButton?: boolean;
  closeOnOverlayClick?: boolean;
  preventClose?: boolean;
  onBeforeClose?: () => Promise<boolean>;
  animationDuration?: number;
  animationVariant?: 'fade' | 'slide' | 'scale';
  primaryAction?: ModalAction;
  secondaryAction?: ModalAction;
}

// Utility function to generate modal classes
const getModalClasses = (
  size: ModalProps['size'] = 'md',
  className?: string,
  theme: 'light' | 'dark' = 'light',
  dir: 'ltr' | 'rtl' = 'ltr'
): string => {
  const baseStyles = {
    modal: 'fixed inset-0 z-50 overflow-y-auto',
    overlay: {
      light: 'fixed inset-0 bg-black bg-opacity-25 transition-opacity',
      dark: 'fixed inset-0 bg-white bg-opacity-10 transition-opacity'
    },
    dialog: 'min-h-screen px-4 text-center flex items-center justify-center',
    panel: {
      light: 'w-full transform overflow-hidden rounded-lg bg-white p-6 text-left align-middle shadow-xl transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500',
      dark: 'w-full transform overflow-hidden rounded-lg bg-neutral-800 p-6 text-left align-middle shadow-xl transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-400'
    },
    sizes: {
      sm: 'max-w-sm',
      md: 'max-w-md',
      lg: 'max-w-lg',
      xl: 'max-w-xl'
    }
  };

  return clsx(
    baseStyles.panel[theme],
    baseStyles.sizes[size],
    dir === 'rtl' && 'rtl',
    className
  );
};

/**
 * Enhanced Modal component with advanced features and accessibility support.
 * Implements WCAG 2.1 Level AA compliance and design system specifications.
 */
export const Modal = memo<ModalProps>(({
  isOpen,
  onClose,
  title,
  description,
  size = 'md',
  children,
  className,
  showCloseButton = true,
  closeOnOverlayClick = true,
  preventClose = false,
  onBeforeClose,
  animationDuration = 200,
  animationVariant = 'fade',
  primaryAction,
  secondaryAction
}) => {
  // Handle close with prevention and callbacks
  const handleClose = useCallback(async () => {
    if (preventClose) return;
    
    if (onBeforeClose) {
      const canClose = await onBeforeClose();
      if (!canClose) return;
    }
    
    onClose();
  }, [onClose, preventClose, onBeforeClose]);

  // Handle escape key
  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !preventClose) {
        handleClose();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      return () => document.removeEventListener('keydown', handleEscape);
    }
  }, [isOpen, handleClose, preventClose]);

  // Animation variants
  const getAnimationProps = () => {
    const base = {
      enter: `transition-all duration-${animationDuration}`,
      enterFrom: '',
      enterTo: '',
      leave: `transition-all duration-${animationDuration}`,
      leaveFrom: '',
      leaveTo: ''
    };

    switch (animationVariant) {
      case 'slide':
        return {
          ...base,
          enterFrom: 'translate-y-4 opacity-0',
          enterTo: 'translate-y-0 opacity-100',
          leaveFrom: 'translate-y-0 opacity-100',
          leaveTo: 'translate-y-4 opacity-0'
        };
      case 'scale':
        return {
          ...base,
          enterFrom: 'scale-95 opacity-0',
          enterTo: 'scale-100 opacity-100',
          leaveFrom: 'scale-100 opacity-100',
          leaveTo: 'scale-95 opacity-0'
        };
      default: // fade
        return {
          ...base,
          enterFrom: 'opacity-0',
          enterTo: 'opacity-100',
          leaveFrom: 'opacity-100',
          leaveTo: 'opacity-0'
        };
    }
  };

  return (
    <Transition show={isOpen} as={React.Fragment} {...getAnimationProps()}>
      <Dialog
        as="div"
        className="fixed inset-0 z-50 overflow-y-auto"
        onClose={closeOnOverlayClick ? handleClose : () => {}}
        static
      >
        <div className="min-h-screen px-4 text-center flex items-center justify-center">
          {/* Overlay */}
          <Transition.Child
            as={React.Fragment}
            enter="transition-opacity ease-out duration-300"
            enterFrom="opacity-0"
            enterTo="opacity-100"
            leave="transition-opacity ease-in duration-200"
            leaveFrom="opacity-100"
            leaveTo="opacity-0"
          >
            <Dialog.Overlay className="fixed inset-0 bg-black bg-opacity-25" />
          </Transition.Child>

          {/* Modal Content */}
          <Transition.Child
            as={React.Fragment}
            {...getAnimationProps()}
          >
            <div className={getModalClasses(size, className)}>
              {/* Close Button */}
              {showCloseButton && !preventClose && (
                <button
                  className="absolute top-4 right-4 rtl:left-4 rtl:right-auto text-neutral-400 hover:text-neutral-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
                  onClick={handleClose}
                  aria-label="Close modal"
                >
                  <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}

              {/* Title */}
              <Dialog.Title
                as="h3"
                className="text-lg font-medium leading-6 text-neutral-900 dark:text-white"
              >
                {title}
              </Dialog.Title>

              {/* Description */}
              {description && (
                <Dialog.Description className="mt-2 text-sm text-neutral-500 dark:text-neutral-400">
                  {description}
                </Dialog.Description>
              )}

              {/* Content */}
              <div className="mt-4">
                {children}
              </div>

              {/* Actions */}
              {(primaryAction || secondaryAction) && (
                <div className="mt-4 flex justify-end space-x-3 rtl:space-x-reverse">
                  {secondaryAction && (
                    <Button
                      variant="ghost"
                      onClick={secondaryAction.onClick}
                      isLoading={secondaryAction.loading}
                    >
                      {secondaryAction.label}
                    </Button>
                  )}
                  {primaryAction && (
                    <Button
                      variant={primaryAction.variant || 'primary'}
                      onClick={primaryAction.onClick}
                      isLoading={primaryAction.loading}
                    >
                      {primaryAction.label}
                    </Button>
                  )}
                </div>
              )}
            </div>
          </Transition.Child>
        </div>
      </Dialog>
    </Transition>
  );
});

Modal.displayName = 'Modal';

export default Modal;