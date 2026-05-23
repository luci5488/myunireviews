'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/lib/auth-context';
import { auth as authApi, bookmarks as bookmarkApi } from '@/lib/api';
import { ProfessorCard } from '@/components/ProfessorCard';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import Link from 'next/link';
import { useToast } from '@/lib/toast-context';

export default function BookmarksPage() {
  const { token, isAuthenticated, hydrated, login } = useAuth();
  const { showToast } = useToast();
  const router = useRouter();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (hydrated && !isAuthenticated) router.replace('/auth/login');
  }, [hydrated, isAuthenticated, router]);

  const { data, isLoading } = useQuery({
    queryKey: ['bookmarks'],
    queryFn: () => bookmarkApi.list(token!),
    enabled: !!token,
  });

  const professors = data?.data ?? [];

  async function remove(professorId: number) {
    if (!token) return;
    try {
      const refreshed = await authApi.me();
      login(refreshed.token, refreshed.data);
      await bookmarkApi.remove(professorId, refreshed.token);
      queryClient.invalidateQueries({ queryKey: ['bookmarks'] });
      queryClient.invalidateQueries({ queryKey: ['bookmark', professorId] });
      showToast('Removed from saved professors');
    } catch {
      showToast('Failed to remove bookmark', 'error');
    }
  }

  if (!hydrated || isLoading) {
    return (
      <div className="max-w-5xl mx-auto px-4 py-12">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 h-36 animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-10">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Saved Professors</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Professors you've bookmarked for later.</p>
        </div>
        {professors.length > 0 && (
          <span className="text-sm text-gray-400 dark:text-gray-500">{professors.length} saved</span>
        )}
      </div>

      {professors.length === 0 ? (
        <div className="text-center py-16 bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700">
          <p className="text-4xl mb-4">☆</p>
          <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-200 mb-2">No saved professors yet</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">Bookmark professors to find them easily later.</p>
          <Link href="/professors" className="bg-blue-600 hover:bg-blue-700 text-white font-medium px-5 py-2.5 rounded-xl text-sm transition-colors">
            Browse professors
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {professors.map((p) => (
            <div key={p.id} className="relative group">
              <ProfessorCard professor={p} />
              <button
                onClick={() => remove(p.id)}
                title="Remove bookmark"
                className="absolute top-3 right-3 w-7 h-7 rounded-full bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 text-amber-500 text-sm flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-50 dark:hover:bg-red-900/20 hover:text-red-500 hover:border-red-200"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
