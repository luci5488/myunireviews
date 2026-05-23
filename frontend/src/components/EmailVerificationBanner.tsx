'use client';

import { useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { auth as authApi } from '@/lib/api';

export function EmailVerificationBanner() {
  const { user, token, isAuthenticated, hydrated } = useAuth();
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  if (!hydrated || !isAuthenticated || user?.email_verified || dismissed) return null;

  async function resend() {
    if (!token || loading) return;
    setLoading(true);
    try {
      await authApi.resendVerification(token);
      setSent(true);
    } catch { /* ignore */ } finally {
      setLoading(false);
    }
  }

  return (
    <div className="bg-amber-50 dark:bg-amber-900/20 border-b border-amber-200 dark:border-amber-800 px-4 py-3">
      <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-amber-800 dark:text-amber-300 flex-1 min-w-0">
          {sent ? (
            <span className="font-medium">✓ Verification email sent — check your inbox.</span>
          ) : (
            <>
              <span className="font-medium">Verify your email</span> to write reviews.{' '}
              <button
                onClick={resend}
                disabled={loading}
                className="underline hover:text-amber-900 dark:hover:text-amber-200 disabled:opacity-60 py-1 px-0.5"
              >
                {loading ? 'Sending…' : 'Resend email'}
              </button>
            </>
          )}
        </p>
        <button
          onClick={() => setDismissed(true)}
          aria-label="Dismiss"
          className="text-amber-500 dark:text-amber-400 hover:text-amber-700 dark:hover:text-amber-200 text-xl leading-none flex-shrink-0 w-8 h-8 flex items-center justify-center rounded"
        >
          ×
        </button>
      </div>
    </div>
  );
}
