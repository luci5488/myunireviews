'use client';

import { useState, useEffect, useRef, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { professors as profApi } from '@/lib/api';
import type { ProfessorSummary } from '@/types';
import { clsx } from 'clsx';
import { getCompareIds, saveCompareIds } from '@/lib/compareStorage';

const SLOTS = ['A', 'B', 'C'] as const;
type Slot = typeof SLOTS[number];

const COLORS: Record<Slot, {
  bg: string; border: string; text: string; avatarBg: string; avatarText: string; barColor: string;
}> = {
  A: {
    bg: 'bg-blue-50 dark:bg-blue-900/20',
    border: 'border-blue-200 dark:border-blue-700',
    text: 'text-blue-700 dark:text-blue-300',
    avatarBg: 'bg-blue-100 dark:bg-blue-900',
    avatarText: 'text-blue-700 dark:text-blue-300',
    barColor: 'bg-blue-500',
  },
  B: {
    bg: 'bg-violet-50 dark:bg-violet-900/20',
    border: 'border-violet-200 dark:border-violet-700',
    text: 'text-violet-700 dark:text-violet-300',
    avatarBg: 'bg-violet-100 dark:bg-violet-900',
    avatarText: 'text-violet-700 dark:text-violet-300',
    barColor: 'bg-violet-500',
  },
  C: {
    bg: 'bg-emerald-50 dark:bg-emerald-900/20',
    border: 'border-emerald-200 dark:border-emerald-700',
    text: 'text-emerald-700 dark:text-emerald-300',
    avatarBg: 'bg-emerald-100 dark:bg-emerald-900',
    avatarText: 'text-emerald-700 dark:text-emerald-300',
    barColor: 'bg-emerald-500',
  },
};

function SearchBox({
  slot,
  selectedId,
  selectedProf,
  onSelect,
  onClear,
}: {
  slot: Slot;
  selectedId: number | null;
  selectedProf: { first_name: string; last_name: string; title?: string; institution_name?: string } | null;
  onSelect: (p: ProfessorSummary) => void;
  onClear: () => void;
}) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [activeIdx, setActiveIdx] = useState(-1);
  const colors = COLORS[slot];

  useEffect(() => { setActiveIdx(-1); }, [query]);

  const { data } = useQuery({
    queryKey: ['prof-search-compare', query],
    queryFn: () => profApi.list({ search: query, limit: 8 } as never),
    enabled: query.length >= 2,
    staleTime: 30_000,
  });

  const results = (data?.data ?? []) as ProfessorSummary[];

  if (selectedId && selectedProf) {
    return (
      <div className={clsx('flex items-center gap-3 p-3 border rounded-xl', colors.bg, colors.border)}>
        <div className={clsx('w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm uppercase flex-shrink-0', colors.avatarBg, colors.avatarText)}>
          {selectedProf.first_name[0]}{selectedProf.last_name[0]}
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-medium text-gray-900 dark:text-gray-100 truncate">
            {selectedProf.first_name} {selectedProf.last_name}
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
            {[selectedProf.title, selectedProf.institution_name].filter(Boolean).join(' · ')}
          </p>
        </div>
        <button onClick={onClear} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 text-xl leading-none">×</button>
      </div>
    );
  }

  return (
    <div className="relative">
      <p className={clsx('text-xs font-semibold mb-1.5', colors.text)}>Professor {slot}</p>
      <input
        type="text"
        value={query}
        onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown') {
            e.preventDefault();
            setActiveIdx((i) => Math.min(i + 1, results.length - 1));
          } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setActiveIdx((i) => Math.max(i - 1, 0));
          } else if (e.key === 'Enter') {
            if (activeIdx >= 0 && results[activeIdx]) {
              onSelect(results[activeIdx]);
              setQuery('');
              setOpen(false);
              setActiveIdx(-1);
            }
          }
        }}
        placeholder="Search professor name…"
        className="w-full border border-gray-300 dark:border-gray-600 rounded-xl px-3 py-2.5 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
      />
      {open && results.length > 0 && (
        <div className="absolute z-30 top-full mt-1 w-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-xl shadow-lg overflow-hidden">
          {results.map((p, idx) => (
            <button
              key={p.id}
              onMouseDown={() => { onSelect(p); setQuery(''); setOpen(false); }}
              className={clsx(
                'w-full text-left px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center gap-3 border-b border-gray-50 dark:border-gray-700 last:border-0',
                idx === activeIdx && 'bg-blue-50 dark:bg-blue-900/20',
              )}
            >
              <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center text-blue-700 dark:text-blue-300 font-bold text-xs uppercase flex-shrink-0">
                {p.first_name[0]}{p.last_name[0]}
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">{p.first_name} {p.last_name}</p>
                <p className="text-xs text-gray-400 truncate">{p.title} · {p.institution_name}</p>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function RatingBar({ value, max = 5, colorClass }: { value: number; max?: number; colorClass: string }) {
  const pct = Math.round((value / Math.max(max, 1)) * 100);
  return (
    <div className="flex items-center gap-1.5 text-xs">
      <div className="flex-1 bg-gray-100 dark:bg-gray-700 rounded-full h-1.5 overflow-hidden">
        <div className={`h-full ${colorClass} rounded-full`} style={{ width: `${pct}%` }} />
      </div>
      <span className="w-7 text-right font-semibold text-gray-700 dark:text-gray-200 tabular-nums">{value.toFixed(1)}</span>
    </div>
  );
}

function StatRow({ label, values, higherIsBetter = true, format }: {
  label: string;
  values: (number | null)[];
  higherIsBetter?: boolean;
  format?: (v: number) => string;
}) {
  const defined = values.filter((v): v is number => v != null);
  const best = defined.length > 1 ? (higherIsBetter ? Math.max(...defined) : Math.min(...defined)) : null;
  const count = values.length;
  const fmt = format ?? ((v: number) => v.toFixed(1));

  const cell = (v: number | null, align: 'left' | 'center' | 'right' = 'left') => {
    const isBest = best !== null && v != null && v === best;
    return (
      <div className={clsx(
        'text-sm font-semibold',
        align === 'center' && 'text-center',
        align === 'right' && 'text-right',
        isBest ? 'text-green-600 dark:text-green-400' : 'text-gray-700 dark:text-gray-200',
      )}>
        {v != null ? fmt(v) : '—'}
      </div>
    );
  };

  if (count === 2) {
    return (
      <div className="grid grid-cols-3 items-center py-2.5 border-b border-gray-50 dark:border-gray-700 last:border-0">
        {cell(values[0])}
        <div className="text-xs text-center text-gray-400 dark:text-gray-500">{label}</div>
        {cell(values[1], 'right')}
      </div>
    );
  }
  return (
    <div className="grid grid-cols-4 items-center py-2.5 border-b border-gray-50 dark:border-gray-700 last:border-0">
      <div className="text-xs text-gray-400 dark:text-gray-500 pr-1 truncate">{label}</div>
      {cell(values[0])}
      {cell(values[1], 'center')}
      {cell(values[2] ?? null, 'right')}
    </div>
  );
}

function ComparePageInner() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const [idA, setIdA] = useState<number | null>(null);
  const [idB, setIdB] = useState<number | null>(null);
  const [idC, setIdC] = useState<number | null>(null);
  const [shareCopied, setShareCopied] = useState(false);

  function copyShareLink() {
    navigator.clipboard.writeText(window.location.href);
    setShareCopied(true);
    setTimeout(() => setShareCopied(false), 2000);
  }

  // Initialize from URL on mount; fall back to localStorage if URL has no ids
  useEffect(() => {
    const urlIds = (searchParams.get('ids') ?? '').split(',').map(Number).filter(Boolean);
    const ids = urlIds.length ? urlIds : getCompareIds();
    setIdA(ids[0] ?? null);
    setIdB(ids[1] ?? null);
    setIdC(ids[2] ?? null);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Sync URL + localStorage when IDs change — ref-guarded to avoid firing on router object churn
  const prevCompareUrl = useRef('');
  useEffect(() => {
    const ids = [idA, idB, idC].filter(Boolean);
    saveCompareIds([idA, idB, idC]);
    const qs = ids.length ? `?ids=${ids.join(',')}` : '';
    const next = `/compare${qs}`;
    if (prevCompareUrl.current !== next) {
      prevCompareUrl.current = next;
      router.replace(next, { scroll: false });
    }
  }, [idA, idB, idC, router]);

  // Three explicit queries — no hooks-in-loops
  const { data: qA } = useQuery({ queryKey: ['professor', idA], queryFn: () => profApi.get(idA!), enabled: !!idA });
  const { data: qB } = useQuery({ queryKey: ['professor', idB], queryFn: () => profApi.get(idB!), enabled: !!idB });
  const { data: qC } = useQuery({ queryKey: ['professor', idC], queryFn: () => profApi.get(idC!), enabled: !!idC });

  const a = qA?.data;
  const b = qB?.data;
  const c = qC?.data;

  const selectedCount = [idA, idB, idC].filter(Boolean).length;
  const hasComparison = !!(a && b);

  function handleSelect(slot: Slot, p: ProfessorSummary) {
    if (slot === 'A') setIdA(p.id);
    if (slot === 'B') setIdB(p.id);
    if (slot === 'C') setIdC(p.id);
  }

  function handleClear(slot: Slot) {
    if (slot === 'A') setIdA(null);
    if (slot === 'B') setIdB(null);
    if (slot === 'C') setIdC(null);
  }

  const aStars = a ? [Number(a.five_star), Number(a.four_star), Number(a.three_star), Number(a.two_star), Number(a.one_star)] : null;
  const bStars = b ? [Number(b.five_star), Number(b.four_star), Number(b.three_star), Number(b.two_star), Number(b.one_star)] : null;
  const cStars = c ? [Number(c.five_star), Number(c.four_star), Number(c.three_star), Number(c.two_star), Number(c.one_star)] : null;
  const aMax = aStars ? Math.max(...aStars, 1) : 1;
  const bMax = bStars ? Math.max(...bStars, 1) : 1;
  const cMax = cStars ? Math.max(...cStars, 1) : 1;

  const statValues = (field: 'avg_overall_rating' | 'avg_difficulty' | 'pct_would_take_again' | 'total_reviews') => {
    const toVal = (prof: typeof a) => prof
      ? (prof[field] != null ? Number(prof[field]) : null)
      : null;
    const vals: (number | null)[] = [toVal(a), toVal(b)];
    if (idC) vals.push(toVal(c));
    return vals;
  };

  return (
    <div className="max-w-5xl mx-auto px-4 py-10">
      <div className="mb-8 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Compare Professors</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Select up to 3 professors to compare their ratings side by side.
          </p>
        </div>
        {selectedCount >= 2 && (
          <button
            onClick={copyShareLink}
            className="flex-shrink-0 flex items-center gap-1.5 text-sm px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-600 text-gray-500 dark:text-gray-400 hover:border-blue-300 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
          >
            {shareCopied ? (
              <>
                <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
                Copied!
              </>
            ) : (
              <>
                <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.1" />
                </svg>
                Share
              </>
            )}
          </button>
        )}
      </div>

      {/* Search selectors */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        <SearchBox slot="A" selectedId={idA} selectedProf={a ?? null} onSelect={(p) => handleSelect('A', p)} onClear={() => handleClear('A')} />
        <SearchBox slot="B" selectedId={idB} selectedProf={b ?? null} onSelect={(p) => handleSelect('B', p)} onClear={() => handleClear('B')} />
        <SearchBox slot="C" selectedId={idC} selectedProf={c ?? null} onSelect={(p) => handleSelect('C', p)} onClear={() => handleClear('C')} />
      </div>

      {selectedCount === 0 && (
        <div className="text-center py-16 bg-white dark:bg-gray-800 rounded-2xl border border-dashed border-gray-200 dark:border-gray-600">
          <p className="text-4xl mb-3">⚖️</p>
          <p className="text-gray-500 dark:text-gray-400 text-sm">Search for at least 2 professors above to compare them.</p>
        </div>
      )}

      {selectedCount > 0 && !hasComparison && (
        <div className="p-8 text-center text-sm text-gray-400 dark:text-gray-500 bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700">
          {idA && !idB ? 'Select Professor B (and optionally C) to see the comparison.' : 'Loading…'}
        </div>
      )}

      {hasComparison && (
        <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm overflow-hidden">
          {/* Header row */}
          <div className={clsx('grid divide-x divide-gray-100 dark:divide-gray-700', idC ? 'grid-cols-3' : 'grid-cols-2')}>
            {([
              { slot: 'A' as Slot, prof: a, id: idA },
              { slot: 'B' as Slot, prof: b, id: idB },
              ...(idC ? [{ slot: 'C' as Slot, prof: c, id: idC }] : []),
            ]).map(({ slot, prof, id }) => {
              const colors = COLORS[slot];
              return (
                <div key={slot} className="p-5">
                  {prof ? (
                    <div className="flex items-center gap-3">
                      <div className={clsx('w-11 h-11 rounded-full flex items-center justify-center font-bold text-base uppercase flex-shrink-0', colors.avatarBg, colors.avatarText)}>
                        {prof.first_name[0]}{prof.last_name[0]}
                      </div>
                      <div className="min-w-0">
                        <Link href={`/professors/${prof.id}`} className="font-semibold text-gray-900 dark:text-gray-100 hover:text-blue-600 dark:hover:text-blue-400 text-sm truncate block">
                          {prof.first_name} {prof.last_name}
                        </Link>
                        <p className="text-xs text-gray-400 dark:text-gray-500 truncate">{prof.title}</p>
                        <p className="text-xs text-gray-400 dark:text-gray-500 truncate">{prof.institution_name}</p>
                      </div>
                    </div>
                  ) : (
                    <div className="h-11 flex items-center text-sm text-gray-400 dark:text-gray-500 italic">
                      Professor {slot} loading…
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Stats */}
          <div className="px-5 pb-5 border-t border-gray-100 dark:border-gray-700">
            {/* Column headers for 3-prof mode */}
            {idC && (
              <div className="grid grid-cols-4 items-center pt-4 mb-1">
                <div />
                {(['A', 'B', 'C'] as Slot[]).map((slot) => (
                  <div key={slot} className={clsx('text-xs font-bold text-center', COLORS[slot].text)}>
                    Prof {slot}
                  </div>
                ))}
              </div>
            )}

            <h3 className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wide mt-5 mb-3">Rating Comparison</h3>
            <StatRow label="Overall" values={statValues('avg_overall_rating')} />
            <StatRow label="Difficulty" values={statValues('avg_difficulty')} higherIsBetter={false} />
            <StatRow label="Would take again %" values={statValues('pct_would_take_again')} format={(v) => `${v.toFixed(0)}%`} />
            <StatRow label="Total reviews" values={statValues('total_reviews')} format={(v) => String(Math.round(v))} />

            {/* Star distribution — only for 2-professor mode */}
            {!idC && aStars && bStars && (
              <>
                <h3 className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wide mt-5 mb-3">Star Distribution</h3>
                <div className="grid grid-cols-3 gap-x-4">
                  <div className="space-y-2">
                    {[5, 4, 3, 2, 1].map((star, i) => (
                      <RatingBar key={star} value={aStars[i]} max={aMax} colorClass={COLORS.A.barColor} />
                    ))}
                  </div>
                  <div className="space-y-2 flex flex-col justify-around">
                    {[5, 4, 3, 2, 1].map((star) => (
                      <p key={star} className="text-xs text-center text-gray-400 dark:text-gray-500">{star}★</p>
                    ))}
                  </div>
                  <div className="space-y-2">
                    {[5, 4, 3, 2, 1].map((star, i) => (
                      <RatingBar key={star} value={bStars[i]} max={bMax} colorClass={COLORS.B.barColor} />
                    ))}
                  </div>
                </div>
              </>
            )}

            {/* Star distribution — 3-professor mode */}
            {idC && aStars && bStars && cStars && (
              <>
                <h3 className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wide mt-5 mb-3">Star Distribution</h3>
                <div className="grid grid-cols-4 gap-x-3">
                  <div className="space-y-2 flex flex-col justify-around">
                    {[5, 4, 3, 2, 1].map((star) => (
                      <p key={star} className="text-xs text-gray-400 dark:text-gray-500">{star}★</p>
                    ))}
                  </div>
                  <div className="space-y-2">
                    {[5, 4, 3, 2, 1].map((star, i) => (
                      <RatingBar key={star} value={aStars[i]} max={Math.max(aMax, bMax, cMax)} colorClass={COLORS.A.barColor} />
                    ))}
                  </div>
                  <div className="space-y-2">
                    {[5, 4, 3, 2, 1].map((star, i) => (
                      <RatingBar key={star} value={bStars[i]} max={Math.max(aMax, bMax, cMax)} colorClass={COLORS.B.barColor} />
                    ))}
                  </div>
                  <div className="space-y-2">
                    {[5, 4, 3, 2, 1].map((star, i) => (
                      <RatingBar key={star} value={cStars[i]} max={Math.max(aMax, bMax, cMax)} colorClass={COLORS.C.barColor} />
                    ))}
                  </div>
                </div>
              </>
            )}

            {/* Criteria */}
            {(a?.criteria_averages?.length ?? 0) > 0 && (
              <>
                <h3 className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wide mt-5 mb-3">By Category</h3>
                {(a?.criteria_averages ?? []).map((ca) => {
                  const cb = b?.criteria_averages?.find((x) => x.criterion === ca.criterion);
                  const cc = c?.criteria_averages?.find((x) => x.criterion === ca.criterion);
                  const vals: (number | null)[] = [Number(ca.avg_score), cb ? Number(cb.avg_score) : null];
                  if (idC) vals.push(cc ? Number(cc.avg_score) : null);
                  return <StatRow key={ca.criterion} label={ca.criterion} values={vals} />;
                })}
              </>
            )}

            {/* View profile links */}
            <div className={clsx('mt-5 grid gap-4', idC ? 'grid-cols-3' : 'grid-cols-2')}>
              {a && <Link href={`/professors/${a.id}`} className="text-center text-xs text-blue-600 dark:text-blue-400 hover:underline">View {a.first_name}&apos;s profile →</Link>}
              {b && <Link href={`/professors/${b.id}`} className={clsx('text-center text-xs hover:underline', idC ? 'text-violet-600 dark:text-violet-400' : 'text-blue-600 dark:text-blue-400')}>View {b.first_name}&apos;s profile →</Link>}
              {c && <Link href={`/professors/${c.id}`} className="text-center text-xs text-emerald-600 dark:text-emerald-400 hover:underline">View {c.first_name}&apos;s profile →</Link>}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function ComparePage() {
  return (
    <Suspense fallback={<div className="max-w-6xl mx-auto px-4 py-8 animate-pulse" />}>
      <ComparePageInner />
    </Suspense>
  );
}
