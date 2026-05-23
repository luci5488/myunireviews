'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useAuth } from '@/lib/auth-context';
import { auth as authApi, reviews as reviewApi } from '@/lib/api';
import { StarRating } from '@/components/StarRating';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

const STATUS_STYLES = {
  pending:  { bg: 'bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-700', label: 'Pending moderation' },
  approved: { bg: 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 border-green-200 dark:border-green-700', label: 'Published' },
  rejected: { bg: 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 border-red-200 dark:border-red-700', label: 'Rejected' },
  flagged:  { bg: 'bg-orange-50 dark:bg-orange-900/20 text-orange-700 dark:text-orange-400 border-orange-200 dark:border-orange-700', label: 'Flagged for review' },
};

export default function MyReviewsPage() {
  const { token, isAuthenticated, hydrated, login } = useAuth();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  useEffect(() => {
    if (hydrated && !isAuthenticated) router.replace('/auth/login');
  }, [hydrated, isAuthenticated, router]);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['my-reviews'],
    queryFn: () => authApi.myReviews(token!),
    enabled: !!token,
  });

  const reviews = data?.data ?? [];

  async function handleDelete(reviewId: number, professorId: number) {
    if (!token) return;
    setDeletingId(reviewId);
    setDeleteError(null);
    try {
      const refreshed = await authApi.me();
      login(refreshed.token, refreshed.data);
      await reviewApi.delete(reviewId, refreshed.token);
      setDeleteConfirmId(null);
      // Refetch this list + invalidate professor caches so counts update
      refetch();
      queryClient.invalidateQueries({ queryKey: ['professor', professorId] });
      queryClient.invalidateQueries({ queryKey: ['my-review', professorId] });
      queryClient.invalidateQueries({ queryKey: ['professor-reviews', professorId] });
    } catch (err: unknown) {
      setDeleteError((err as Error).message ?? 'Could not delete review — please try again.');
    } finally {
      setDeletingId(null);
    }
  }

  if (!hydrated || isLoading) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-12">
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 h-32 animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-10">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">My Reviews</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">All reviews you've submitted, with their current status.</p>
      </div>

      {reviews.length === 0 ? (
        <div className="text-center py-16 bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700">
          <p className="text-4xl mb-4">✍️</p>
          <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-200 mb-2">No reviews yet</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">Share your experience to help other students.</p>
          <Link href="/professors" className="bg-blue-600 hover:bg-blue-700 text-white font-medium px-5 py-2.5 rounded-xl text-sm transition-colors">
            Find a professor
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          {reviews.map((r) => {
            const s = STATUS_STYLES[r.status as keyof typeof STATUS_STYLES] ?? STATUS_STYLES.pending;
            const isEdited = !!r.is_edited;
            const date = new Date(isEdited ? r.updated_at! : r.created_at)
              .toLocaleDateString('en-AU', { day: 'numeric', month: 'long', year: 'numeric' });
            return (
              <div key={r.id} className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm p-5">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div>
                    <Link href={`/professors/${r.professor_id}`} className="font-semibold text-gray-900 dark:text-gray-100 hover:text-blue-600 dark:hover:text-blue-400 transition-colors">
                      {r.professor_first_name} {r.professor_last_name}
                    </Link>
                    <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">{r.professor_title} · {r.institution_name}</p>
                  </div>
                  <span className={`text-xs font-medium px-2.5 py-1 rounded-full border ${s.bg}`}>
                    {s.label}
                  </span>
                </div>

                <div className="mt-3 flex items-center gap-3 flex-wrap">
                  <StarRating value={r.overall_rating} size="sm" />
                  <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">{r.overall_rating}/5</span>
                  {r.course_code && (
                    <span className="text-xs bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 px-2 py-0.5 rounded-full">{r.course_code}</span>
                  )}
                  {r.semester && r.year && (
                    <span className="text-xs text-gray-400 dark:text-gray-500">{r.semester} {r.year}</span>
                  )}
                </div>

                {r.comment && (
                  <p className="mt-2 text-sm text-gray-600 dark:text-gray-300 leading-relaxed line-clamp-3">{r.comment}</p>
                )}

                <div className="mt-3 flex items-center justify-between gap-3 flex-wrap">
                  <p className="text-xs text-gray-400 dark:text-gray-500 italic">
                    {isEdited ? `Edited ${date}` : `Added ${date}`}
                  </p>
                  <div className="flex items-center gap-3">
                    {deleteConfirmId === r.id ? (
                      <span className="flex flex-col gap-1">
                        {deleteError && deletingId !== r.id && (
                          <span className="text-xs text-red-500 dark:text-red-400">{deleteError}</span>
                        )}
                        <span className="flex items-center gap-1.5">
                          <span className="text-xs text-red-500 dark:text-red-400">Delete this review?</span>
                          <button
                            onClick={() => handleDelete(r.id, r.professor_id)}
                            disabled={deletingId === r.id}
                            className="text-xs bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white px-2.5 py-1 rounded-lg transition-colors"
                          >
                            {deletingId === r.id ? 'Deleting…' : 'Yes, delete'}
                          </button>
                          <button
                            onClick={() => { setDeleteConfirmId(null); setDeleteError(null); }}
                            className="text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 px-2.5 py-1 rounded-lg border border-gray-200 dark:border-gray-600 transition-colors"
                          >
                            Cancel
                          </button>
                        </span>
                      </span>
                    ) : (
                      <button
                        onClick={() => setDeleteConfirmId(r.id)}
                        className="text-xs text-gray-400 hover:text-red-500 dark:hover:text-red-400 transition-colors flex items-center gap-1 hover:bg-red-50 dark:hover:bg-red-900/20 px-2 py-1 rounded"
                      >
                        🗑 Delete
                      </button>
                    )}
                    <Link href={`/professors/${r.professor_id}`} className="text-xs text-blue-600 dark:text-blue-400 hover:underline">
                      View professor →
                    </Link>
                  </div>
                </div>

                {r.status === 'rejected' && (
                  <div className="mt-3 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 rounded-lg">
                    <p className="text-xs text-red-600 dark:text-red-400">This review was rejected by our moderation team. It is not visible to other users.</p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
