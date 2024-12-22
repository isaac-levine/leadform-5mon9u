/**
 * @fileoverview Utility functions for formatting various data types with internationalization
 * and accessibility support across the application.
 * @version 1.0.0
 */

// External imports
import { format } from 'date-fns'; // v2.30.0
import { parsePhoneNumber } from 'libphonenumber-js'; // v1.10.0

// Internal imports
import { MetricType } from '../../types/analytics';
import { MessageDirection } from '../../types/conversation';

/**
 * Error messages for validation
 */
const ERROR_MESSAGES = {
  INVALID_DATE: 'Invalid date parameter provided',
  INVALID_PHONE: 'Invalid phone number format',
  INVALID_METRIC: 'Invalid metric value provided',
  INVALID_CURRENCY: 'Invalid currency amount or code',
  INVALID_MESSAGE: 'Invalid message content or length',
} as const;

/**
 * Formats a date with locale support and accessibility attributes
 * @param date - Date to format
 * @param formatString - Optional format string (defaults to 'PPpp')
 * @param locale - Optional locale string (defaults to 'en-US')
 * @returns Formatted date string with ARIA attributes
 * @throws {TypeError} If date parameter is invalid
 */
export const formatDate = (
  date: Date | string,
  formatString: string = 'PPpp',
  locale: string = 'en-US'
): string => {
  try {
    const dateObj = typeof date === 'string' ? new Date(date) : date;
    if (isNaN(dateObj.getTime())) {
      throw new TypeError(ERROR_MESSAGES.INVALID_DATE);
    }

    const formattedDate = format(dateObj, formatString);
    return `<time datetime="${dateObj.toISOString()}" aria-label="${formattedDate}">${formattedDate}</time>`;
  } catch (error) {
    throw new TypeError(ERROR_MESSAGES.INVALID_DATE);
  }
};

/**
 * Formats a phone number with international support
 * @param phoneNumber - Phone number string to format
 * @param defaultCountry - Optional default country code (defaults to 'US')
 * @returns Formatted phone number with proper international format
 * @throws {Error} If phone number is invalid or cannot be parsed
 */
export const formatPhoneNumber = (
  phoneNumber: string,
  defaultCountry: string = 'US'
): string => {
  try {
    const parsedNumber = parsePhoneNumber(phoneNumber, defaultCountry);
    if (!parsedNumber?.isValid()) {
      throw new Error(ERROR_MESSAGES.INVALID_PHONE);
    }

    const formattedNumber = parsedNumber.formatInternational();
    return `<span aria-label="Phone number: ${formattedNumber}">${formattedNumber}</span>`;
  } catch (error) {
    throw new Error(ERROR_MESSAGES.INVALID_PHONE);
  }
};

/**
 * Formats metric values with appropriate units and precision
 * @param value - Numeric value to format
 * @param metricType - Type of metric for determining format
 * @returns Formatted metric string with units and ARIA label
 * @throws {Error} If value is invalid or metric type is unsupported
 */
export const formatMetricValue = (
  value: number,
  metricType: MetricType
): string => {
  if (typeof value !== 'number' || isNaN(value)) {
    throw new Error(ERROR_MESSAGES.INVALID_METRIC);
  }

  const formatConfig: Record<MetricType, { precision: number; suffix: string }> = {
    [MetricType.RESPONSE_TIME]: { precision: 0, suffix: 'ms' },
    [MetricType.LEAD_ENGAGEMENT]: { precision: 1, suffix: '%' },
    [MetricType.CONVERSION_RATE]: { precision: 1, suffix: '%' },
    [MetricType.AI_CONFIDENCE]: { precision: 1, suffix: '%' },
    [MetricType.LEAD_QUALITY]: { precision: 1, suffix: '' }
  };

  const config = formatConfig[metricType];
  const formattedValue = value.toFixed(config.precision);
  const displayValue = `${formattedValue}${config.suffix}`;
  
  return `<span aria-label="${metricType}: ${displayValue}">${displayValue}</span>`;
};

/**
 * Formats currency values with locale support
 * @param amount - Numeric amount to format
 * @param currency - ISO currency code
 * @param locale - Optional locale string (defaults to 'en-US')
 * @returns Formatted currency string with proper locale support
 * @throws {Error} If amount is invalid or currency code is unsupported
 */
export const formatCurrency = (
  amount: number,
  currency: string,
  locale: string = 'en-US'
): string => {
  if (typeof amount !== 'number' || isNaN(amount)) {
    throw new Error(ERROR_MESSAGES.INVALID_CURRENCY);
  }

  try {
    const formatter = new Intl.NumberFormat(locale, {
      style: 'currency',
      currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });

    const formattedAmount = formatter.format(amount);
    return `<span aria-label="${amount} ${currency}">${formattedAmount}</span>`;
  } catch (error) {
    throw new Error(ERROR_MESSAGES.INVALID_CURRENCY);
  }
};

/**
 * Formats message content for preview display
 * @param content - Message content to format
 * @param maxLength - Maximum length for preview
 * @param direction - Message direction for proper formatting
 * @returns Truncated and formatted message preview
 * @throws {Error} If content is invalid or maxLength is negative
 */
export const formatMessagePreview = (
  content: string,
  maxLength: number,
  direction: MessageDirection
): string => {
  if (!content || maxLength < 0) {
    throw new Error(ERROR_MESSAGES.INVALID_MESSAGE);
  }

  const cleanContent = content.trim().replace(/\s+/g, ' ');
  const truncated = cleanContent.length > maxLength;
  const preview = truncated
    ? `${cleanContent.slice(0, maxLength)}...`
    : cleanContent;

  const directionClass = direction === MessageDirection.INBOUND ? 'inbound' : 'outbound';
  const ariaLabel = `${direction === MessageDirection.INBOUND ? 'Received' : 'Sent'} message: ${preview}`;

  return `<span class="message-preview ${directionClass}" aria-label="${ariaLabel}" dir="auto">${preview}</span>`;
};

/**
 * Type guard for checking if a value is a valid date
 * @param value - Value to check
 * @returns Boolean indicating if value is a valid date
 */
const isValidDate = (value: any): value is Date => {
  return value instanceof Date && !isNaN(value.getTime());
};

/**
 * Type guard for checking if a string is a valid currency code
 * @param code - Currency code to validate
 * @returns Boolean indicating if code is a valid ISO currency code
 */
const isValidCurrencyCode = (code: string): boolean => {
  try {
    new Intl.NumberFormat('en-US', { style: 'currency', currency: code });
    return true;
  } catch {
    return false;
  }
};