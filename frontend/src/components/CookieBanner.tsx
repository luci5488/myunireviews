'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

export function CookieBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    try {
      if (!localStorage.getItem('cookie_consent')) setVisible(true);
    } catch { setVisible(true); }
  }, []);

  function accept() {
    try { localStorage.setItem('cookie_consent', 'accepted'); } catch { }
    setVisible(false);
  }

  if (!visible) return null;

  return (
    <div className="fixed bottom-0 inset-x-0 z-50 p-4 sm:p-6">
      <div className="max-w-3xl mx-auto bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-2xl shadow-lg px-5 py-4 flex flex-col sm:flex-row items-start sm:items-center gap-4">
        <p className="text-sm text-gray-600 dark:text-gray-400 flex-1">
          We use essential cookies and local storage to keep you signed in and remember your preferences. No tracking or advertising cookies.{' '}
          <Link href="/privacy" className="text-blue-600 dark:text-blue-400 hover:underline">
            Privacy Policy
          </Link>
        </p>
        <button
          onClick={accept}
          className="flex-shrink-0 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-5 py-2 rounded-xl transition-colors"
        >
          Got it
        </button>
      </div>
    </div>
  );
}
