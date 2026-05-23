'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { reviews as reviewApi } from '@/lib/api';

function StarRow({ rating }: { rating: number }) {
  return (
    <span className="text-yellow-400 text-sm">
      {'★'.repeat(rating)}{'☆'.repeat(5 - rating)}
    </span>
  );
}

export default function FeaturedReviewsPage() {
  const { data, isLoading } = useQuery({
    queryKey: ['reviews-top'],
    queryFn: reviewApi.top,
    staleTime: 5 * 60_000,
  });

  // Group reviews by institution
  type TopReview = NonNullable<typeof data>['data'][number];
  const byInstitution = (data?.data ?? []).reduce<Record<number, {
    name: string;
    reviews: TopReview[];
  }>>((acc, r) => {
    if (!acc[r.institution_id]) acc[r.institution_id] = { name: r.institution_name, reviews: [] };
    // max 3 per institution
    if (acc[r.institution_id].reviews.length < 3) acc[r.institution_id].reviews.push(r);
    return acc;
  }, {});

  const institutions = Object.entries(byInstitution);

  return (
    <div className="max-w-5xl mx-auto px-4 py-10">
      {/* Header */}
      <div className="mb-10 text-center">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-2">Top Reviews</h1>
        <p className="text-gray-500 dark:text-gray-400 text-base max-w-xl mx-auto">
          The most helpful student reviews from universities across Australia — real experiences, real insights.
        </p>
      </div>

      {isLoading && (
        <div className="space-y-10">
          {[1, 2, 3].map((i) => (
            <div key={i} className="space-y-3">
              <div className="h-6 w-48 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {[1, 2, 3].map((j) => (
                  <div key={j} className="h-44 bg-gray-100 dark:bg-gray-800 rounded-xl animate-pulse" />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {!isLoading && institutions.length === 0 && (
        <div className="text-center py-20 text-gray-400">
          No reviews yet. Be the first to{' '}
          <Link href="/professors" className="text-blue-600 hover:underline">write one</Link>!
        </div>
      )}

      <div className="space-y-12">
        {institutions.map(([instId, { name, reviews }]) => (
          <section key={instId}>
            {/* Institution header */}
            <div className="flex items-center gap-3 mb-4">
              <div className="w-9 h-9 rounded-xl bg-indigo-100 dark:bg-indigo-900/40 flex items-center justify-center text-indigo-700 dark:text-indigo-300 font-bold text-sm flex-shrink-0">
                🎓
              </div>
              <h2 className="text-lg font-bold text-gray-800 dark:text-gray-200">{name}</h2>
              <div className="flex-1 h-px bg-gray-100 dark:bg-gray-700" />
            </div>

            {/* Review cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {reviews.map((r) => (
                <Link
                  key={r.id}
                  href={`/professors/${r.professor_id}`}
                  className="group bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm p-5 hover:border-blue-300 dark:hover:border-blue-600 hover:shadow-md transition-all flex flex-col gap-3"
                >
                  {/* Rating + professor */}
                  <div>
                    <StarRow rating={r.overall_rating} />
                    <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 mt-1 group-hover:text-blue-700 dark:group-hover:text-blue-400 transition-colors">
                      {r.professor_title} {r.professor_first_name} {r.professor_last_name}
                    </p>
                  </div>

                  {/* Comment */}
                  <p className="text-sm text-gray-600 dark:text-gray-300 leading-relaxed line-clamp-4 flex-1">
                    "{r.comment}"
                  </p>

                  {/* Footer */}
                  <div className="flex items-center justify-between text-xs text-gray-400 dark:text-gray-500 pt-1 border-t border-gray-50 dark:border-gray-700">
                    <span>{r.reviewer ?? 'Anonymous'}</span>
                    {Number(r.helpful_votes) > 0 && (
                      <span>👍 {r.helpful_votes} found helpful</span>
                    )}
                  </div>
                </Link>
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
