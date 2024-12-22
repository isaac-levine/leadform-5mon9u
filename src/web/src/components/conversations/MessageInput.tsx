import React, { useState, useCallback, useEffect } from 'react';
import classNames from 'classnames'; // ^2.3.2
import { useDebounce } from 'use-debounce'; // ^9.0.0

// Internal imports
import { Message, MessageDirection } from '../../types/conversation';
import { useConversation } from '../../hooks/useConversation';
import Button from '../shared/Button';
import Input from '../shared/Input';
import { MESSAGE_MAX_LENGTH } from '../../lib/constants/messages';

interface MessageInputProps {
  /** ID of the current conversation */
  conversationId: string;
  /** Whether human agent has taken over */
  isHumanTakeover: boolean;
  /** Disabled state */
  disabled?: boolean;
  /** Input placeholder text */
  placeholder?: string;
  /** Whether the app is offline */
  isOffline?: boolean;
  /** Message queue status */
  queueStatus?: {
    size: number;
    processing: boolean;
    error: Error | null;
  };
  /** Validation options */
  validationOptions?: {
    maxLength?: number;
    minLength?: number;
    validateOnChange?: boolean;
    validateOnBlur?: boolean;
  };
  /** Accessibility props */
  ariaLabel?: string;
  ariaDescribedBy?: string;
  /** Error callback */
  onValidationError?: (error: string) => void;
}

/**
 * Enhanced message input component for SMS conversations
 * Supports both AI-assisted and human agent message sending with real-time validation
 */
const MessageInput: React.FC<MessageInputProps> = ({
  conversationId,
  isHumanTakeover,
  disabled = false,
  placeholder = 'Type your message...',
  isOffline = false,
  queueStatus,
  validationOptions = {},
  ariaLabel = 'Message input',
  ariaDescribedBy,
  onValidationError
}) => {
  // State management
  const [message, setMessage] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isComposing, setIsComposing] = useState(false);

  // Hooks
  const { sendMessage, queueMessage, connectionStatus } = useConversation();
  const [debouncedMessage] = useDebounce(message, 300);

  // Validation configuration
  const maxLength = validationOptions.maxLength || MESSAGE_MAX_LENGTH;
  const minLength = validationOptions.minLength || 1;

  /**
   * Validates message content with enhanced rules
   */
  const validateMessage = useCallback((content: string): boolean => {
    if (!content || content.trim().length < minLength) {
      setError('Message cannot be empty');
      onValidationError?.('Message cannot be empty');
      return false;
    }

    if (content.length > maxLength) {
      setError(`Message cannot exceed ${maxLength} characters`);
      onValidationError?.(`Message cannot exceed ${maxLength} characters`);
      return false;
    }

    setError(null);
    return true;
  }, [maxLength, minLength, onValidationError]);

  /**
   * Handles message submission with offline support
   */
  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateMessage(message)) {
      return;
    }

    const messageData: Partial<Message> = {
      content: message.trim(),
      direction: MessageDirection.OUTBOUND,
    };

    try {
      if (connectionStatus === 'CONNECTED') {
        await sendMessage(messageData);
      } else {
        queueMessage(messageData as Message);
      }
      setMessage('');
    } catch (err) {
      setError('Failed to send message. Please try again.');
      onValidationError?.('Failed to send message. Please try again.');
    }
  }, [message, connectionStatus, sendMessage, queueMessage, validateMessage, onValidationError]);

  /**
   * Handles keyboard interactions with accessibility support
   */
  const handleKeyPress = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      const form = e.currentTarget.form;
      if (form) {
        form.dispatchEvent(new Event('submit', { cancelable: true }));
      }
    }
  }, []);

  // Validate message on change when enabled
  useEffect(() => {
    if (validationOptions.validateOnChange && debouncedMessage) {
      validateMessage(debouncedMessage);
    }
  }, [debouncedMessage, validateMessage, validationOptions.validateOnChange]);

  // Input container classes
  const containerClasses = classNames(
    'flex items-center gap-2 p-4 border-t border-gray-200',
    'bg-white dark:bg-gray-800 transition-colors duration-200',
    {
      'opacity-75 cursor-not-allowed': disabled || isOffline,
    }
  );

  // Input field classes
  const inputClasses = classNames(
    'flex-1 min-h-[40px] max-h-[120px] resize-none',
    'focus:ring-2 focus:ring-primary-500 dark:bg-gray-700',
    {
      'border-red-500 focus:ring-red-500': error,
      'animate-pulse': isComposing
    }
  );

  return (
    <form onSubmit={handleSubmit} className={containerClasses}>
      <Input
        type="textarea"
        name="message"
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        onKeyDown={handleKeyPress}
        onCompositionStart={() => setIsComposing(true)}
        onCompositionEnd={() => setIsComposing(false)}
        placeholder={placeholder}
        disabled={disabled || isOffline}
        className={inputClasses}
        error={error}
        ariaLabel={ariaLabel}
        ariaDescribedBy={ariaDescribedBy}
        validationOptions={{
          rules: [
            { type: 'MAX_LENGTH', value: maxLength },
            { type: 'MIN_LENGTH', value: minLength }
          ],
          validateOnBlur: validationOptions.validateOnBlur,
          validateOnChange: validationOptions.validateOnChange
        }}
      />

      <Button
        type="submit"
        variant="primary"
        size="md"
        disabled={disabled || isOffline || !!error || message.length === 0}
        isLoading={isComposing}
        ariaLabel="Send message"
        className="flex-shrink-0 focus:ring-2 focus:ring-primary-500"
      >
        Send
      </Button>

      {isOffline && queueStatus && queueStatus.size > 0 && (
        <div
          className="text-sm text-gray-500 dark:text-gray-400"
          role="status"
          aria-live="polite"
        >
          {queueStatus.size} message{queueStatus.size !== 1 ? 's' : ''} queued
        </div>
      )}
    </form>
  );
};

export default MessageInput;