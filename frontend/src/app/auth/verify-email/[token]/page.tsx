'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { auth as authApi, ApiError } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';

export default function VerifyEmailPage() {
  const { token } = useParams<{ token: string }>();
  const { updateUser } = useAuth();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('');

  useEffect(() => {
    authApi
      .verifyEmail(token)
      .then(() => {
        updateUser({ email_verified: true });
        // Notify all other open tabs so they update without a refresh
        try {
          const bc = new BroadcastChannel('auth');
          bc.postMessage({ type: 'email_verified' });
          bc.close();
        } catch { /* BroadcastChannel not supported */ }
        setStatus('success');
      })
      .catch((err: ApiError) => {
        setStatus('error');
        setMessage(err.message);
      });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  return (
    <div className="min-h-[80vh] flex items-center justify-center px-4">
      <div className="text-center max-w-md">
        {status === 'loading' && (
          <div className="space-y-3">
            <div className="w-12 h-12 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mx-auto" />
            <p className="text-gray-500 dark:text-gray-400">Verifying your email…</p>
          </div>
        )}

        {status === 'success' && (
          <div className="space-y-4">
            <div className="w-20 h-20 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mx-auto text-4xl">
              ✅
            </div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Email verified!</h1>
            <p className="text-gray-500 dark:text-gray-400">
              Your account is confirmed. Reviews you write carry full credibility.
            </p>
            <Link
              href="/"
              className="inline-block bg-blue-600 hover:bg-blue-700 text-white font-semibold px-8 py-3 rounded-xl transition-colors mt-2"
            >
              Go to home
            </Link>
          </div>
        )}

        {status === 'error' && (
          <div className="space-y-4">
            <div className="w-20 h-20 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center mx-auto text-4xl">
              ❌
            </div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Verification failed</h1>
            <p className="text-gray-500 dark:text-gray-400">{message}</p>
            <div className="flex gap-3 justify-center mt-2">
              <Link href="/" className="text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200">
                Go home
              </Link>
              <span className="text-gray-300">·</span>
              <Link href="/dashboard" className="text-sm text-blue-600 hover:underline">
                Resend from dashboard
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
