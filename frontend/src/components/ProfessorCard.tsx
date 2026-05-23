'use client';

import Link from 'next/link';
import { memo } from 'react';
import { clsx } from 'clsx';
import type { ProfessorSummary } from '@/types';
import { StarRating, ratingBg } from './StarRating';

interface Props {
  professor: ProfessorSummary;
}

function ProfessorCardInner({ professor: p }: Props) {
  const rating = Number(p.avg_overall_rating ?? 0);

  return (
    <Link href={`/professors/${p.id}`} className="block group/card">
      <div className="relative bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm hover:shadow-md hover:border-blue-200 dark:hover:border-blue-600 hover:-translate-y-0.5 transition-all p-5 h-full">

        <div className="flex items-start gap-3">
          {/* Avatar */}
          <div className="w-12 h-12 rounded-full bg-blue-100 dark:bg-blue-900 flex-shrink-0 flex items-center justify-center text-blue-700 dark:text-blue-300 font-bold text-lg uppercase">
            {p.first_name?.[0] ?? '?'}{p.last_name?.[0] ?? ''}
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-semibold text-gray-900 dark:text-gray-100 truncate">
                {p.first_name} {p.last_name}
              </h3>
              {p.is_verified && (
                <span className="text-xs bg-blue-50 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 px-1.5 py-0.5 rounded font-medium">
                  ✓ Verified
                </span>
              )}
            </div>
            <p className="text-sm text-gray-500 dark:text-gray-400 truncate">{p.title}</p>
            <p className="text-xs text-gray-400 dark:text-gray-500 truncate mt-0.5">
              {p.department_name && `${p.department_name} · `}{p.institution_name}
            </p>
          </div>
        </div>

        <div className="mt-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            {rating > 0 ? (
              <>
                <span className={clsx('text-xl font-bold', rating >= 4 ? 'text-green-600 dark:text-green-400' : rating >= 3 ? 'text-yellow-600 dark:text-yellow-400' : 'text-red-600 dark:text-red-400')}>
                  {rating.toFixed(1)}
                </span>
                <StarRating value={Math.round(rating)} size="sm" />
              </>
            ) : (
              <span className="text-sm text-gray-400 italic">No ratings yet</span>
            )}
          </div>
          <span className="text-xs text-gray-400 dark:text-gray-500">{p.total_reviews} review{p.total_reviews !== 1 ? 's' : ''}</span>
        </div>

        {p.pct_would_take_again != null && (
          <div className="mt-3 flex items-center gap-2">
            <div className="flex-1 bg-gray-100 dark:bg-gray-700 rounded-full h-1.5 overflow-hidden">
              <div
                className="h-full bg-green-500 rounded-full"
                style={{ width: `${p.pct_would_take_again}%` }}
              />
            </div>
            <span className="text-xs text-gray-500 dark:text-gray-400 flex-shrink-0">{Number(p.pct_would_take_again).toFixed(0)}% would take again</span>
          </div>
        )}
      </div>
    </Link>
  );
}

export const ProfessorCard = memo(ProfessorCardInner);
