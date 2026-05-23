'use client';

import { useState, FormEvent, useEffect, useRef, useCallback, useMemo, Suspense } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { auth as authApi, professors as profApi, bookmarks as bookmarkApi } from '@/lib/api';
import { addRecentlyViewed } from '@/lib/recentlyViewed';
import { getCompareIds, saveCompareIds } from '@/lib/compareStorage';
import { RatingBreakdown } from '@/components/RatingBreakdown';
import { ReviewCard } from '@/components/ReviewCard';
import { Pagination } from '@/components/Pagination';
import { SimilarProfessors } from '@/components/SimilarProfessors';
import { useAuth } from '@/lib/auth-context';
import { useToast } from '@/lib/toast-context';

function ProfessorProfilePageInner() {
  const { id } = useParams<{ id: string }>();
  const profId = Number(id);
  const { isAuthenticated, token, user, login, promptVerification } = useAuth();

  // Guard against malformed URLs like /professors/abc
  if (!id || !Number.isInteger(profId) || profId <= 0) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-24 text-center">
        <p className="text-5xl mb-4">🔍</p>
        <h1 className="text-2xl font-bold text-gray-800 dark:text-gray-100 mb-2">Professor not found</h1>
        <p className="text-gray-500 dark:text-gray-400 mb-6">The link you followed doesn&apos;t point to a valid professor profile.</p>
        <Link href="/professors" className="inline-block bg-blue-600 hover:bg-blue-700 text-white font-semibold px-6 py-2.5 rounded-xl transition-colors">
          Browse professors
        </Link>
      </div>
    );
  }
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const router = useRouter();
  const searchParams = useSearchParams();

  // Real-time: invalidate reviews + my-review when a review is approved (with reconnect backoff)
  useEffect(() => {
    const base = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000';
    let es: EventSource;
    let retryDelay = 2000;
    let timeoutId: ReturnType<typeof setTimeout>;
    let active = true;

    function connect() {
      es = new EventSource(`${base}/api/reviews/events?professor_id=${profId}`);
      es.addEventListener('review_approved', () => {
        queryClient.invalidateQueries({ queryKey: ['professor-reviews', profId] });
        queryClient.invalidateQueries({ queryKey: ['professor', profId] });
        queryClient.invalidateQueries({ queryKey: ['my-review', profId] });
      });
      es.onerror = () => {
        es.close();
        if (!active) return;
        setSseStatus('reconnecting');
        retryDelay = Math.min(retryDelay * 2, 30_000);
        timeoutId = setTimeout(connect, retryDelay);
      };
      es.onopen = () => { retryDelay = 2000; setSseStatus('connected'); };
    }

    connect();
    return () => {
      active = false;
      clearTimeout(timeoutId);
      es?.close();
    };
  }, [profId, queryClient]);

  const { data: myReviewData } = useQuery({
    queryKey: ['my-review', profId],
    queryFn: () => profApi.myReview(profId, token!),
    enabled: isAuthenticated && !!token,
    staleTime: 30_000, // SSE handles real-time invalidation; no need to refetch on every mount
  });
  const myReview = myReviewData?.data ?? null;

  const [page, setPage] = useState(1);
  const [sort, setSort] = useState(() => searchParams.get('sort') ?? 'newest');
  const [reviewSearch, setReviewSearch] = useState(() => searchParams.get('search') ?? '');
  const [reviewSearchInput, setReviewSearchInput] = useState(() => searchParams.get('search') ?? '');
  const [ratingFilter, setRatingFilter] = useState<number | null>(() =>
    searchParams.get('rating') ? Number(searchParams.get('rating')) : null
  );
  const [tagFilter, setTagFilter] = useState<string | null>(null);
  const [yearFilter, setYearFilter] = useState<number | null>(null);
  const [semesterFilter, setSemesterFilter] = useState<string | null>(null);
  const [freshnessWarningDismissed, setFreshnessWarningDismissed] = useState(false);

  const updateReviewParams = useCallback((updates: { sort?: string; rating?: number | null; search?: string }) => {
    const p = new URLSearchParams(searchParams.toString());
    if (updates.sort !== undefined) {
      if (updates.sort === 'newest') p.delete('sort'); else p.set('sort', updates.sort);
    }
    if ('rating' in updates) {
      if (!updates.rating) p.delete('rating'); else p.set('rating', String(updates.rating));
    }
    if ('search' in updates) {
      if (!updates.search) p.delete('search'); else p.set('search', String(updates.search));
    }
    router.replace(`/professors/${id}${p.toString() ? `?${p}` : ''}`, { scroll: false });
  }, [router, searchParams, id]);
  const [showFloatingCta, setShowFloatingCta] = useState(false);
  const [sseStatus, setSseStatus] = useState<'connected' | 'reconnecting'>('connected');
  const [showBackToTop, setShowBackToTop] = useState(false);
  const headerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = headerRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(([entry]) => setShowFloatingCta(!entry.isIntersecting), { threshold: 0 });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  useEffect(() => {
    function onScroll() { setShowBackToTop(window.scrollY > 500); }
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const { data: profData, isLoading: profLoading, isError: profError } = useQuery({
    queryKey: ['professor', profId],
    queryFn: () => profApi.get(profId),
  });

  // Track this visit for the homepage "Recently Viewed" section
  // Must be before early returns to satisfy Rules of Hooks
  useEffect(() => {
    const p = profData?.data;
    if (!p) return;
    addRecentlyViewed({
      id: p.id,
      first_name: p.first_name,
      last_name: p.last_name,
      title: p.title,
      institution_name: p.institution_name ?? '',
      avg_overall_rating: p.avg_overall_rating ?? null,
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profData?.data?.id]);

  function copyLink() {
    navigator.clipboard.writeText(window.location.href).then(() => showToast('Link copied!', 'info'));
  }
  const [bookmarkLoading, setBookmarkLoading] = useState(false);

  const { data: bookmarkData, refetch: refetchBookmark } = useQuery({
    queryKey: ['bookmark', profId],
    queryFn: () => bookmarkApi.check(profId, token!),
    enabled: isAuthenticated && !!token,
    staleTime: 5 * 60_000, // bookmarks change infrequently
  });
  const isBookmarked = bookmarkData?.bookmarked ?? false;

  const toggleBookmark = useCallback(async () => {
    if (!token) return;
    setBookmarkLoading(true);
    try {
      const refreshed = await authApi.me();
      login(refreshed.token, refreshed.data);
      if (isBookmarked) {
        await bookmarkApi.remove(profId, refreshed.token);
        refetchBookmark();
        queryClient.invalidateQueries({ queryKey: ['bookmarks'] });
        showToast('Removed from saved professors', 'success');
      } else {
        await bookmarkApi.add(profId, refreshed.token);
        refetchBookmark();
        queryClient.invalidateQueries({ queryKey: ['bookmarks'] });
        showToast('Professor saved!', 'success');
      }
    } catch {
      showToast('Failed to update bookmark', 'error');
    } finally {
      setBookmarkLoading(false);
    }
  }, [isBookmarked, profId, token, login, refetchBookmark, queryClient, showToast]);

  // ── Compare ─────────────────────────────────────────────────
  const [inCompare, setInCompare] = useState(false);
  useEffect(() => {
    setInCompare(getCompareIds().includes(profId));
  }, [profId]);

  function handleCompare() {
    const existing = getCompareIds().filter((x) => x !== profId);
    const next = [...existing, profId].slice(0, 3);
    saveCompareIds(next);
    setInCompare(true);
    router.push(`/compare?ids=${next.join(',')}`);
  }

  const [showClaimModal, setShowClaimModal] = useState(false);
  const [claimForm, setClaimForm] = useState({ institution_email: '', staff_id: '', additional_info: '' });
  const [claimSuccess, setClaimSuccess] = useState(false);

  const claimMutation = useMutation({
    mutationFn: async () => {
      const refreshed = await authApi.me();
      login(refreshed.token, refreshed.data);
      return profApi.claim(profId, claimForm, refreshed.token);
    },
    onSuccess: () => { setShowClaimModal(false); setClaimSuccess(true); },
  });

  function handleReviewSearch(e: FormEvent) {
    e.preventDefault();
    setReviewSearch(reviewSearchInput);
    setPage(1);
    updateReviewParams({ search: reviewSearchInput });
  }

  const { data: reviewsData, isLoading: reviewsLoading, refetch: refetchReviews } = useQuery({
    queryKey: ['professor-reviews', profId, page, sort, reviewSearch, ratingFilter, yearFilter, semesterFilter, tagFilter],
    queryFn: () => profApi.reviews(profId, {
      cursor: page > 1 ? btoa(String((page - 1) * 10)) : undefined,
      limit: 10, sort,
      search: reviewSearch || undefined,
      rating: ratingFilter ?? undefined,
      year: yearFilter ?? undefined,
      semester: semesterFilter ?? undefined,
      tag: tagFilter ?? undefined,
    } as never),
    enabled: !!profId,
  });

  const handleReported = useCallback(() => refetchReviews(), [refetchReviews]);

  // On delete: refetch reviews list + invalidate professor summary (total count changes)
  const handleDeleted = useCallback(() => {
    refetchReviews();
    queryClient.invalidateQueries({ queryKey: ['professor', profId] });
    queryClient.invalidateQueries({ queryKey: ['my-review', profId] });
  }, [refetchReviews, queryClient, profId]);

  const allTagsMemo = useMemo(
    () => Array.from(new Set(reviewsData?.data.flatMap((r) => r.tags ?? []) ?? [])).sort(),
    [reviewsData?.data]
  );

  if (profLoading) {
    return (
      <div className="max-w-5xl mx-auto px-4 py-8 space-y-4">
        <div className="h-32 bg-white dark:bg-gray-800 rounded-xl animate-pulse" />
        <div className="h-64 bg-white dark:bg-gray-800 rounded-xl animate-pulse" />
        <div className="h-40 bg-white dark:bg-gray-800 rounded-xl animate-pulse" />
      </div>
    );
  }

  if (profError || !profData?.data) {
    return (
      <div className="max-w-5xl mx-auto px-4 py-20 text-center text-red-500">
        Professor not found.
      </div>
    );
  }

  const p = profData.data;

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 space-y-8">
      {/* Review pending banner */}
      {myReview?.status === 'pending' && (
        <div className="space-y-3">
          <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 text-amber-800 dark:text-amber-300 text-sm px-4 py-3 rounded-xl">
            ⏳ <span className="font-medium">Your review is pending moderation.</span> It will appear here once approved.
          </div>
          {myReview.comment && (
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-amber-200 dark:border-amber-800 shadow-sm p-4">
              <p className="text-xs font-medium text-amber-600 dark:text-amber-400 mb-2 uppercase tracking-wide">Your submitted review</p>
              <div className="flex items-center gap-2 mb-2">
                <span className="text-yellow-400 text-sm">{'★'.repeat(myReview.overall_rating ?? 0)}{'☆'.repeat(5 - (myReview.overall_rating ?? 0))}</span>
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{myReview.overall_rating}/5</span>
              </div>
              <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">{myReview.comment}</p>
            </div>
          )}
        </div>
      )}

      {/* Review rejected banner */}
      {myReview?.status === 'rejected' && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 text-sm px-4 py-3 rounded-xl space-y-1">
          <p className="text-red-700 dark:text-red-400 font-medium">✗ Your previous review was not approved.</p>
          {myReview.rejection_reason && (
            <p className="text-red-600 dark:text-red-400 text-xs">Reason: {myReview.rejection_reason}</p>
          )}
          <p className="text-red-600 dark:text-red-500 text-xs">You can submit a new review that follows our <Link href="/guidelines" className="underline">Community Guidelines</Link>.</p>
        </div>
      )}

      {/* Header */}
      <div ref={headerRef} className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm p-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
          <div className="w-16 h-16 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center text-blue-700 dark:text-blue-300 font-bold text-2xl uppercase flex-shrink-0">
            {p.first_name[0]}{p.last_name[0]}
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                {p.title} {p.first_name} {p.last_name}
              </h1>
              {p.is_verified && (
                <span className="text-xs bg-blue-50 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-700 px-2 py-0.5 rounded-full font-medium">
                  ✓ Verified
                </span>
              )}
            </div>
            <p className="text-gray-500 dark:text-gray-400 mt-0.5">
              {p.department_name && <>{p.department_name} · </>}{p.institution_name}
            </p>
            {p.bio && <p className="text-sm text-gray-600 dark:text-gray-300 mt-2 leading-relaxed">{p.bio}</p>}
            {p.total_reviews > 0 && (
              <a href="#reviews" className="text-sm text-blue-600 dark:text-blue-400 hover:underline mt-1.5 inline-block">
                {p.total_reviews} review{p.total_reviews !== 1 ? 's' : ''} ↓
              </a>
            )}
          </div>

          <div className="flex-shrink-0 flex items-center gap-2">
            <button
              onClick={copyLink}
              title="Copy link"
              className="w-10 h-10 rounded-xl border border-gray-200 dark:border-gray-600 flex items-center justify-center text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
            >
              🔗
            </button>
            <button
              onClick={handleCompare}
              title={inCompare ? 'Already in compare — go to compare page' : 'Add to compare'}
              className={`w-10 h-10 rounded-xl border flex items-center justify-center transition-colors text-base ${
                inCompare
                  ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-300 dark:border-blue-700 text-blue-500'
                  : 'border-gray-200 dark:border-gray-600 text-gray-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 hover:text-blue-500 hover:border-blue-300'
              }`}
            >
              ⚖️
            </button>
            {isAuthenticated && (
              <button
                onClick={toggleBookmark}
                disabled={bookmarkLoading}
                title={isBookmarked ? 'Remove bookmark' : 'Save professor'}
                className={`w-10 h-10 rounded-xl border flex items-center justify-center transition-colors ${
                  isBookmarked
                    ? 'bg-amber-50 dark:bg-amber-900/20 border-amber-300 dark:border-amber-700 text-amber-500'
                    : 'border-gray-200 dark:border-gray-600 text-gray-400 hover:bg-amber-50 dark:hover:bg-amber-900/20 hover:text-amber-500 hover:border-amber-300'
                }`}
              >
                {isBookmarked ? '★' : '☆'}
              </button>
            )}
            {!isAuthenticated ? (
              <Link
                href="/auth/login"
                className="inline-block border border-blue-600 dark:border-blue-400 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 font-medium px-5 py-2.5 rounded-xl transition-colors"
              >
                Sign in to Review
              </Link>
            ) : !user?.email_verified ? (
              <button
                onClick={() => promptVerification()}
                className="inline-block bg-gray-100 dark:bg-gray-700 text-gray-400 dark:text-gray-500 font-semibold px-5 py-2.5 rounded-xl text-sm hover:bg-amber-50 dark:hover:bg-amber-900/20 hover:text-amber-600 dark:hover:text-amber-400 transition-colors"
              >
                Write a Review
              </button>
            ) : myReview?.status === 'pending' ? (
              <span className="inline-block bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 text-amber-700 dark:text-amber-300 font-medium px-5 py-2.5 rounded-xl text-sm">
                ⏳ Review pending
              </span>
            ) : myReview?.status === 'approved' ? (
              <span className="inline-block bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-700 text-green-700 dark:text-green-400 font-medium px-5 py-2.5 rounded-xl text-sm">
                ✓ Reviewed
              </span>
            ) : (
              <Link
                href={`/professors/${p.id}/review`}
                className="inline-block bg-blue-600 hover:bg-blue-700 text-white font-semibold px-5 py-2.5 rounded-xl transition-colors shadow-sm"
              >
                Write a Review
              </Link>
            )}
          </div>
        </div>

        {/* Claim profile */}
        {!p.is_verified && isAuthenticated && (
          <div className="mt-3">
            {claimSuccess ? (
              <p className="text-sm text-green-600 font-medium">✓ Claim submitted — we'll be in touch.</p>
            ) : (
              <button
                onClick={() => setShowClaimModal(true)}
                className="text-sm text-blue-600 hover:underline"
              >
                Are you this professor? Claim & verify this profile →
              </button>
            )}
          </div>
        )}

        {/* Courses */}
        {p.courses && p.courses.length > 0 && (
          <div className="mt-4 pt-4 border-t border-gray-100 dark:border-gray-700 flex flex-wrap gap-2">
            <span className="text-xs text-gray-400 dark:text-gray-500 self-center">Courses:</span>
            {p.courses.map((c) => (
              <Link
                key={c.id}
                href={`/courses/${c.id}`}
                className="text-xs bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-blue-50 dark:hover:bg-blue-900/30 hover:text-blue-700 dark:hover:text-blue-300 px-2.5 py-1 rounded-full transition-colors"
              >
                {c.code} — {c.name}
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* Ratings breakdown */}
      {p.total_reviews > 0 ? (
        <RatingBreakdown professor={p} />
      ) : (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-dashed border-gray-200 dark:border-gray-700 p-12 text-center">
          <p className="text-gray-400 dark:text-gray-500 text-lg mb-2">No reviews yet</p>
          <p className="text-gray-400 dark:text-gray-500 text-sm mb-6">Be the first to rate {p.first_name} {p.last_name}!</p>
          {!isAuthenticated ? (
            <Link href="/auth/register" className="text-blue-600 hover:underline text-sm">
              Sign up to write a review
            </Link>
          ) : myReview?.status === 'pending' ? (
            <span className="inline-block bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 text-amber-700 dark:text-amber-300 font-medium px-5 py-2.5 rounded-xl text-sm">
              ⏳ Your review is pending moderation
            </span>
          ) : (
            <Link
              href={`/professors/${p.id}/review`}
              className="inline-block bg-blue-600 text-white font-medium px-6 py-2.5 rounded-xl hover:bg-blue-700 transition-colors"
            >
              Write the first review
            </Link>
          )}
        </div>
      )}

      {/* Reviews list */}
      {p.total_reviews > 0 && (
        <div id="reviews">
          {/* Sticky filter bar */}
          <div className="sticky top-16 z-30 bg-gray-50 dark:bg-gray-950 pb-2 -mx-4 px-4">
          {/* Review search */}
          <form onSubmit={handleReviewSearch} className="flex mb-4 gap-2">
            <input
              type="text"
              value={reviewSearchInput}
              onChange={(e) => { setReviewSearchInput(e.target.value); if (!e.target.value) { setReviewSearch(''); setPage(1); updateReviewParams({ search: '' }); } }}
              placeholder="Search within reviews..."
              className="flex-1 border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button type="submit" className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700">
              Search
            </button>
          </form>

          {/* Star rating filter pills */}
          <div className="flex flex-wrap gap-2 mb-3">
            {[null, 5, 4, 3, 2, 1].map((star) => (
              <button
                key={star ?? 'all'}
                onClick={() => { setRatingFilter(star); setPage(1); updateReviewParams({ rating: star }); }}
                className={`text-xs px-3 py-1.5 rounded-full font-medium border transition-colors ${
                  ratingFilter === star
                    ? 'bg-blue-600 border-blue-600 text-white'
                    : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:border-blue-300 hover:text-blue-600'
                }`}
              >
                {star === null ? 'All' : `${star}★`}
              </button>
            ))}
          </div>

          {/* Tag filter pills — built from tags present in visible reviews */}
          {allTagsMemo.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mb-4">
              {allTagsMemo.map((tag) => (
                  <button
                    key={tag}
                    onClick={() => { setTagFilter(tagFilter === tag ? null : tag); setPage(1); }}
                    className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
                      tagFilter === tag
                        ? 'bg-indigo-600 border-indigo-600 text-white'
                        : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-600 text-gray-500 dark:text-gray-400 hover:border-indigo-300 hover:text-indigo-600'
                    }`}
                  >
                    {tag}
                  </button>
                ))}
            </div>
          )}

          {/* Year + semester dropdowns */}
          <div className="flex flex-wrap gap-2 mb-3">
            <select
              value={yearFilter ?? ''}
              onChange={(e) => { setYearFilter(e.target.value ? Number(e.target.value) : null); setPage(1); }}
              className="text-sm border border-gray-200 dark:border-gray-600 rounded-xl px-3 py-1.5 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All years</option>
              {Array.from({ length: new Date().getFullYear() - 2017 }, (_, i) => new Date().getFullYear() - i).map((y) => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
            <select
              value={semesterFilter ?? ''}
              onChange={(e) => { setSemesterFilter(e.target.value || null); setPage(1); }}
              className="text-sm border border-gray-200 dark:border-gray-600 rounded-xl px-3 py-1.5 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All semesters</option>
              {['Semester 1', 'Semester 2', 'Trimester 1', 'Trimester 2', 'Trimester 3', 'Summer'].map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
            {(sort !== 'newest' || ratingFilter != null || reviewSearch || yearFilter != null || semesterFilter || tagFilter) && (
              <button
                onClick={() => { setSort('newest'); setRatingFilter(null); setReviewSearch(''); setReviewSearchInput(''); setYearFilter(null); setSemesterFilter(null); setTagFilter(null); setPage(1); updateReviewParams({ sort: 'newest', rating: null, search: '' }); }}
                className="text-xs text-blue-600 dark:text-blue-400 hover:underline px-2"
              >
                Clear all filters
              </button>
            )}
          </div>

          </div>{/* end sticky filter bar */}

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
            <h2 className="text-xl font-bold text-gray-800 dark:text-gray-100">
              Reviews <span className="text-gray-400 dark:text-gray-500 font-normal text-base">({p.total_reviews})</span>
            </h2>
            <select
              value={sort}
              onChange={(e) => { setSort(e.target.value); setPage(1); updateReviewParams({ sort: e.target.value }); }}
              className="text-sm border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-1.5 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="newest">Newest first</option>
              <option value="oldest">Oldest first</option>
              <option value="highest">Highest rated</option>
              <option value="lowest">Lowest rated</option>
              <option value="helpful">Most helpful</option>
            </select>
          </div>

          {reviewsLoading && (
            <div className="space-y-4">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="h-36 bg-white dark:bg-gray-800 rounded-xl animate-pulse" />
              ))}
            </div>
          )}

          {reviewsData?.data && reviewsData.data.length === 0 && (
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-dashed border-gray-200 dark:border-gray-700 py-12 text-center">
              <p className="text-gray-400 dark:text-gray-500 text-lg mb-1">No reviews found</p>
              {reviewSearch ? (
                <>
                  <p className="text-gray-400 text-sm mb-4">No reviews match <span className="font-medium text-gray-600 dark:text-gray-300">"{reviewSearch}"</span></p>
                  <button
                    onClick={() => { setReviewSearch(''); setReviewSearchInput(''); setPage(1); updateReviewParams({ search: '' }); }}
                    className="text-sm text-blue-600 hover:underline"
                  >
                    Clear search
                  </button>
                </>
              ) : (
                <p className="text-gray-400 dark:text-gray-500 text-sm">Be the first to rate {p.first_name} {p.last_name}!</p>
              )}
            </div>
          )}

          {reviewsData?.data && reviewsData.data.length > 0 && (() => {
            const filtered = reviewsData.data;

            // Freshness warning: 70%+ of reviews older than 2 years
            const twoYearsAgo = new Date();
            twoYearsAgo.setFullYear(twoYearsAgo.getFullYear() - 2);
            const oldCount = filtered.filter((r) => new Date(r.created_at) < twoYearsAgo).length;
            const showFreshnessWarning = !freshnessWarningDismissed && filtered.length >= 3 && oldCount / filtered.length >= 0.7;

            // Most helpful pinning: only on default sort, >3 reviews, top vote count > 2
            const topHelpful = sort === 'newest' && filtered.length > 3
              ? filtered.reduce((best, r) => r.helpful_votes > (best?.helpful_votes ?? 0) ? r : best, null as typeof filtered[0] | null)
              : null;
            const pinnedReview = topHelpful && topHelpful.helpful_votes > 2 ? topHelpful : null;
            const remainingReviews = pinnedReview ? filtered.filter((r) => r.id !== pinnedReview.id) : filtered;

            return (
              <div className="space-y-4">
                {showFreshnessWarning && (
                  <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 text-amber-800 dark:text-amber-300 rounded-xl p-3 text-sm flex items-center justify-between gap-3">
                    <span>⚠️ Most of these reviews are over 2 years old. Results may not reflect the current experience.</span>
                    <button onClick={() => setFreshnessWarningDismissed(true)} className="text-amber-500 hover:text-amber-700 dark:hover:text-amber-200 flex-shrink-0 text-lg leading-none">×</button>
                  </div>
                )}

                {pinnedReview && (
                  <>
                    <div className="flex items-center gap-2 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                      <span>👍</span> Most helpful review
                    </div>
                    <div className="ring-2 ring-green-200 dark:ring-green-700 rounded-xl">
                      <ReviewCard review={pinnedReview} onReported={handleReported} onDeleted={handleDeleted} professorTitle={p.title} searchQuery={reviewSearch} hasClaim={p.viewer_has_claim} professorId={profId} />
                    </div>
                    {remainingReviews.length > 0 && (
                      <div className="flex items-center gap-2 text-xs text-gray-400 dark:text-gray-500">
                        <div className="flex-1 h-px bg-gray-200 dark:bg-gray-700" />
                        <span>Other reviews</span>
                        <div className="flex-1 h-px bg-gray-200 dark:bg-gray-700" />
                      </div>
                    )}
                  </>
                )}

                {remainingReviews.map((r) => (
                  <ReviewCard key={r.id} review={r} onReported={handleReported} onDeleted={handleDeleted} professorTitle={p.title} searchQuery={reviewSearch} hasClaim={p.viewer_has_claim} professorId={profId} />
                ))}
                <Pagination
                  page={page}
                  totalPages={reviewsData.pagination.totalPages}
                  onPageChange={setPage}
                />
              </div>
            );
          })()}
        </div>
      )}

      {/* Similar professors */}
      <SimilarProfessors professorId={profId} />

      {/* Floating Write a Review CTA — hidden on mobile to avoid covering the sticky filter bar */}
      {/* Gate on myReviewData !== undefined to avoid flashing before the query resolves */}
      {showFloatingCta && isAuthenticated && user?.email_verified && myReviewData !== undefined && !myReview && (
        <div className="hidden sm:block fixed bottom-6 left-1/2 -translate-x-1/2 z-40">
          <Link
            href={`/professors/${p.id}/review`}
            className="bg-blue-600 hover:bg-blue-700 text-white font-semibold px-6 py-3 rounded-full shadow-lg transition-colors flex items-center gap-2"
          >
            ✎ Write a Review
          </Link>
        </div>
      )}

      {/* Back to top */}
      {showBackToTop && (
        <button
          onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
          aria-label="Back to top"
          className="fixed bottom-6 right-6 z-40 w-10 h-10 rounded-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 shadow-md text-gray-500 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 hover:border-blue-300 transition-colors flex items-center justify-center text-lg"
        >
          ↑
        </button>
      )}

      {/* SSE reconnecting banner */}
      {sseStatus === 'reconnecting' && (
        <div className="fixed bottom-20 left-1/2 -translate-x-1/2 z-40 flex items-center gap-2 text-xs text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-700 rounded-full px-4 py-2 shadow-sm whitespace-nowrap">
          <svg className="animate-spin w-3 h-3 flex-shrink-0" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
          </svg>
          Live updates paused — reconnecting…
        </div>
      )}

      {/* Claim modal */}
      {showClaimModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center px-4">
          <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-xl max-w-md w-full p-6">
            <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-1">Claim this profile</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-5">
              Provide at least one piece of verification. Our team will review within 3–5 business days.
            </p>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Institutional email</label>
                <input
                  type="email"
                  value={claimForm.institution_email}
                  onChange={(e) => setClaimForm((f) => ({ ...f, institution_email: e.target.value }))}
                  placeholder="you@university.edu"
                  className="w-full border border-gray-300 dark:border-gray-600 rounded-xl px-4 py-2.5 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Staff / Employee ID</label>
                <input
                  type="text"
                  value={claimForm.staff_id}
                  onChange={(e) => setClaimForm((f) => ({ ...f, staff_id: e.target.value }))}
                  placeholder="e.g. EMP-12345"
                  className="w-full border border-gray-300 dark:border-gray-600 rounded-xl px-4 py-2.5 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Additional notes <span className="text-gray-400 dark:text-gray-500">(optional)</span>
                </label>
                <textarea
                  rows={3}
                  value={claimForm.additional_info}
                  onChange={(e) => setClaimForm((f) => ({ ...f, additional_info: e.target.value }))}
                  placeholder="Any other context that helps us verify your identity..."
                  className="w-full border border-gray-300 dark:border-gray-600 rounded-xl px-4 py-2.5 text-sm resize-none bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {claimMutation.error && (
                <p className="text-sm text-red-600">{(claimMutation.error as Error).message}</p>
              )}

              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => claimMutation.mutate()}
                  disabled={claimMutation.isPending || (!claimForm.institution_email && !claimForm.staff_id)}
                  className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-semibold py-2.5 rounded-xl text-sm transition-colors"
                >
                  {claimMutation.isPending ? 'Submitting…' : 'Submit Claim'}
                </button>
                <button
                  onClick={() => setShowClaimModal(false)}
                  className="px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-xl text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function ProfessorProfilePage() {
  return (
    <Suspense fallback={<div className="max-w-5xl mx-auto px-4 py-8 animate-pulse" />}>
      <ProfessorProfilePageInner />
    </Suspense>
  );
}
