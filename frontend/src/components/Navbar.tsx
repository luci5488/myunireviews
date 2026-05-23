'use client';

import React from 'react';
import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
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
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const pathname = usePathname();

  // Close both menus on route change
  useEffect(() => {
    setMenuOpen(false);
    setMobileMenuOpen(false);
  }, [pathname]);

  // Close user dropdown on outside click
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
    <>
      <nav className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 sticky top-0 z-50 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center gap-2">

          {/* Left section */}
          <div className="flex-1 flex items-center gap-3">
            {/* Mobile hamburger */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="sm:hidden w-9 h-9 flex items-center justify-center rounded-lg text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
              aria-label="Toggle menu"
            >
              {mobileMenuOpen ? (
                <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              ) : (
                <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              )}
            </button>

            {/* Desktop nav links */}
            <Link href="/" className="hidden sm:flex items-center gap-1.5 text-sm text-gray-600 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400 font-medium transition-colors">
              <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
                <path d="M10.707 2.293a1 1 0 00-1.414 0l-7 7A1 1 0 003 11h1v6a1 1 0 001 1h4v-4h2v4h4a1 1 0 001-1v-6h1a1 1 0 00.707-1.707l-7-7z" />
              </svg>
              Home
            </Link>
            <Link href="/professors" className="hidden sm:block text-sm text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white font-medium transition-colors">
              Browse
            </Link>
            <Link href="/compare" className="hidden sm:block text-sm text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white font-medium transition-colors">
              Compare
            </Link>
          </div>

          {/* Centre — Logo */}
          <Link href="/" className="whitespace-nowrap flex items-center gap-1.5 shrink-0">
            <span className="text-xl select-none cap-emoji" style={{ display: 'inline-block', transformOrigin: 'bottom center' }}>
              🎓
            </span>
            <span className="text-lg sm:text-xl font-bold tracking-tight" style={logoStyle}>
              MyUniReviews
            </span>
          </Link>

          {/* Right section */}
          <div className="flex-1 flex items-center justify-end gap-1 sm:gap-2">
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
                    {isModerator && (
                      <Link href="/moderation" onClick={() => setMenuOpen(false)} className="block px-4 py-3 text-sm text-orange-600 hover:bg-orange-50 dark:hover:bg-orange-900/20 sm:hidden">
                        Moderation
                      </Link>
                    )}
                    <Link href="/dashboard" onClick={() => setMenuOpen(false)} className="block px-4 py-3 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700">
                      My Dashboard
                    </Link>
                    <Link href="/my-reviews" onClick={() => setMenuOpen(false)} className="block px-4 py-3 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700">
                      My Reviews
                    </Link>
                    <Link href="/bookmarks" onClick={() => setMenuOpen(false)} className="block px-4 py-3 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700">
                      Saved Professors
                    </Link>
                    <button
                      onClick={() => { logout(); setMenuOpen(false); router.push('/'); }}
                      className="block w-full text-left px-4 py-3 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
                    >
                      Sign out
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <Link href="/auth/login" className="hidden sm:block text-sm text-gray-600 dark:text-gray-300 hover:text-gray-900 font-medium">
                  Sign in
                </Link>
                <Link href="/auth/register" className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-3 sm:px-4 py-2 rounded-lg transition-colors min-h-[36px] flex items-center">
                  Sign up
                </Link>
              </div>
            )}
          </div>
        </div>
      </nav>

      {/* Mobile slide-down menu */}
      {mobileMenuOpen && (
        <div className="sm:hidden bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 shadow-md sticky top-16 z-40">
          <div className="px-4 py-2 flex flex-col divide-y divide-gray-100 dark:divide-gray-800">
            <Link href="/" onClick={() => setMobileMenuOpen(false)} className="flex items-center gap-3 py-3.5 text-sm font-medium text-gray-700 dark:text-gray-200 hover:text-blue-600">
              <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
                <path d="M10.707 2.293a1 1 0 00-1.414 0l-7 7A1 1 0 003 11h1v6a1 1 0 001 1h4v-4h2v4h4a1 1 0 001-1v-6h1a1 1 0 00.707-1.707l-7-7z" />
              </svg>
              Home
            </Link>
            <Link href="/professors" onClick={() => setMobileMenuOpen(false)} className="py-3.5 text-sm font-medium text-gray-700 dark:text-gray-200 hover:text-blue-600">
              Browse Professors
            </Link>
            <Link href="/compare" onClick={() => setMobileMenuOpen(false)} className="py-3.5 text-sm font-medium text-gray-700 dark:text-gray-200 hover:text-blue-600">
              Compare Professors
            </Link>
            {isModerator && (
              <Link href="/moderation" onClick={() => setMobileMenuOpen(false)} className="py-3.5 text-sm font-medium text-orange-600 dark:text-orange-400 hover:text-orange-800">
                Moderation
              </Link>
            )}
            {!isAuthenticated && hydrated && (
              <div className="flex gap-3 py-3.5">
                <Link href="/auth/login" onClick={() => setMobileMenuOpen(false)} className="flex-1 text-center py-2.5 text-sm font-medium text-gray-700 dark:text-gray-200 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                  Sign in
                </Link>
                <Link href="/auth/register" onClick={() => setMobileMenuOpen(false)} className="flex-1 text-center py-2.5 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors">
                  Sign up
                </Link>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
