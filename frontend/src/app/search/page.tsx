'use client';

import { useState, useEffect, FormEvent, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { search as searchApi, professors as profApi } from '@/lib/api';
import { ProfessorCard } from '@/components/ProfessorCard';
import type { ProfessorSummary } from '@/types';

type SearchType = 'all' | 'professors' | 'courses' | 'institutions';

function SearchPageInner() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [query, setQuery] = useState(searchParams.get('q') ?? '');
  const [type, setType] = useState<SearchType>('all');

  useEffect(() => {
    setQuery(searchParams.get('q') ?? '');
  }, [searchParams]);

  const { data, isLoading, isError } = useQuery({
    queryKey: ['search', query, type],
    queryFn: () => searchApi.global(query, type),
    enabled: query.trim().length >= 2,
    staleTime: 30_000,
  });

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (query.trim()) router.push(`/search?q=${encodeURIComponent(query.trim())}`);
  }

  const results = data?.data;
  const profCount = results?.professors?.length ?? 0;
  const courseCount = results?.courses?.length ?? 0;
  const instCount = results?.institutions?.length ?? 0;
  const totalCount = profCount + courseCount + instCount;

  const { data: trendingData } = useQuery({
    queryKey: ['trending-professors'],
    queryFn: () => profApi.list({ sort: 'rating', limit: 6 } as never),
    staleTime: 5 * 60_000,
    enabled: query.trim().length < 2,
  });

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      {/* Search bar */}
      <form onSubmit={handleSubmit} className="flex mb-6">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search professors, courses, universities..."
          className="flex-1 border border-gray-300 dark:border-gray-600 rounded-l-xl px-4 py-3 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
          autoFocus
        />
        <button
          type="submit"
          className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-r-xl text-sm font-medium transition-colors"
        >
          Search
        </button>
      </form>

      {/* Type filter tabs */}
      <div className="flex gap-1 mb-8 border-b border-gray-200 dark:border-gray-700 overflow-x-auto">
        {(['all', 'professors', 'courses', 'institutions'] as SearchType[]).map((t) => (
          <button
            key={t}
            onClick={() => setType(t)}
            className={`px-3 sm:px-4 py-2.5 text-sm font-medium capitalize border-b-2 transition-colors whitespace-nowrap min-h-[44px] ${
              type === t
                ? 'border-blue-600 text-blue-600 dark:text-blue-400 dark:border-blue-400'
                : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {/* Empty state before searching */}
      {query.trim().length < 2 && (
        <div>
          {trendingData?.data && trendingData.data.length > 0 ? (
            <div>
              <h2 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-4">Top-rated professors</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {(trendingData.data as ProfessorSummary[]).map((p) => (
                  <ProfessorCard key={p.id} professor={p} />
                ))}
              </div>
            </div>
          ) : (
            <div className="text-center py-20">
              <p className="text-gray-400 dark:text-gray-500 text-lg">Type at least 2 characters to search.</p>
            </div>
          )}
        </div>
      )}

      {isLoading && query.trim().length >= 2 && (
        <div className="space-y-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-24 bg-white dark:bg-gray-800 rounded-xl animate-pulse" />
          ))}
        </div>
      )}

      {isError && (
        <div className="text-center py-12 text-red-500 text-sm">Search failed. Try again.</div>
      )}

      {results && totalCount > 0 && (
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
          Found <span className="font-medium text-gray-700 dark:text-gray-300">{totalCount}</span> result{totalCount !== 1 ? 's' : ''} for &ldquo;<span className="font-medium text-gray-700 dark:text-gray-300">{query}</span>&rdquo;
        </p>
      )}

      {results && totalCount === 0 && (
        <div className="text-center py-20 space-y-3">
          <p className="text-gray-500 dark:text-gray-400 text-lg">No results for &ldquo;{query}&rdquo;</p>
          <p className="text-gray-400 dark:text-gray-500 text-sm">Try a different spelling or search term.</p>
          {(type === 'all' || type === 'professors') && (
            <p className="text-sm text-gray-400 dark:text-gray-500 pt-2">
              Can&apos;t find the professor you&apos;re looking for?{' '}
              <Link href="/professors?suggest=1" className="text-blue-600 dark:text-blue-400 hover:underline font-medium">
                Suggest them →
              </Link>
            </p>
          )}
        </div>
      )}

      {results && (
        <div className="space-y-10">
          {/* Professors */}
          {(type === 'all' || type === 'professors') && (results.professors?.length ?? 0) > 0 && (
            <section>
              <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-100 mb-4">
                Professors <span className="text-gray-400 dark:text-gray-400 font-normal text-base">({profCount})</span>
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {(results.professors as ProfessorSummary[]).map((p) => (
                  <ProfessorCard key={p.id} professor={p} />
                ))}
              </div>
            </section>
          )}

          {/* Courses */}
          {(type === 'all' || type === 'courses') && (results.courses?.length ?? 0) > 0 && (
            <section>
              <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-100 mb-4">
                Courses <span className="text-gray-400 dark:text-gray-400 font-normal text-base">({courseCount})</span>
              </h2>
              <div className="space-y-2">
                {(results.courses as { id: number; code: string; name: string; credits?: number; department_name?: string; institution_name?: string }[]).map((c) => (
                  <Link
                    key={c.id}
                    href={`/professors?course=${c.id}`}
                    className="block bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm px-5 py-4 hover:border-blue-200 dark:hover:border-blue-600 hover:shadow-md transition-all"
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-xs font-bold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30 px-2 py-0.5 rounded">
                        {c.code}
                      </span>
                      <span className="font-medium text-gray-800 dark:text-gray-100">{c.name}</span>
                      {c.credits && (
                        <span className="text-xs text-gray-400 dark:text-gray-400 ml-auto">{c.credits} cr</span>
                      )}
                    </div>
                    <p className="text-xs text-gray-400 dark:text-gray-400 mt-1">
                      {c.department_name && <>{c.department_name} · </>}{c.institution_name}
                    </p>
                  </Link>
                ))}
              </div>
            </section>
          )}

          {/* Institutions */}
          {(type === 'all' || type === 'institutions') && (results.institutions?.length ?? 0) > 0 && (
            <section>
              <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-100 mb-4">
                Institutions <span className="text-gray-400 dark:text-gray-400 font-normal text-base">({instCount})</span>
              </h2>
              <div className="space-y-2">
                {(results.institutions as { id: number; name: string; short_name?: string; country: string; city?: string }[]).map((inst) => (
                  <Link
                    key={inst.id}
                    href={`/professors?institution=${inst.id}`}
                    className="flex items-center gap-3 bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm px-5 py-4 hover:border-blue-200 dark:hover:border-blue-600 hover:shadow-md transition-all"
                  >
                    <div className="w-10 h-10 rounded-lg bg-indigo-100 dark:bg-indigo-900 flex items-center justify-center text-indigo-700 dark:text-indigo-300 font-bold text-sm uppercase">
                      {inst.short_name?.[0] ?? inst.name[0]}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-gray-800 dark:text-gray-100 truncate">{inst.name}</p>
                      <p className="text-xs text-gray-400 dark:text-gray-400">{inst.city ? `${inst.city}, ` : ''}{inst.country}</p>
                    </div>
                    <span className="ml-auto text-blue-600 dark:text-blue-400 text-sm">Browse →</span>
                  </Link>
                ))}
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  );
}

export default function SearchPage() {
  return (
    <Suspense fallback={
      <div className="max-w-5xl mx-auto px-4 py-8">
        <div className="h-12 bg-gray-100 dark:bg-gray-800 rounded-xl animate-pulse mb-6" />
        <div className="space-y-4 mt-8">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-24 bg-white dark:bg-gray-800 rounded-xl animate-pulse" />
          ))}
        </div>
      </div>
    }>
      <SearchPageInner />
    </Suspense>
  );
}
