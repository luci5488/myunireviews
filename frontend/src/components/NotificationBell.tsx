'use client';

import { useState, useRef, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/lib/auth-context';
import Link from 'next/link';
import { auth as authApi } from '@/lib/api';

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString('en-AU', { day: 'numeric', month: 'short' });
}

const TYPE_META: Record<string, { icon: string; color: string }> = {
  review_approved:    { icon: '📋', color: 'text-green-600 dark:text-green-400' },
  helpful_votes:      { icon: '👍', color: 'text-blue-600 dark:text-blue-400' },
  bookmarked_review:  { icon: '🔖', color: 'text-purple-600 dark:text-purple-400' },
  suggestion_approved: { icon: '🎓', color: 'text-emerald-600 dark:text-emerald-400' },
};

export function NotificationBell() {
  const { isAuthenticated, token } = useAuth();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['notifications-inbox'],
    queryFn: () => authApi.notificationsInbox(token!),
    enabled: isAuthenticated && !!token,
    staleTime: 60_000,
    refetchInterval: 5 * 60_000,
  });

  const markSeen = useMutation({
    mutationFn: () => authApi.markNotificationsSeen(token!),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notifications-inbox'] }),
  });

  // Close on outside click
  useEffect(() => {
    function onMouseDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onMouseDown);
    return () => document.removeEventListener('mousedown', onMouseDown);
  }, []);

  function handleOpen() {
    setOpen((v) => !v);
    if (!open && data?.unread_count && data.unread_count > 0) {
      markSeen.mutate();
    }
  }

  if (!isAuthenticated) return null;

  const unread = data?.unread_count ?? 0;
  const notifications = data?.data ?? [];

  return (
    <div ref={ref} className="relative">
      <button
        onClick={handleOpen}
        className="relative p-2 rounded-lg text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-gray-700 dark:hover:text-gray-200 transition-colors"
        aria-label={`Notifications${unread > 0 ? ` (${unread} unread)` : ''}`}
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
        </svg>
        {unread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center leading-none">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-80 bg-white dark:bg-gray-800 rounded-2xl shadow-xl border border-gray-100 dark:border-gray-700 z-50 overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 dark:border-gray-700">
            <h3 className="font-semibold text-gray-900 dark:text-gray-100 text-sm">Notifications</h3>
            <button onClick={() => setOpen(false)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 text-xl leading-none w-6 h-6 flex items-center justify-center">×</button>
          </div>

          {/* Body */}
          <div className="max-h-80 overflow-y-auto">
            {isLoading ? (
              <div className="p-4 space-y-3">
                {[...Array(3)].map((_, i) => (
                  <div key={i} className="flex gap-3 animate-pulse">
                    <div className="w-8 h-8 bg-gray-200 dark:bg-gray-700 rounded-full flex-shrink-0" />
                    <div className="flex-1 space-y-1.5">
                      <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-3/4" />
                      <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded w-1/3" />
                    </div>
                  </div>
                ))}
              </div>
            ) : notifications.length === 0 ? (
              <div className="p-8 text-center text-gray-400 dark:text-gray-500 text-sm">
                <div className="text-3xl mb-2">🔔</div>
                No notifications yet
              </div>
            ) : (
              <ul>
                {notifications.map((n, i) => {
                  const meta = TYPE_META[n.type] ?? { icon: '📌', color: 'text-gray-500' };
                  const stableKey = `${n.type}-${n.link ?? ''}-${n.created_at}`;
                  const item = (
                    <div className="flex gap-3 px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                      <div className={`text-xl flex-shrink-0 mt-0.5 ${meta.color}`}>{meta.icon}</div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-gray-800 dark:text-gray-200 leading-snug">{n.message}</p>
                        <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">{timeAgo(n.created_at)}</p>
                      </div>
                    </div>
                  );
                  return (
                    <li key={stableKey} className={i > 0 ? 'border-t border-gray-50 dark:border-gray-700/50' : ''}>
                      {n.link ? (
                        <Link href={n.link} onClick={() => setOpen(false)}>{item}</Link>
                      ) : item}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
