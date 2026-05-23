'use client';

import { useParams } from 'next/navigation';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { institutions as instApi, professors as profApi } from '@/lib/api';
import { ProfessorCard } from '@/components/ProfessorCard';

export default function InstitutionPage() {
  const { id } = useParams<{ id: string }>();
  const instId = Number(id);

  const { data: instData, isLoading: instLoading, isError } = useQuery({
    queryKey: ['institution', instId],
    queryFn: () => instApi.get(instId),
    enabled: !!instId,
  });

  const { data: profsData, isLoading: profsLoading } = useQuery({
    queryKey: ['professors', { institution_id: instId }],
    queryFn: () => profApi.list({ institution_id: instId, limit: 24, sort: 'rating' }),
    enabled: !!instId,
  });

  if (instLoading) {
    return (
      <div className="max-w-6xl mx-auto px-4 py-10 space-y-6">
        <div className="h-32 bg-white dark:bg-gray-800 rounded-2xl animate-pulse" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => <div key={i} className="h-44 bg-white dark:bg-gray-800 rounded-xl animate-pulse" />)}
        </div>
      </div>
    );
  }

  if (isError || !instData?.data) {
    return (
      <div className="max-w-6xl mx-auto px-4 py-20 text-center">
        <p className="text-2xl text-gray-400 mb-2">🎓</p>
        <h1 className="text-xl font-semibold text-gray-700 dark:text-gray-300 mb-4">Institution not found</h1>
        <Link href="/professors" className="text-blue-600 hover:underline text-sm">Browse all professors</Link>
      </div>
    );
  }

  const inst = instData.data;
  const profs = profsData?.data ?? [];
  const totalReviews = profs.reduce((sum, p) => sum + (p.total_reviews ?? 0), 0);

  const location = [inst.city, inst.state_province, inst.country].filter(Boolean).join(', ');

  return (
    <div className="max-w-6xl mx-auto px-4 py-10">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm p-8 mb-8">
        <div className="flex items-start gap-5">
          <div className="w-16 h-16 rounded-xl bg-indigo-100 dark:bg-indigo-900 flex-shrink-0 flex items-center justify-center text-indigo-700 dark:text-indigo-300 font-bold text-2xl uppercase">
            {inst.short_name?.[0] ?? inst.name[0]}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 flex-wrap mb-1">
              <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">{inst.name}</h1>
              {inst.short_name && (
                <span className="text-sm bg-indigo-50 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300 px-2 py-0.5 rounded font-medium">
                  {inst.short_name}
                </span>
              )}
            </div>
            {location && <p className="text-gray-500 dark:text-gray-400 text-sm mb-3">📍 {location}</p>}
            {inst.email_domain && (
              <p className="text-xs text-gray-400 dark:text-gray-500">Student emails: @{inst.email_domain}</p>
            )}
          </div>
        </div>

        {/* Stats row */}
        <div className="flex flex-wrap gap-6 mt-6 pt-6 border-t border-gray-100 dark:border-gray-700">
          <div className="text-center">
            <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{inst.professor_count ?? profs.length}</p>
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">Professors listed</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{totalReviews.toLocaleString()}</p>
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">Student reviews</p>
          </div>
        </div>
      </div>

      {/* Professors grid */}
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-lg font-bold text-gray-800 dark:text-gray-200">Professors at {inst.short_name ?? inst.name}</h2>
        <Link href={`/professors?institution=${instId}`} className="text-sm text-blue-600 hover:underline">
          Filter view →
        </Link>
      </div>

      {profsLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => <div key={i} className="h-44 bg-white dark:bg-gray-800 rounded-xl animate-pulse" />)}
        </div>
      ) : profs.length === 0 ? (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-dashed border-gray-200 dark:border-gray-700 py-16 text-center">
          <p className="text-gray-400 text-lg mb-2">No professors listed yet</p>
          <Link href="/professors/suggest" className="text-sm text-blue-600 hover:underline">
            Suggest a professor →
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {profs.map((p) => (
            <ProfessorCard key={p.id} professor={p} />
          ))}
        </div>
      )}
    </div>
  );
}
