'use client';

import { useRef, useState, useEffect } from 'react';
import { clsx } from 'clsx';
import type { Professor } from '@/types';
import { StarRating, ratingBg } from './StarRating';
import { roleLabel } from '@/lib/professorUtils';

interface Props { professor: Professor }

function useCountUp(target: number, duration: number, decimals: number, active: boolean): number {
  const [value, setValue] = useState(0);
  useEffect(() => {
    if (!active) return;
    if (target === 0) return;
    let startTime: number | null = null;
    let raf: number;
    function step(timestamp: number) {
      if (startTime === null) startTime = timestamp;
      const elapsed = timestamp - startTime;
      const progress = Math.min(elapsed / duration, 1);
      // ease-out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      setValue(parseFloat((eased * target).toFixed(decimals)));
      if (progress < 1) {
        raf = requestAnimationFrame(step);
      } else {
        setValue(target);
      }
    }
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [target, duration, decimals, active]);
  return value;
}

export function RatingBreakdown({ professor: p }: Props) {
  const total = Number(p.total_reviews);
  const avgRating = Number(p.avg_overall_rating ?? 0);
  const weightedRating = p.weighted_avg_rating != null ? Number(p.weighted_avg_rating) : null;
  const avgDifficulty = Number(p.avg_difficulty ?? 0);
  const pctWouldTakeAgain = p.pct_would_take_again != null ? Number(p.pct_would_take_again) : null;
  const starCounts = [p.five_star, p.four_star, p.three_star, p.two_star, p.one_star].map(Number);

  const containerRef = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.1 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const animatedRating = useCountUp(avgRating, 1000, 1, visible);
  const animatedTotal = useCountUp(total, 1000, 0, visible);

  return (
    <div ref={containerRef} className="grid grid-cols-1 md:grid-cols-2 gap-6">
      {/* Left: Summary */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm p-6">
        <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-4">Overall</h3>

        <div className="flex items-end gap-3 mb-4">
          <span className={clsx('text-5xl font-bold', !avgRating ? 'text-gray-300' : avgRating >= 4 ? 'text-green-600 dark:text-green-400' : avgRating >= 3 ? 'text-yellow-600 dark:text-yellow-400' : 'text-red-600 dark:text-red-400')}>
            {avgRating ? animatedRating.toFixed(1) : '—'}
          </span>
          <div className="mb-1">
            <StarRating value={Math.round(avgRating)} size="md" />
            <p className="text-xs text-gray-400 mt-1">{Math.round(animatedTotal)} review{total !== 1 ? 's' : ''}</p>
          </div>
        </div>

        {/* Star distribution */}
        <div className="space-y-1.5">
          {[5, 4, 3, 2, 1].map((star, i) => {
            const count = starCounts[i];
            const pct = total > 0 ? (count / total) * 100 : 0;
            return (
              <div key={star} className="flex items-center gap-2 text-xs">
                <span className="w-3 text-right text-gray-500">{star}</span>
                <span className="text-yellow-400">★</span>
                <div className="flex-1 bg-gray-100 dark:bg-gray-700 rounded-full h-2 overflow-hidden">
                  <div
                    className="h-full bg-yellow-400 rounded-full"
                    style={{
                      width: visible ? `${pct}%` : '0%',
                      transition: 'width 0.8s ease-out',
                      transitionDelay: `${i * 80}ms`,
                    }}
                  />
                </div>
                <span className="w-6 text-right text-gray-400">{count}</span>
              </div>
            );
          })}
        </div>

        <div className="mt-4 pt-4 border-t border-gray-50 dark:border-gray-700 grid grid-cols-2 gap-4">
          <div>
            <p className="text-xs text-gray-400 dark:text-gray-500">Difficulty</p>
            <p className="text-lg font-bold text-gray-700 dark:text-gray-200">
              {avgDifficulty ? avgDifficulty.toFixed(1) : '—'}<span className="text-xs font-normal text-gray-400">/5</span>
            </p>
          </div>
          <div>
            <p className="text-xs text-gray-400 dark:text-gray-500">Would take {roleLabel(p.title)} again</p>
            <p className="text-lg font-bold text-green-600">
              {pctWouldTakeAgain != null ? `${pctWouldTakeAgain.toFixed(0)}%` : '—'}
            </p>
          </div>
          {weightedRating != null && Math.abs(weightedRating - avgRating) > 0.05 && (
            <div className="col-span-2">
              <p className="text-xs text-gray-400 dark:text-gray-500">Recency-weighted rating</p>
              <p className="text-lg font-bold text-blue-600 dark:text-blue-400">
                {weightedRating.toFixed(1)}<span className="text-xs font-normal text-gray-400">/5</span>
                <span className="text-xs font-normal text-gray-400 dark:text-gray-500 ml-1">(recent reviews weighted higher)</span>
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Right: Criteria + Tags */}
      <div className="space-y-4">
        {/* Criteria bars */}
        {p.criteria_averages.length > 0 && (
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm p-6">
            <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-4">By Category</h3>
            <div className="space-y-3">
              {p.criteria_averages.map((c, i) => (
                <div key={c.criterion}>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-gray-600 dark:text-gray-400">{c.criterion}</span>
                    <span className="font-semibold text-gray-700 dark:text-gray-300">{Number(c.avg_score).toFixed(1)}</span>
                  </div>
                  <div className="bg-gray-100 dark:bg-gray-700 rounded-full h-2 overflow-hidden">
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: visible ? `${(Number(c.avg_score) / 5) * 100}%` : '0%',
                        backgroundColor: Number(c.avg_score) >= 4 ? '#22c55e' : Number(c.avg_score) >= 3 ? '#eab308' : '#ef4444',
                        transition: 'width 0.8s ease-out',
                        transitionDelay: `${i * 80}ms`,
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Top tags */}
        {p.top_tags.length > 0 && (
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm p-6">
            <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3">Student Tags</h3>
            <div className="flex flex-wrap gap-2">
              {p.top_tags.map((t) => (
                <span
                  key={t.tag}
                  className={clsx(
                    'text-xs px-3 py-1 rounded-full font-medium',
                    t.is_positive
                      ? 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 border border-green-200 dark:border-green-700'
                      : 'bg-orange-50 dark:bg-orange-900/20 text-orange-700 dark:text-orange-400 border border-orange-200 dark:border-orange-700'
                  )}
                >
                  {t.tag}
                  <span className="ml-1 opacity-60">×{t.tag_count}</span>
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
