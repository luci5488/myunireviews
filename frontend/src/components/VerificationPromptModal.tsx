'use client';

import Link from 'next/link';
import { useAuth } from '@/lib/auth-context';
import { auth as authApi } from '@/lib/api';
import { useState } from 'react';

export function VerificationPromptModal() {
  const { verificationPromptOpen, verificationMessage, closeVerificationPrompt, token } = useAuth();
  const [resent, setResent] = useState(false);
  const [resending, setResending] = useState(false);

  if (!verificationPromptOpen) return null;

  async function handleResend() {
    if (!token || resending || resent) return;
    setResending(true);
    try {
      await authApi.resendVerification(token);
      setResent(true);
    } catch { /* ignore */ } finally {
      setResending(false);
    }
  }

  function handleClose() {
    setResent(false);
    closeVerificationPrompt();
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-[100] flex items-center justify-center px-4">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl w-full max-w-sm p-6 text-center">
        <div className="w-14 h-14 rounded-full bg-amber-50 dark:bg-amber-900/20 flex items-center justify-center mx-auto mb-4 text-3xl">
          ✉️
        </div>
        <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-2">Verify your email first</h2>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-5 leading-relaxed">
          {verificationMessage ?? 'You need a verified email address to interact with reviews and other features.'}
          {' '}Check your inbox for the verification link.
        </p>

        <div className="space-y-3">
          {resent ? (
            <p className="text-sm text-green-600 font-medium">✓ Verification email sent — check your inbox.</p>
          ) : (
            <button
              onClick={handleResend}
              disabled={resending}
              className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-semibold py-2.5 rounded-xl text-sm transition-colors"
            >
              {resending ? 'Sending…' : 'Resend verification email'}
            </button>
          )}

          <button
            onClick={handleClose}
            className="w-full border border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700 font-medium py-2.5 rounded-xl text-sm transition-colors"
          >
            Maybe later
          </button>
        </div>

        <p className="text-xs text-gray-400 mt-4">
          Already verified?{' '}
          <Link href="/auth/login" onClick={handleClose} className="text-blue-600 hover:underline">
            Sign in again
          </Link>{' '}
          to refresh your session.
        </p>
      </div>
    </div>
  );
}
