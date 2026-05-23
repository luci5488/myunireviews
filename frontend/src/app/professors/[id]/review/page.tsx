'use client';

import { useState, useEffect, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useToast } from '@/lib/toast-context';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { ApiError, auth as authApi, professors as profApi, reviews as reviewApi, courses as courseApi } from '@/lib/api';
import { Course } from '@/types';

import { roleLabel } from '@/lib/professorUtils';
import { StarRating } from '@/components/StarRating';
import { useAuth } from '@/lib/auth-context';
import { clsx } from 'clsx';

const ALL_SEMESTERS = ['Semester 1','Semester 2','Trimester 1','Trimester 2','Trimester 3','Spring','Summer','Fall','Winter'];
const CURRENT_YEAR = new Date().getFullYear();
const YEARS = Array.from({ length: 8 }, (_, i) => CURRENT_YEAR - i);

// Must start with 2+ letters and contain at least one digit — mirrors the backend Zod rule.
// Valid: COMP1511, MATH 2069, INFO1110, CS101. Invalid: "hello", "1234", "a".
const COURSE_CODE_RE = /^[A-Za-z]{2,}[A-Za-z0-9 \-\/]*[0-9][A-Za-z0-9 \-\/]*$/;

// Profanity filter — mirrors src/lib/profanityFilter.ts on the backend.
// Inlined here (rather than imported) so the check is always available even
// during a hot-reload session before Next.js has discovered the new module.
const PROFANITY_RE = /\b(fuck|fucker|fucking|fucked|fucks|shit|shits|shitty|bullshit|ass|asshole|arsehole|arse|bitch|bitches|bitchy|bastard|bastards|cunt|cunts|dick|dicks|dickhead|cock|cocks|prick|pricks|pussy|pussies|whore|whores|slut|sluts|nigger|nigga|faggot|fag|retard|retarded|twat|twats|idiot|moron|stupid|crap|damn|hell|piss|pissed|wanker|wank)\b/i;
function hasProfanity(text: string): boolean { return PROFANITY_RE.test(text); }

export default function WriteReviewPage() {
  const { id } = useParams<{ id: string }>();
  const profId = Number(id);
  const router = useRouter();
  const { token, isAuthenticated, hydrated, user, login } = useAuth();
  const { showToast } = useToast();

  const [difficultyRating, setDifficultyRating] = useState(0);
  const [wouldTakeAgain, setWouldTakeAgain] = useState<boolean | null>(null);
  const [comment, setComment] = useState('');
  const [isAnonymous, setIsAnonymous] = useState(true);
  const [semester, setSemester] = useState('');
  const [year, setYear] = useState<number | ''>('');
  const [courseId, setCourseId] = useState<number | ''>('');
  const [courseSearch, setCourseSearch] = useState('');       // text in the search input
  const [courseText, setCourseText] = useState('');           // free-text fallback value
  const [freeTextMode, setFreeTextMode] = useState(false);    // true = free-text input shown
  const [showCourseDropdown, setShowCourseDropdown] = useState(false);
  const courseBoxRef = useRef<HTMLDivElement>(null);
  const [criterionScores, setCriterionScores] = useState<Record<number, number>>({});
  const [tagIds, setTagIds] = useState<Set<number>>(new Set());

  // Overall rating is derived from category scores — never input directly.
  // The backend recomputes this authoritatively; we keep it here for live UI preview only.
  const criteriaValues = Object.values(criterionScores);
  const overallRating = criteriaValues.length > 0
    ? criteriaValues.reduce((a, b) => a + b, 0) / criteriaValues.length
    : 0;
  const overallRatingRounded = Math.round(overallRating);
  const [submitting, setSubmitting] = useState(false);
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [error, setError] = useState('');
  const [qualityFeedback, setQualityFeedback] = useState<string | null>(null);
  const [qualityScore, setQualityScore] = useState<number | null>(null);
  const [qualityChecking, setQualityChecking] = useState(false);

  const { data: profData } = useQuery({
    queryKey: ['professor', profId],
    queryFn: () => profApi.get(profId),
  });

  const { data: criteriaData } = useQuery({
    queryKey: ['criteria'],
    queryFn: () => reviewApi.criteria(),
  });

  const { data: tagsData } = useQuery({
    queryKey: ['tags'],
    queryFn: () => reviewApi.tags(),
  });

  // Debounced course search — fires 300 ms after the user stops typing
  const [debouncedSearch, setDebouncedSearch] = useState('');
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(courseSearch), 300);
    return () => clearTimeout(t);
  }, [courseSearch]);

  const { data: coursesData } = useQuery({
    queryKey: ['courses', profData?.data.institution_id, debouncedSearch],
    queryFn: () => courseApi.list({
      institution_id: profData?.data.institution_id,
      search: debouncedSearch || undefined,
      limit: 50,
    } as never),
    enabled: !!profData?.data.institution_id && showCourseDropdown,
  });

  // Close course dropdown on outside click
  useEffect(() => {
    function handleMouseDown(e: MouseEvent) {
      if (courseBoxRef.current && !courseBoxRef.current.contains(e.target as Node)) {
        setShowCourseDropdown(false);
      }
    }
    document.addEventListener('mousedown', handleMouseDown);
    return () => document.removeEventListener('mousedown', handleMouseDown);
  }, []);

  useEffect(() => {
    if (hydrated && !isAuthenticated) router.push('/auth/login');
    if (hydrated && isAuthenticated && !user?.email_verified) router.push(`/professors/${profId}`);
  }, [hydrated, isAuthenticated, user, profId, router]);

  const professor = profData?.data;

  async function checkQuality() {
    if (comment.trim().length < 15) return;

    // Profanity check is synchronous — doesn't need a token or an API call,
    // so it always works regardless of token state.
    if (hasProfanity(comment.trim())) {
      setQualityScore(0);
      setQualityFeedback('Your review contains inappropriate language. Please remove any profanity before submitting.');
      return;
    }

    // AI quality check is best-effort — silently skip if not authenticated.
    if (!token) return;
    setQualityChecking(true);
    try {
      const result = await reviewApi.analyze(comment.trim(), token);
      setQualityScore(result.score);
      setQualityFeedback(result.feedback);
    } catch {
      // Silently ignore API failures — don't block submission
    } finally {
      setQualityChecking(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!token) return;
    if (!courseId && !(freeTextMode && courseText.trim())) { setError('Please select or enter the course you took.'); return; }
    if (freeTextMode && !COURSE_CODE_RE.test(courseText.trim())) { setError('Course code must start with letters and include a number (e.g. COMP1511).'); return; }
    if (freeTextMode && courseText.trim() && hasProfanity(courseText.trim())) { setError('Course code contains inappropriate language.'); return; }
    if (!semester) { setError('Please select the semester.'); return; }
    if (!year) { setError('Please select the year.'); return; }
    if (criteriaValues.length === 0) { setError('Please rate at least one category to submit your review.'); return; }
    if (comment.trim() && hasProfanity(comment.trim())) { setError('Your review contains inappropriate language. Please remove any profanity before submitting.'); return; }

    setSubmitting(true);
    setError('');

    try {
      // Refresh the token right before submission — the user may have spent
      // a long time filling out the form and the JWT in context could be stale.
      // authApi.me() also slides the httpOnly cookie forward on the server side.
      const refreshed = await authApi.me();
      login(refreshed.token, refreshed.data);
      const freshToken = refreshed.token;

      await reviewApi.create({
        professor_id: profId,
        course_id: courseId || undefined,
        course_text: !courseId && courseText.trim() ? courseText.trim() : undefined,
        // Guards above guarantee semester and year are set — send directly so
        // they are never accidentally omitted from the JSON payload.
        semester: semester,
        year: year as number,
        // overall_rating intentionally omitted — backend computes it from criterion_scores
        difficulty_rating: difficultyRating || undefined,
        would_take_again: wouldTakeAgain ?? undefined,
        comment: comment.trim() || undefined,
        is_anonymous: isAnonymous,
        criterion_scores: Object.entries(criterionScores).map(([criteria_id, score]) => ({
          criteria_id: Number(criteria_id),
          score,
        })),
        tag_ids: Array.from(tagIds),
      }, freshToken);

      showToast('Review submitted! It will appear once approved.');
      router.push(`/professors/${profId}`);
    } catch (err: unknown) {
      // Surface per-field validation details from 422 responses so the user
      // knows exactly which field to fix, rather than just "Validation failed".
      const apiErr = err as ApiError;
      const details = apiErr.details as Array<{ field: string; message: string }> | undefined;
      if (details?.length) {
        setError(details.map((d) => d.message).join(' · '));
      } else {
        setError(apiErr.message ?? 'Failed to submit review. Please try again.');
      }
    } finally {
      setSubmitting(false);
    }
  }

  function toggleTag(id: number) {
    setTagIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else if (next.size < 6) next.add(id);
      return next;
    });
  }

  if (!hydrated || !isAuthenticated) return null;

  const selectCls = 'border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500';

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      {/* Back link */}
      <Link href={`/professors/${profId}`} className="text-sm text-blue-600 hover:underline mb-6 inline-block">
        ← Back to {professor ? `${professor.first_name} ${professor.last_name}` : 'profile'}
      </Link>

      <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm p-6 sm:p-8">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-1">Write a Review</h1>
        {professor && (
          <p className="text-gray-500 dark:text-gray-400 mb-6">
            {professor.title} {professor.first_name} {professor.last_name} · {professor.institution_name}
          </p>
        )}

        {/* Progress bar */}
        {(() => {
          const steps = [
            { label: 'Rating', done: criteriaValues.length > 0 },
            { label: 'Details', done: (Object.keys(criterionScores).length > 0 || tagIds.size > 0) && !!(courseId || (freeTextMode && courseText.trim())) && !!semester && !!year },
            { label: 'Review', done: comment.trim().length >= 15 || wouldTakeAgain !== null },
            { label: 'Submit', done: agreedToTerms },
          ];
          const currentStep = steps.findIndex((s) => !s.done);
          const active = currentStep === -1 ? steps.length - 1 : currentStep;
          return (
            <div className="flex items-center mb-8">
              {steps.map((step, i) => {
                const isDone = i < active || (i === active && step.done);
                const isActive = i === active && !step.done;
                return (
                  <div key={step.label} className="flex items-center flex-1 last:flex-none">
                    <div className="flex flex-col items-center">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${isDone ? 'bg-green-500 text-white' : isActive ? 'bg-blue-600 text-white' : 'bg-gray-200 dark:bg-gray-700 text-gray-400 dark:text-gray-500'}`}>
                        {isDone ? '✓' : i + 1}
                      </div>
                      <span className="text-[10px] mt-1 text-gray-400 dark:text-gray-500 hidden sm:block">{step.label}</span>
                    </div>
                    {i < steps.length - 1 && (
                      <div className={`flex-1 h-0.5 mx-1 transition-colors ${isDone ? 'bg-green-500' : 'bg-gray-200 dark:bg-gray-700'}`} />
                    )}
                  </div>
                );
              })}
            </div>
          );
        })()}

        <form onSubmit={handleSubmit} className="space-y-8">
          {/* Course / semester / year */}
          <section>
            <p className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
              Course Details <span className="text-red-500">*</span>
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {/* Course combobox */}
              <div className="relative" ref={courseBoxRef}>
                {freeTextMode ? (
                  <div>
                    <div className="flex items-center gap-1.5">
                      <input
                        type="text"
                        value={courseText}
                        onChange={(e) => setCourseText(e.target.value)}
                        maxLength={10}
                        placeholder="e.g. COMP1511"
                        className={clsx(
                          selectCls + ' flex-1 min-w-0',
                          courseText && (!COURSE_CODE_RE.test(courseText.trim()) || hasProfanity(courseText)) && 'border-red-400 focus:ring-red-400'
                        )}
                      />
                      <button
                        type="button"
                        onClick={() => { setFreeTextMode(false); setCourseText(''); }}
                        className="text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 whitespace-nowrap flex-shrink-0"
                        title="Search courses instead"
                      >
                        ✕
                      </button>
                    </div>
                    {courseText && hasProfanity(courseText) ? (
                      <p className="text-xs text-red-500 mt-1">Course code contains inappropriate language</p>
                    ) : courseText && !COURSE_CODE_RE.test(courseText.trim()) ? (
                      <p className="text-xs text-red-500 mt-1">Must start with letters and include a number — e.g. COMP1511, MATH2069</p>
                    ) : (
                      <p className="text-xs text-gray-400 mt-1">Enter the course code as shown in your timetable</p>
                    )}
                  </div>
                ) : (
                  <>
                    <input
                      type="text"
                      value={courseId
                        ? (() => { const c = coursesData?.data.find((c: Course) => c.id === courseId); return c ? `${c.code} — ${c.name}` : courseSearch; })()
                        : courseSearch}
                      onChange={(e) => {
                        setCourseSearch(e.target.value);
                        setCourseId('');
                        setShowCourseDropdown(true);
                      }}
                      onFocus={() => setShowCourseDropdown(true)}
                      placeholder="Search course..."
                      className={selectCls + ' w-full'}
                    />
                    {showCourseDropdown && (
                      <div className="absolute z-20 left-0 right-0 top-full mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg shadow-lg max-h-52 overflow-y-auto text-sm">
                        {!coursesData?.data.length ? (
                          <p className="px-3 py-2 text-gray-400 text-xs">No courses found</p>
                        ) : (
                          coursesData.data.map((c: Course) => (
                            <button
                              key={c.id}
                              type="button"
                              onClick={() => {
                                setCourseId(c.id);
                                setCourseSearch('');
                                setShowCourseDropdown(false);
                              }}
                              className="w-full text-left px-3 py-2 hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-800 dark:text-gray-200"
                            >
                              <span className="font-medium">{c.code}</span>
                              <span className="text-gray-400 ml-1.5">— {c.name}</span>
                            </button>
                          ))
                        )}
                        <button
                          type="button"
                          onClick={() => {
                            setFreeTextMode(true);
                            setCourseId('');
                            setCourseSearch('');
                            setShowCourseDropdown(false);
                          }}
                          className="w-full text-left px-3 py-2 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 border-t border-gray-100 dark:border-gray-700 text-xs font-medium"
                        >
                          + My course isn't listed — enter it manually
                        </button>
                      </div>
                    )}
                  </>
                )}
              </div>
              <select value={semester} onChange={(e) => setSemester(e.target.value)} className={selectCls}>
                <option value="">Semester</option>
                {(professor?.allowed_semesters ?? ALL_SEMESTERS).map((s) => <option key={s}>{s}</option>)}
              </select>
              <select value={year} onChange={(e) => setYear(e.target.value ? Number(e.target.value) : '')} className={selectCls}>
                <option value="">Year</option>
                {YEARS.map((y) => <option key={y}>{y}</option>)}
              </select>
            </div>
          </section>

          {/* Would take again */}
          <section>
            <p className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Would you take this {roleLabel(professor?.title)} again?</p>
            <div className="flex gap-3">
              {[
                { value: true, label: 'Yes', color: 'green' },
                { value: false, label: 'No', color: 'red' },
              ].map(({ value, label, color }) => (
                <button
                  key={label}
                  type="button"
                  onClick={() => setWouldTakeAgain(wouldTakeAgain === value ? null : value)}
                  className={clsx(
                    'px-6 py-2.5 rounded-xl border text-sm font-medium transition-all',
                    wouldTakeAgain === value
                      ? color === 'green'
                        ? 'bg-green-600 border-green-600 text-white'
                        : 'bg-red-500 border-red-500 text-white'
                      : 'border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700'
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
          </section>

          {/* Difficulty */}
          <section>
            <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
              Difficulty (1 = Easy, 5 = Very Hard)
            </label>
            <div className="flex items-center gap-3">
              <StarRating value={difficultyRating} onChange={setDifficultyRating} size="md" />
              {difficultyRating > 0 && (
                <span className="text-sm text-gray-500 dark:text-gray-400">
                  {['','Very Easy','Easy','Moderate','Hard','Very Hard'][difficultyRating]}
                </span>
              )}
            </div>
          </section>

          {/* Criteria scores */}
          {criteriaData?.data && criteriaData.data.length > 0 && (
            <section>
              <div className="flex items-center justify-between mb-4">
                <p className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                  Rate by Category <span className="text-red-500">*</span>
                </p>
                {/* Live overall rating preview — updates as user rates each category */}
                {overallRatingRounded > 0 && (
                  <div className="flex items-center gap-2 bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800 rounded-xl px-3 py-1.5">
                    <span className="text-xs text-gray-500 dark:text-gray-400">Overall</span>
                    <span className={clsx(
                      'text-base font-bold',
                      overallRatingRounded >= 4 ? 'text-green-600 dark:text-green-400'
                        : overallRatingRounded >= 3 ? 'text-yellow-600 dark:text-yellow-400'
                        : 'text-red-600 dark:text-red-400'
                    )}>
                      {overallRating.toFixed(1)}
                    </span>
                    <span className="text-yellow-400 text-sm">{'★'.repeat(overallRatingRounded)}{'☆'.repeat(5 - overallRatingRounded)}</span>
                  </div>
                )}
              </div>
              <p className="text-xs text-gray-400 dark:text-gray-500 mb-4">
                Your overall rating is automatically calculated as the average of your category scores below.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {criteriaData.data.map((c) => (
                  <div key={c.id}>
                    <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">{c.name}</label>
                    <StarRating
                      value={criterionScores[c.id] ?? 0}
                      onChange={(v) => setCriterionScores((prev) => ({ ...prev, [c.id]: v }))}
                      size="sm"
                    />
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Tags */}
          {tagsData?.data && (
            <section>
              <p className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">Tags <span className="text-gray-400 font-normal">(pick up to 6)</span></p>
              <div className="flex flex-wrap gap-2 mt-3">
                {tagsData.data.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => toggleTag(t.id)}
                    className={clsx(
                      'text-xs px-3 py-1.5 rounded-full border transition-all',
                      tagIds.has(t.id)
                        ? t.is_positive
                          ? 'bg-green-600 border-green-600 text-white'
                          : 'bg-orange-500 border-orange-500 text-white'
                        : 'border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700',
                      !tagIds.has(t.id) && tagIds.size >= 6 && 'opacity-40 cursor-not-allowed'
                    )}
                  >
                    {t.name}
                  </button>
                ))}
              </div>
            </section>
          )}

          {/* Comment */}
          <section>
            <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
              Written Review <span className="text-gray-400 font-normal">(recommended)</span>
            </label>

            {/* Inline guidelines */}
            <div className="mb-3 bg-blue-50 dark:bg-blue-950/30 border border-blue-100 dark:border-blue-800/50 rounded-xl px-4 py-3 text-xs text-gray-600 dark:text-gray-400 space-y-1">
              <p className="font-semibold text-blue-700 dark:text-blue-400 mb-1.5">Quick guidelines</p>
              <ul className="space-y-1">
                <li className="flex items-start gap-1.5"><span className="text-green-500 mt-0.5">✓</span> Focus on teaching style, clarity, and helpfulness</li>
                <li className="flex items-start gap-1.5"><span className="text-green-500 mt-0.5">✓</span> Be specific — mention what worked and what didn't</li>
                <li className="flex items-start gap-1.5"><span className="text-green-500 mt-0.5">✓</span> Keep it respectful and based on your own experience</li>
                <li className="flex items-start gap-1.5"><span className="text-red-400 mt-0.5">✗</span> No personal attacks, profanity, or private information</li>
                <li className="flex items-start gap-1.5"><span className="text-red-400 mt-0.5">✗</span> No false statements of fact — opinion must be clearly framed as opinion</li>
              </ul>
              <p className="pt-1">
                <a href="/guidelines" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline font-medium">
                  Read the full Community Guidelines →
                </a>
              </p>
            </div>

            <textarea
              rows={5}
              value={comment}
              onChange={(e) => { setComment(e.target.value); setQualityFeedback(null); setQualityScore(null); }}
              onBlur={checkQuality}
              maxLength={3000}
              placeholder="Share your experience: teaching style, clarity, helpfulness, tips for future students..."
              className="w-full border border-gray-300 dark:border-gray-600 rounded-xl px-4 py-3 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-400 resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <div className="flex justify-between mt-1">
              {comment.length > 0 && comment.length < 15 ? (
                <p className="text-xs text-red-500">{15 - comment.length} more character{15 - comment.length !== 1 ? 's' : ''} needed</p>
              ) : <span />}
              <p className="text-xs text-gray-400">{comment.length}/3000</p>
            </div>

            {/* AI quality feedback */}
            {qualityChecking && (
              <div className="mt-2 flex items-center gap-2 text-xs text-gray-400">
                <svg className="animate-spin w-3 h-3" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                </svg>
                Checking review quality…
              </div>
            )}
            {!qualityChecking && qualityScore != null && qualityScore >= 80 && (
              <div className="mt-2 flex items-center gap-2 text-xs text-green-600 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-700 rounded-lg px-3 py-2">
                <span>✓</span> Great review! Looks specific and helpful.
              </div>
            )}
            {!qualityChecking && qualityFeedback && qualityScore != null && qualityScore < 80 && (
              <div className="mt-2 text-xs bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-lg px-3 py-2 text-amber-800 dark:text-amber-300">
                <span className="font-semibold">Tip: </span>{qualityFeedback}
              </div>
            )}
          </section>

          {/* Anonymous toggle */}
          <section className="flex items-center justify-between bg-gray-50 dark:bg-gray-700/50 rounded-xl px-4 py-3">
            <div>
              <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Post anonymously</p>
              <p className="text-xs text-gray-400">Your username will be hidden from other students</p>
            </div>
            <button
              type="button"
              onClick={() => setIsAnonymous(!isAnonymous)}
              className={clsx(
                'relative w-11 h-6 rounded-full transition-colors',
                isAnonymous ? 'bg-blue-600' : 'bg-gray-300 dark:bg-gray-600'
              )}
            >
              <span
                className={clsx(
                  'absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform',
                  isAnonymous ? 'translate-x-5' : 'translate-x-0'
                )}
              />
            </button>
          </section>

          {/* T&C consent */}
          <section>
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={agreedToTerms}
                onChange={(e) => setAgreedToTerms(e.target.checked)}
                className="mt-0.5 w-4 h-4 accent-blue-600 flex-shrink-0"
              />
              <span className="text-sm text-gray-600 dark:text-gray-400">
                I confirm this review is based on my genuine first-hand experience, contains no
                defamatory or offensive content, and complies with the{' '}
                <a href="/guidelines" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                  Community Guidelines
                </a>
                ,{' '}
                <a href="/terms" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                  Terms of Service
                </a>
                , and{' '}
                <a href="/privacy" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                  Privacy Policy
                </a>. I understand that false or defamatory reviews may be removed and my account may be suspended.
              </span>
            </label>
          </section>

          {/* Error */}
          {error && (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 text-red-700 dark:text-red-400 text-sm px-4 py-3 rounded-xl">
              {error}
            </div>
          )}

          {/* Submit */}
          <div className="pt-2">
            <button
              type="submit"
              disabled={
        submitting ||
        criteriaValues.length === 0 ||
        (comment.length > 0 && comment.length < 15) ||
        (comment.trim().length > 0 && hasProfanity(comment.trim())) ||
        !agreedToTerms ||
        // Course details required
        (!courseId && !(freeTextMode && courseText.trim())) ||
        (freeTextMode && !!courseText && (!COURSE_CODE_RE.test(courseText.trim()) || hasProfanity(courseText.trim()))) ||
        !semester ||
        !year
      }
              title={criteriaValues.length === 0 ? 'Rate at least one category to submit' : undefined}
              className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold py-3 rounded-xl transition-colors shadow-md text-base"
            >
              {submitting ? 'Submitting...' : 'Submit Review'}
            </button>
            <p className="text-xs text-gray-400 text-center mt-3">
              Reviews are moderated before being published. Please follow our community guidelines.
            </p>
          </div>
        </form>
      </div>
    </div>
  );
}
