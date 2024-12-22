'use client';

import React from 'react';
import Link from 'next/link'; // ^14.0.0
import { useErrorTracking } from '@sentry/nextjs'; // ^7.0.0
import { Button } from '../../components/shared/Button';
import { Card } from '../../components/shared/Card';

/**
 * NotFound component that renders a user-friendly and accessible 404 error page.
 * Implements design system standards and WCAG 2.1 Level AA compliance.
 * 
 * @returns {JSX.Element} Rendered 404 page component
 */
export default function NotFound(): JSX.Element {
  // Initialize error tracking for 404 occurrences
  const { captureException } = useErrorTracking();

  React.useEffect(() => {
    // Track 404 error with relevant metadata
    captureException(new Error('404 Page Not Found'), {
      tags: {
        error_code: 404,
        page_url: window.location.href,
        referrer: document.referrer,
      },
      level: 'warning',
    });
  }, [captureException]);

  return (
    <main
      role="main"
      className="min-h-[calc(100vh-4rem)] flex items-center justify-center p-4 bg-neutral-50"
      aria-labelledby="error-heading"
    >
      <Card
        variant="elevated"
        padding="lg"
        className="max-w-md w-full text-center"
        role="alert"
        aria-live="polite"
      >
        {/* Error status with semantic heading */}
        <h1
          id="error-heading"
          className="text-4xl font-bold text-neutral-900 mb-4"
        >
          404
        </h1>

        {/* Primary error message */}
        <p className="text-xl text-neutral-800 mb-2">
          Page Not Found
        </p>

        {/* Friendly explanation */}
        <p className="text-neutral-600 mb-8">
          The page you're looking for doesn't exist or has been moved.
        </p>

        {/* Navigation action */}
        <Link
          href="/"
          className="inline-block"
          aria-label="Return to homepage"
        >
          <Button
            variant="primary"
            size="lg"
            aria-label="Go back to homepage"
            className="min-w-[200px]"
          >
            Return Home
          </Button>
        </Link>

        {/* Additional help text for screen readers */}
        <p className="sr-only">
          Press the Return Home button to navigate back to the homepage
        </p>
      </Card>
    </main>
  );
}