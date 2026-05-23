'use client';

import { useState, useEffect, useRef, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { professors as profApi, search as searchApi } from '@/lib/api';
import { ProfessorCard } from '@/components/ProfessorCard';
import { getRecentlyViewed, type RecentProfessor } from '@/lib/recentlyViewed';
import type { SearchResults } from '@/types';

function getSearchHistory(): string[] {
  try { return JSON.parse(localStorage.getItem('mur_search_history') ?? '[]'); } catch { return []; }
}
function pushSearchHistory(q: string) {
  const h = getSearchHistory().filter((x) => x !== q).slice(0, 4);
  localStorage.setItem('mur_search_history', JSON.stringify([q, ...h]));
}

const ROTATING_WORDS = ['clarity', 'helpfulness', 'fairness', 'teaching style', 'workload'];

function RotatingWord() {
  const [index, setIndex] = useState(0);
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const interval = setInterval(() => {
      setVisible(false);
      setTimeout(() => {
        setIndex((i) => (i + 1) % ROTATING_WORDS.length);
        setVisible(true);
      }, 350);
    }, 2400);
    return () => clearInterval(interval);
  }, []);

  return (
    <span
      className="inline-block text-yellow-300 italic transition-all duration-300"
      style={{ opacity: visible ? 1 : 0, transform: visible ? 'translateY(0)' : 'translateY(-6px)' }}
    >
      {ROTATING_WORDS[index]}
    </span>
  );
}

export default function HomePage() {
  const [search, setSearch] = useState('');
  const [debouncedQ, setDebouncedQ] = useState('');
  const [open, setOpen] = useState(false);
  const [activeIdx, setActiveIdx] = useState(-1);
  const [inputFocused, setInputFocused] = useState(false);
  const [searchHistory, setSearchHistory] = useState<string[]>([]);
  const [recentlyViewed, setRecentlyViewed] = useState<RecentProfessor[]>([]);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(search.trim()), 250);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => { setOpen(debouncedQ.length >= 2); setActiveIdx(-1); }, [debouncedQ]);

  useEffect(() => {
    function handle(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, []);

  useEffect(() => {
    setRecentlyViewed(getRecentlyViewed());
  }, []);

  useEffect(() => {
    setSearchHistory(getSearchHistory());
  }, []);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === '/' && document.activeElement?.tagName !== 'INPUT' && document.activeElement?.tagName !== 'TEXTAREA') {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);


  const { data: stats } = useQuery({
    queryKey: ['site-stats'],
    queryFn: () => profApi.stats(),
    staleTime: 60_000,        // consider stale after 1 min
    refetchInterval: 60_000,  // auto-refresh every 60 seconds
  });

  const { data: suggestions, isFetching } = useQuery<{ data: SearchResults }>({
    queryKey: ['suggestions', debouncedQ],
    queryFn: () => searchApi.global(debouncedQ),
    enabled: debouncedQ.length >= 2,
    staleTime: 10_000,
  });

  const { data: topProfessors } = useQuery({
    queryKey: ['professors', 'top'],
    queryFn: () => profApi.list({ sort: 'rating', limit: 6 }),
    staleTime: 5 * 60_000, // top professors change infrequently
  });

  function handleSearch(e: FormEvent) {
    e.preventDefault();
    if (search.trim()) {
      setOpen(false);
      pushSearchHistory(search.trim());
      setSearchHistory(getSearchHistory());
      router.push(`/professors?search=${encodeURIComponent(search.trim())}`);
    }
  }

  const profResults = suggestions?.data.professors?.slice(0, 5) ?? [];
  const instResults = suggestions?.data.institutions?.slice(0, 3) ?? [];
  const hasResults = profResults.length > 0 || instResults.length > 0;
  const totalResults = profResults.length + instResults.length;

  return (
    <div>
      {/* ── Hero ─────────────────────────────────────────────── */}
      <section
        className="relative overflow-hidden text-white pt-10 pb-48 px-4"
        style={{
          WebkitMaskImage: 'linear-gradient(to bottom, black calc(100% - 180px), transparent 100%)',
          maskImage: 'linear-gradient(to bottom, black calc(100% - 180px), transparent 100%)',
        }}
      >
        {/* Gradient background */}
        <div className="absolute inset-0" style={{ background: 'linear-gradient(135deg, #1d4ed8 0%, #2563eb 50%, #4338ca 100%)' }} />
        {/* Animated blobs */}
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div
            className="animate-blob absolute -top-16 -left-16 w-96 h-96 bg-violet-400 rounded-full opacity-25 blur-2xl"
            style={{ animationDuration: '11s' }}
          />
          <div
            className="animate-blob absolute -top-8 right-0 w-80 h-80 bg-sky-300 rounded-full opacity-20 blur-2xl"
            style={{ animationDuration: '14s', animationDelay: '2s' }}
          />
          <div
            className="animate-blob absolute bottom-0 left-1/3 w-72 h-72 bg-indigo-300 rounded-full opacity-20 blur-2xl"
            style={{ animationDuration: '19s', animationDelay: '4s' }}
          />
          {/* Decorative rings */}
          <div className="absolute -top-20 -right-20 w-64 h-64 rounded-full border-2 border-white/20" />
          <div className="absolute -top-12 -right-12 w-40 h-40 rounded-full border border-white/20" />
          <div className="absolute -bottom-16 -left-16 w-56 h-56 rounded-full border-2 border-white/20" />
        </div>

        {/* Hero content */}
        <div className="relative max-w-3xl mx-auto text-center">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 bg-white/10 backdrop-blur-sm border border-white/20 rounded-full px-4 py-1.5 text-sm text-blue-100 mb-6">
            <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
            Australia&apos;s student review community
          </div>

          {/* Brand name */}
          <div className="mb-5" style={{ fontFamily: 'var(--font-playfair)', fontWeight: 700 }}>
            <span className="text-white/80" style={{ fontSize: 'clamp(1.6rem, 4.5vw, 3rem)', letterSpacing: '0.01em' }}>
              My
            </span>
            <span
              style={{
                fontSize: 'clamp(1.6rem, 4.5vw, 3rem)',
                letterSpacing: '0.01em',
                background: 'linear-gradient(135deg, #fde68a 0%, #fbbf24 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
              }}
            >
              Uni
            </span>
            <span className="text-white/80" style={{ fontSize: 'clamp(1.6rem, 4.5vw, 3rem)', letterSpacing: '0.01em' }}>
              Reviews
            </span>
          </div>

          {/* Dynamic tagline */}
          <p className="text-blue-100 text-lg sm:text-xl mb-10 font-medium">
            Rate professors on <RotatingWord />
          </p>

          {/* Search with autocomplete */}
          <div ref={wrapperRef} className="relative max-w-xl mx-auto" id="search">
            <form onSubmit={handleSearch} className="flex shadow-xl rounded-xl overflow-hidden">
              <input
                ref={searchInputRef}
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onFocus={() => { setInputFocused(true); if (debouncedQ.length >= 2) setOpen(true); }}
                onBlur={() => { setTimeout(() => setInputFocused(false), 150); }}
                onKeyDown={(e) => {
                  if (e.key === 'Escape') { setOpen(false); return; }
                  if (!open || totalResults === 0) return;
                  if (e.key === 'ArrowDown') {
                    e.preventDefault();
                    setActiveIdx((i) => Math.min(i + 1, totalResults - 1));
                  } else if (e.key === 'ArrowUp') {
                    e.preventDefault();
                    setActiveIdx((i) => Math.max(i - 1, 0));
                  } else if (e.key === 'Enter' && activeIdx >= 0) {
                    e.preventDefault();
                    setOpen(false);
                    setSearch('');
                    if (activeIdx < profResults.length) {
                      router.push(`/professors/${profResults[activeIdx].id}`);
                    } else {
                      const inst = instResults[activeIdx - profResults.length];
                      router.push(`/professors?institution=${inst.id}`);
                    }
                  }
                }}
                placeholder="Search by professor name or university..."
                className="flex-1 px-5 py-4 text-gray-900 text-base focus:outline-none"
                autoComplete="off"
              />
              <button
                type="submit"
                className="bg-yellow-400 hover:bg-yellow-300 text-gray-900 font-bold px-6 text-base transition-colors"
              >
                Search
              </button>
            </form>

            {inputFocused && search === '' && searchHistory.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-2 justify-center">
                <span className="text-xs text-blue-200/60">Recent:</span>
                {searchHistory.map((q) => (
                  <button key={q} type="button" onMouseDown={() => { setSearch(q); searchInputRef.current?.focus(); }}
                    className="text-xs bg-white/10 hover:bg-white/20 text-blue-100 border border-white/20 rounded-full px-3 py-1 transition-colors">
                    {q}
                  </button>
                ))}
              </div>
            )}

            {open && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-gray-800 rounded-xl shadow-2xl border border-gray-100 dark:border-gray-700 overflow-hidden z-50 text-left">
                {isFetching && !hasResults && (
                  <div className="px-4 py-3 text-sm text-gray-400">Searching…</div>
                )}
                {!isFetching && !hasResults && (
                  <div className="px-4 py-4 text-center">
                    <p className="text-sm text-gray-500 dark:text-gray-400 font-medium">No results for &ldquo;{debouncedQ}&rdquo;</p>
                    <p className="text-xs text-gray-400 dark:text-gray-500 mt-1 mb-3">Can&apos;t find who you&apos;re looking for?</p>
                    <button
                      type="button"
                      onMouseDown={() => {
                        setOpen(false);
                        router.push(`/professors/suggest?name=${encodeURIComponent(debouncedQ)}`);
                      }}
                      className="text-xs bg-blue-600 text-white px-3 py-1.5 rounded-lg hover:bg-blue-700 transition-colors"
                    >
                      + Suggest this professor
                    </button>
                  </div>
                )}
                {profResults.length > 0 && (
                  <div>
                    <p className="px-4 pt-3 pb-1 text-xs font-semibold text-gray-400 uppercase tracking-wide">Professors</p>
                    {profResults.map((p, i) => (
                      <button
                        key={p.id}
                        type="button"
                        onMouseDown={() => { setOpen(false); setSearch(''); router.push(`/professors/${p.id}`); }}
                        className={`w-full flex items-center gap-3 px-4 py-2.5 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors${activeIdx === i ? ' bg-blue-50 dark:bg-blue-900/20' : ''}`}
                      >
                        <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900 flex-shrink-0 flex items-center justify-center text-blue-700 dark:text-blue-300 font-bold text-xs uppercase">
                          {p.first_name[0]}{p.last_name[0]}
                        </div>
                        <div className="min-w-0 text-left">
                          <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                            {p.first_name} {p.last_name}
                            {p.is_verified && <span className="ml-1.5 text-xs text-blue-600">✓</span>}
                          </p>
                          <p className="text-xs text-gray-400 truncate">
                            {[p.title, p.institution_name].filter(Boolean).join(' · ')}
                          </p>
                        </div>
                        {(p.avg_overall_rating ?? 0) > 0 && (
                          <span className="ml-auto flex-shrink-0 text-xs font-semibold text-yellow-500">
                            ★ {Number(p.avg_overall_rating).toFixed(1)}
                          </span>
                        )}
                      </button>
                    ))}
                  </div>
                )}
                {instResults.length > 0 && (
                  <div className={profResults.length > 0 ? 'border-t border-gray-100 dark:border-gray-700' : ''}>
                    <p className="px-4 pt-3 pb-1 text-xs font-semibold text-gray-400 uppercase tracking-wide">Universities</p>
                    {instResults.map((inst, i) => (
                      <button
                        key={inst.id}
                        type="button"
                        onMouseDown={() => { setOpen(false); setSearch(''); router.push(`/professors?institution=${inst.id}`); }}
                        className={`w-full flex items-center gap-3 px-4 py-2.5 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors${activeIdx === profResults.length + i ? ' bg-blue-50 dark:bg-blue-900/20' : ''}`}
                      >
                        <div className="w-8 h-8 rounded-full bg-indigo-100 dark:bg-indigo-900/40 flex-shrink-0 flex items-center justify-center text-indigo-700 dark:text-indigo-300 font-bold text-xs">
                          🎓
                        </div>
                        <div className="text-left">
                          <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{inst.name}</p>
                          <p className="text-xs text-gray-400">{[inst.city, inst.country].filter(Boolean).join(', ')}</p>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
                {hasResults && (
                  <div className="border-t border-gray-100 dark:border-gray-700 px-4 py-2.5">
                    <button
                      type="button"
                      onMouseDown={() => { setOpen(false); router.push(`/professors?search=${encodeURIComponent(search.trim())}`); }}
                      className="text-xs text-blue-600 hover:underline"
                    >
                      See all results for &ldquo;{search.trim()}&rdquo; →
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          <p className="text-blue-200 text-sm mt-4">
            Or{' '}
            <Link href="/professors" className="underline hover:text-white">
              browse all professors
            </Link>
          </p>
        </div>

        {/* Stat strip — minimal inline */}
        {stats?.data && (
          <div className="relative max-w-3xl mx-auto mt-8 pt-5 border-t border-white/20">
            <div className="flex flex-wrap justify-center items-center gap-x-5 gap-y-1 text-sm text-white/65">
              <span>{stats.data.total_professors.toLocaleString()}+ professors</span>
              <span className="text-white/30 hidden sm:inline">·</span>
              <span>{stats.data.total_reviews.toLocaleString()}+ reviews</span>
              <span className="text-white/30 hidden sm:inline">·</span>
              <span>{stats.data.total_institutions.toLocaleString()}+ universities</span>
            </div>
          </div>
        )}

        {/* How it works title — inside gradient */}
        <div className="relative max-w-5xl mx-auto mt-12 mb-2">
          <h2 className="text-xl font-semibold text-center text-white/80">How it works</h2>
        </div>
      </section>

      {/* Cards — pulled up to sit flush against where the gradient dissolves */}
      <div className="relative -mt-48 z-10 max-w-5xl mx-auto px-4 pb-8">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
          {[
            { title: 'Find your professor',   desc: "Search by name, institution, or department to find who you're looking for.", icon: '🔍', href: '/#search' },
            { title: 'Read real reviews',     desc: 'See ratings on clarity, helpfulness, fairness, and more — all from verified peers.',      icon: '⭐', href: '/reviews' },
            { title: 'Share your experience', desc: 'Write a review after your course to help future students make informed choices.',          icon: '✍️', href: '/professors' },
          ].map(({ title, desc, icon, href }) => (
            <Link
              key={title}
              href={href}
              className="text-center group rounded-2xl p-5 bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 shadow-sm hover:shadow-md transition-shadow"
            >
              <div className="w-12 h-12 rounded-xl bg-blue-50 dark:bg-blue-900/20 group-hover:bg-blue-100 dark:group-hover:bg-blue-900/40 text-2xl flex items-center justify-center mx-auto mb-3 transition-colors">
                {icon}
              </div>
              <h3 className="font-semibold text-gray-800 dark:text-gray-200 mb-1.5 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">{title}</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 leading-relaxed">{desc}</p>
            </Link>
          ))}
        </div>
      </div>

      {/* ── Recently viewed ──────────────────────────────────── */}
      {recentlyViewed.length > 0 && (
        <section className="max-w-6xl mx-auto px-4 pb-4">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-gray-800 dark:text-gray-200">Recently viewed</h2>
            <button
              onClick={() => { localStorage.removeItem('rmp_recently_viewed'); setRecentlyViewed([]); }}
              className="text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
            >
              Clear
            </button>
          </div>
          <div className="flex flex-wrap gap-2">
            {recentlyViewed.map((p) => (
              <Link
                key={p.id}
                href={`/professors/${p.id}`}
                className="flex items-center gap-2 bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-xl px-3 py-2 hover:border-blue-300 dark:hover:border-blue-600 hover:shadow-sm transition-all text-sm"
              >
                <div className="w-6 h-6 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center text-blue-700 dark:text-blue-300 font-bold text-xs uppercase flex-shrink-0">
                  {p.first_name[0]}{p.last_name[0]}
                </div>
                <span className="font-medium text-gray-800 dark:text-gray-200">
                  {p.first_name} {p.last_name}
                </span>
                {(p.avg_overall_rating ?? 0) > 0 && (
                  <span className="text-xs text-yellow-500 font-semibold">★ {Number(p.avg_overall_rating).toFixed(1)}</span>
                )}
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* ── Top-rated professors ─────────────────────────────── */}
      {topProfessors?.data && topProfessors.data.length > 0 && (
        <div className="max-w-6xl mx-auto px-4 pt-6 pb-12">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold text-gray-800 dark:text-gray-200">Top-rated professors</h2>
            <Link href="/professors?sort=rating" className="text-sm text-blue-600 dark:text-blue-400 hover:underline">
              See all →
            </Link>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {topProfessors.data.map((p) => (
              <ProfessorCard key={p.id} professor={p} />
            ))}
          </div>
        </div>
      )}

      {/* ── CTA ─────────────────────────────────────────────── */}
      <div className="py-8 px-4 text-center">
        <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-200 mb-3">Taken a course recently?</h2>
        <p className="text-gray-500 dark:text-gray-400 mb-6 max-w-md mx-auto">
          Your honest review helps the next student choose wisely. Takes just 2 minutes.
        </p>
        <Link
          href="/professors"
          className="inline-block bg-blue-600 hover:bg-blue-700 text-white font-semibold px-8 py-3 rounded-xl transition-colors shadow-md"
        >
          Write a Review
        </Link>
      </div>
    </div>
  );
}
