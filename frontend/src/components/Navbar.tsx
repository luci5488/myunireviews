'use client';

import React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, useRef, useEffect } from 'react';
import { useAuth } from '@/lib/auth-context';
import { useTheme } from '@/lib/theme-context';
import { NotificationBell } from './NotificationBell';

const logoStyle: React.CSSProperties = {
  fontFamily: 'var(--font-inter), sans-serif',
  letterSpacing: '-0.03em',
  background: 'linear-gradient(110deg, #2563eb 0%, #4f46e5 60%, #7c3aed 100%)',
  WebkitBackgroundClip: 'text',
  WebkitTextFillColor: 'transparent',
  backgroundClip: 'text',
};

export function Navbar() {
  const { user, logout, isAuthenticated, isModerator, hydrated } = useAuth();
  const { isDark, toggleTheme } = useTheme();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  // Close dropdown on outside click
  useEffect(() => {
    function handleMouseDown(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener('mousedown', handleMouseDown);
    return () => document.removeEventListener('mousedown', handleMouseDown);
  }, []);

  return (
    <nav className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 sticky top-0 z-50 shadow-sm">
      <div className="max-w-7xl mx-auto px-3 sm:px-6 h-16 flex items-center relative">
        {/* Logo */}
        <Link href="/" className="absolute left-1/2 -translate-x-1/2 whitespace-nowrap flex items-center gap-1.5 group">
          <span className="text-xl select-none cap-emoji" style={{ display: 'inline-block', transformOrigin: 'bottom center' }}>
            🎓
          </span>
          <span
            className="text-lg sm:text-xl font-bold tracking-tight"
            style={logoStyle}
          >
            MyUniReviews
          </span>
        </Link>

        {/* Left nav */}
        <div className="flex items-center gap-2 sm:gap-4">
          <Link href="/" className="flex items-center gap-1.5 text-sm text-gray-600 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400 font-medium transition-colors">
            <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
              <path d="M10.707 2.293a1 1 0 00-1.414 0l-7 7A1 1 0 003 11h1v6a1 1 0 001 1h4v-4h2v4h4a1 1 0 001-1v-6h1a1 1 0 00.707-1.707l-7-7z" />
            </svg>
            <span className="hidden sm:block">Home</span>
          </Link>
          <Link href="/professors" className="hidden sm:block text-sm text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white">
            Browse
          </Link>
          <Link href="/compare" className="hidden sm:block text-sm text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white">
            Compare
          </Link>
        </div>

        {/* Right nav */}
        <div className="flex items-center gap-2 sm:gap-3 ml-auto">
          {/* Dark mode toggle */}
          <button
            onClick={toggleTheme}
            className="w-9 h-9 rounded-full flex items-center justify-center text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            aria-label="Toggle dark mode"
          >
            {isDark ? (
              <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
              </svg>
            ) : (
              <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
              </svg>
            )}
          </button>

          {isModerator && (
            <Link href="/moderation" className="hidden sm:block text-sm text-orange-600 dark:text-orange-400 hover:text-orange-800 font-medium">
              Moderation
            </Link>
          )}

          <NotificationBell />

          {!hydrated ? null : isAuthenticated ? (
            <div className="relative" ref={menuRef}>
              <button
                onClick={() => setMenuOpen(!menuOpen)}
                className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-200 hover:text-gray-900 min-h-[44px]"
              >
                <span className="w-9 h-9 rounded-full bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 flex items-center justify-center font-bold text-xs uppercase">
                  {user?.username[0]}
                </span>
                <span className="hidden sm:block">{user?.username}</span>
              </button>

              {menuOpen && (
                <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-100 dark:border-gray-700 py-1 z-50">
                  <Link href="/" onClick={() => setMenuOpen(false)} className="block px-4 py-3 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 sm:hidden">Home</Link>
                  <Link href="/professors" onClick={() => setMenuOpen(false)} className="block px-4 py-3 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 sm:hidden">Browse</Link>
                  <Link href="/compare" onClick={() => setMenuOpen(false)} className="block px-4 py-3 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 sm:hidden">Compare</Link>
                  {isModerator && (
                    <Link href="/moderation" onClick={() => setMenuOpen(false)} className="block px-4 py-3 text-sm text-orange-600 hover:bg-orange-50 dark:hover:bg-orange-900/20 sm:hidden">Moderation</Link>
                  )}
                  <Link href="/dashboard" onClick={() => setMenuOpen(false)} className="block px-4 py-3 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700">My Dashboard</Link>
                  <Link href="/my-reviews" onClick={() => setMenuOpen(false)} className="block px-4 py-3 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700">My Reviews</Link>
                  <Link href="/bookmarks" onClick={() => setMenuOpen(false)} className="block px-4 py-3 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700">Saved Professors</Link>
                  <button onClick={() => { logout(); setMenuOpen(false); router.push('/'); }} className="block w-full text-left px-4 py-3 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20">
                    Sign out
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <Link href="/auth/login" className="text-sm text-gray-600 dark:text-gray-300 hover:text-gray-900 font-medium hidden sm:block">Sign in</Link>
              <Link href="/auth/register" className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-2.5 rounded-lg transition-colors min-h-[44px] flex items-center">Sign up</Link>
            </div>
          )}
        </div>
      </div>
    </nav>
  );
}
