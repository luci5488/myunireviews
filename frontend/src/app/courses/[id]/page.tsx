'use client';

import { useParams } from 'next/navigation';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { courses as courseApi } from '@/lib/api';

function RatingBadge({ value }: { value?: number }) {
  if (!value || value === 0) return null;
  const n = Number(value);
  const color = n >= 4 ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400' : n >= 3 ? 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400' : 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400';
  return (
    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${color}`}>
      ★ {n.toFixed(1)}
    </span>
  );
}

export default function CoursePage() {
  const { id } = useParams<{ id: string }>();

  const { data, isLoading, isError } = useQuery({
    queryKey: ['course', Number(id)],
    queryFn: () => courseApi.get(Number(id)),
  });

  if (isLoading) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8 space-y-4">
        <div className="h-24 bg-gray-100 dark:bg-gray-800 rounded-xl animate-pulse" />
        <div className="h-40 bg-gray-100 dark:bg-gray-800 rounded-xl animate-pulse" />
      </div>
    );
  }

  if (isError || !data?.data) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-20 text-center text-red-500">
        Course not found.
      </div>
    );
  }

  const course = data.data;
  const professors = course.professors ?? [];

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm p-6">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-xl bg-blue-100 dark:bg-blue-900/40 flex items-center justify-center text-blue-700 dark:text-blue-300 font-bold text-lg flex-shrink-0">
            {course.code?.slice(0, 2) ?? '—'}
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">{course.code}</h1>
              {course.credits && (
                <span className="text-xs bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 px-2 py-0.5 rounded-full">
                  {course.credits} credits
                </span>
              )}
            </div>
            <p className="text-gray-600 dark:text-gray-300 mt-0.5">{course.name}</p>
            <p className="text-sm text-gray-400 dark:text-gray-500 mt-1">
              {[course.department_name, course.institution_name].filter(Boolean).join(' · ')}
            </p>
            {course.description && (
              <p className="text-sm text-gray-600 dark:text-gray-300 mt-3 leading-relaxed">{course.description}</p>
            )}
          </div>
        </div>
      </div>

      {/* Professors list */}
      <div>
        <h2 className="text-lg font-bold text-gray-800 dark:text-gray-200 mb-3">
          Professors teaching this course
          <span className="text-gray-400 dark:text-gray-500 font-normal text-base ml-2">({professors.length})</span>
        </h2>

        {professors.length === 0 ? (
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-dashed border-gray-200 dark:border-gray-700 py-12 text-center">
            <p className="text-gray-400">No professors linked to this course yet.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {professors.map((p) => (
              <Link
                key={p.id}
                href={`/professors/${p.id}`}
                className="flex items-center gap-4 bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm px-5 py-4 hover:border-blue-300 dark:hover:border-blue-600 hover:shadow-md transition-all"
              >
                <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900/40 flex items-center justify-center text-blue-700 dark:text-blue-300 font-bold text-sm uppercase flex-shrink-0">
                  {p.first_name[0]}{p.last_name[0]}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-gray-900 dark:text-gray-100">
                      {p.title} {p.first_name} {p.last_name}
                    </span>
                    {p.is_verified && (
                      <span className="text-xs bg-blue-50 dark:bg-blue-900/40 text-blue-600 dark:text-blue-300 border border-blue-200 dark:border-blue-700 px-1.5 py-0.5 rounded-full">
                        ✓ Verified
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-gray-400 mt-0.5 truncate">
                    {[p.department_name, p.institution_name].filter(Boolean).join(' · ')}
                  </p>
                </div>

                <div className="flex items-center gap-3 flex-shrink-0 text-right">
                  <RatingBadge value={p.avg_overall_rating} />
                  {(p.total_reviews ?? 0) > 0 && (
                    <span className="text-xs text-gray-400">{p.total_reviews} review{p.total_reviews !== 1 ? 's' : ''}</span>
                  )}
                  {(p.total_reviews ?? 0) === 0 && (
                    <span className="text-xs text-gray-400">No reviews yet</span>
                  )}
                  <span className="text-gray-300 dark:text-gray-600 text-lg">›</span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
