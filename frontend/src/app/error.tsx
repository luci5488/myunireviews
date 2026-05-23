'use client';

import { useEffect } from 'react';
import * as Sentry from '@sentry/nextjs';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <div className="flex flex-col items-center justify-center min-h-[50vh] px-4 text-center">
      <p className="text-5xl mb-4">⚠️</p>
      <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Something went wrong</h2>
      <p className="text-gray-500 dark:text-gray-400 mb-2 max-w-sm">
        An unexpected error occurred. Try again, or go back to browse professors.
      </p>
      {error.digest && (
        <p className="text-xs text-gray-400 dark:text-gray-600 mb-6 font-mono">Error ID: {error.digest}</p>
      )}
      <div className="flex gap-3">
        <button
          onClick={reset}
          className="bg-blue-600 hover:bg-blue-700 text-white font-semibold px-6 py-2.5 rounded-xl transition-colors shadow-sm"
        >
          Try again
        </button>
        <a
          href="/"
          className="border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 font-medium px-6 py-2.5 rounded-xl transition-colors"
        >
          Go home
        </a>
      </div>
    </div>
  );
}
