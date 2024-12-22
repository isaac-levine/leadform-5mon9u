import React from 'react'; // ^18.0.0
import clsx from 'clsx'; // ^2.0.0
import Badge from '../shared/Badge';

/**
 * Props interface for the AIConfidence component
 */
interface AIConfidenceProps {
  /** AI confidence score between 0 and 1 */
  score: number;
  /** Size variant of the confidence badge */
  size?: 'sm' | 'md' | 'lg';
  /** Whether to show the 'AI Confidence' label */
  showLabel?: boolean;
  /** Additional CSS classes for custom styling */
  className?: string;
  /** Custom aria label for accessibility */
  ariaLabel?: string;
}

/**
 * Determines the appropriate badge variant based on confidence score
 * @param score - Confidence score between 0 and 1
 * @returns Badge variant based on confidence thresholds
 */
const getConfidenceVariant = (score: number): 'success' | 'primary' | 'warning' | 'error' => {
  // Ensure score is between 0 and 1
  const validScore = Math.max(0, Math.min(1, score));

  if (validScore >= 0.8) return 'success';
  if (validScore >= 0.6) return 'primary';
  if (validScore >= 0.4) return 'warning';
  return 'error';
};

/**
 * Formats confidence score as a percentage string
 * @param score - Confidence score between 0 and 1
 * @returns Formatted percentage string
 */
const formatConfidenceScore = (score: number): string => {
  // Handle invalid input
  if (typeof score !== 'number' || !isFinite(score)) {
    return '0%';
  }

  // Clamp score between 0 and 1 and convert to percentage
  const percentage = Math.round(Math.max(0, Math.min(1, score)) * 100);
  return `${percentage}%`;
};

/**
 * AIConfidence component - Displays AI confidence score with visual indicators
 * 
 * @component
 * @example
 * ```tsx
 * <AIConfidence score={0.85} size="md" showLabel={true} />
 * ```
 */
export const AIConfidence: React.FC<AIConfidenceProps> = ({
  score,
  size = 'md',
  showLabel = true,
  className,
  ariaLabel,
}) => {
  const variant = getConfidenceVariant(score);
  const formattedScore = formatConfidenceScore(score);
  
  const defaultAriaLabel = `AI confidence level: ${formattedScore}`;

  return (
    <div 
      className={clsx(
        'inline-flex items-center gap-2',
        className
      )}
      role="status"
      aria-label={ariaLabel || defaultAriaLabel}
    >
      {showLabel && (
        <span className="text-sm font-medium text-gray-600 select-none">
          AI Confidence
        </span>
      )}
      <Badge
        variant={variant}
        size={size}
        className="min-w-[3rem] justify-center"
      >
        {formattedScore}
      </Badge>
    </div>
  );
};

/**
 * Default export for convenient importing
 */
export default AIConfidence;

/**
 * Named exports for granular usage
 */
export type { AIConfidenceProps };