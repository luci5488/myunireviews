'use client';

import { useState, memo } from 'react';
import { clsx } from 'clsx';

interface Props {
  value: number;
  max?: number;
  onChange?: (v: number) => void;
  size?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;
}

const sizes = { sm: 'text-lg', md: 'text-2xl', lg: 'text-4xl' };

function StarRatingInner({ value, max = 5, onChange, size = 'md', showLabel = false }: Props) {
  const [hovered, setHovered] = useState(0);
  const display = hovered || value;
  const interactive = !!onChange;

  return (
    <span className="inline-flex items-center gap-0.5">
      {Array.from({ length: max }, (_, i) => i + 1).map((star) => (
        <button
          key={star}
          type="button"
          disabled={!interactive}
          onClick={() => onChange?.(star)}
          onMouseEnter={() => interactive && setHovered(star)}
          onMouseLeave={() => interactive && setHovered(0)}
          className={clsx(
            sizes[size],
            interactive && 'cursor-pointer hover:scale-110 transition-transform',
            !interactive && 'cursor-default',
            'leading-none'
          )}
        >
          <span className={star <= display ? 'text-yellow-400' : 'text-gray-200 dark:text-gray-600'}>★</span>
        </button>
      ))}
      {showLabel && (
        <span className="ml-1 text-sm font-semibold text-gray-700 dark:text-gray-300">
          {value > 0 ? value.toFixed(1) : '—'}
        </span>
      )}
    </span>
  );
}

export const StarRating = memo(StarRatingInner);

export function ratingColor(rating: number) {
  if (rating >= 4) return 'text-green-600';
  if (rating >= 3) return 'text-yellow-500';
  return 'text-red-500';
}

export function ratingBg(rating: number) {
  if (rating >= 4) return 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400';
  if (rating >= 3) return 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400';
  return 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400';
}
