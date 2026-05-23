'use client';

import Link from 'next/link';
import { useAuth } from '@/lib/auth-context';

export function LoginPromptModal() {
  const { loginPromptOpen, closeLoginPrompt } = useAuth();
  if (!loginPromptOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 z-[150] flex items-center justify-center px-4">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl max-w-sm w-full p-6 text-center">
        <div className="text-4xl mb-3">👋</div>
        <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-2">Join to interact</h2>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
          Create a free account to vote on reviews, report content, and write your own reviews.
        </p>
        <div className="flex flex-col gap-2">
          <Link
            href="/auth/register"
            onClick={closeLoginPrompt}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2.5 rounded-xl text-sm transition-colors"
          >
            Sign up — it's free
          </Link>
          <Link
            href="/auth/login"
            onClick={closeLoginPrompt}
            className="w-full border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 font-medium py-2.5 rounded-xl text-sm transition-colors"
          >
            Log in
          </Link>
        </div>
        <button
          onClick={closeLoginPrompt}
          className="mt-4 text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
        >
          Maybe later
        </button>
      </div>
    </div>
  );
}
