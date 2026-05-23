'use client';

import { useState, useEffect, useCallback, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useQuery, useMutation } from '@tanstack/react-query';
import { professors as profApi, institutions as instApi } from '@/lib/api';
import { ProfessorCard } from '@/components/ProfessorCard';
import { Pagination } from '@/components/Pagination';
import { useAuth } from '@/lib/auth-context';

const TITLES = ['Professor', 'Associate Professor', 'Assistant Professor', 'Lecturer', 'Senior Lecturer', 'Adjunct Professor', 'Tutor', 'Teaching Assistant', 'Industry Fellow'];

function ProfessorsPageInner() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { isAuthenticated, user, token } = useAuth();

  const [search, setSearch] = useState(searchParams.get('search') ?? '');
  const [institutionId, setInstitutionId] = useState<number | undefined>(
    searchParams.get('institution') ? Number(searchParams.get('institution')) : undefined
  );
  const [departmentId, setDepartmentId] = useState<number | undefined>(
    searchParams.get('department') ? Number(searchParams.get('department')) : undefined
  );
  const [sort, setSort] = useState<'rating' | 'reviews' | 'name'>(() => {
    const fromUrl = searchParams.get('sort') as 'rating' | 'reviews' | 'name' | null;
    if (fromUrl) return fromUrl;
    try {
      const saved = typeof window !== 'undefined' ? localStorage.getItem('mur_prof_sort') : null;
      if (saved === 'rating' || saved === 'reviews' || saved === 'name') return saved;
    } catch {}
    return 'rating';
  });
  const [page, setPage] = useState(Number(searchParams.get('page') ?? '1'));

  const [showSuggest, setShowSuggest] = useState(false);
  const [suggestForm, setSuggestForm] = useState({
    first_name: '', last_name: '', title: 'Lecturer',
    institution_id: '', department_id: '', email: '', notes: '',
  });
  const [suggestSuccess, setSuggestSuccess] = useState(false);

  const pushParams = useCallback((overrides: { search?: string; institution?: number | undefined; department?: number | undefined; sort?: string; page?: number }) => {
    const params = new URLSearchParams();
    const s = overrides.search ?? search;
    const inst = 'institution' in overrides ? overrides.institution : institutionId;
    const dept = 'department' in overrides ? overrides.department : departmentId;
    const so = overrides.sort ?? sort;
    const pg = overrides.page ?? page;
    if (s) params.set('search', s);
    if (inst) params.set('institution', String(inst));
    if (dept) params.set('department', String(dept));
    if (so !== 'rating') params.set('sort', so);
    if (pg > 1) params.set('page', String(pg));
    router.replace(`/professors${params.toString() ? `?${params.toString()}` : ''}`, { scroll: false });
  }, [search, institutionId, departmentId, sort, page, router]);

  // Persist sort preference to localStorage
  useEffect(() => {
    try { localStorage.setItem('mur_prof_sort', sort); } catch {}
  }, [sort]);

  // Sync state from URL on browser back/forward
  useEffect(() => {
    setSearch(searchParams.get('search') ?? '');
    setInstitutionId(searchParams.get('institution') ? Number(searchParams.get('institution')) : undefined);
    setDepartmentId(searchParams.get('department') ? Number(searchParams.get('department')) : undefined);
    setSort((searchParams.get('sort') as 'rating' | 'reviews' | 'name') ?? (() => {
      try {
        const saved = localStorage.getItem('mur_prof_sort');
        if (saved === 'rating' || saved === 'reviews' || saved === 'name') return saved;
      } catch {}
      return 'rating';
    })());
    setPage(Number(searchParams.get('page') ?? '1'));
  }, [searchParams]);

  // Auto-open suggest modal when ?suggest=1 — runs after auth hydrates
  useEffect(() => {
    if (searchParams.get('suggest') === '1' && isAuthenticated && user?.email_verified) {
      openSuggest();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated, user?.email_verified]);

  const { data: institutionsData } = useQuery({
    queryKey: ['institutions'],
    queryFn: () => instApi.list({ limit: 100 } as never),
    staleTime: Infinity, // institutions list almost never changes
    gcTime: Infinity,
  });

  const { data: filterInstData } = useQuery({
    queryKey: ['institution', institutionId],
    queryFn: () => instApi.get(institutionId!),
    enabled: !!institutionId,
  });
  const filterDepts = filterInstData?.data?.departments ?? [];

  const { data: selectedInstData } = useQuery({
    queryKey: ['institution', suggestForm.institution_id],
    queryFn: () => instApi.get(Number(suggestForm.institution_id)),
    enabled: !!suggestForm.institution_id,
  });

  const { data, isLoading, isError } = useQuery({
    queryKey: ['professors', search, institutionId, departmentId, sort, page],
    queryFn: () => profApi.list({ search: search || undefined, institution_id: institutionId, department_id: departmentId, sort, page, limit: 12 }),
    placeholderData: (prev) => prev,
  });

  const suggestMutation = useMutation({
    // Accept token as argument so we always use the freshest value at call time,
    // not the stale one captured in the closure when the hook ran.
    mutationFn: (currentToken: string) => profApi.suggest({
      institution_id: Number(suggestForm.institution_id),
      first_name: suggestForm.first_name.trim(),
      last_name: suggestForm.last_name.trim(),
      department_id: suggestForm.department_id ? Number(suggestForm.department_id) : undefined,
      title: suggestForm.title || undefined,
      email: suggestForm.email.trim() || undefined,
      notes: suggestForm.notes.trim() || undefined,
    }, currentToken),
    onSuccess: () => setSuggestSuccess(true),
  });

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    setPage(1);
    pushParams({ page: 1 });
  }

  function openSuggest() {
    setSuggestSuccess(false);
    setSuggestForm({ first_name: '', last_name: '', title: 'Lecturer', institution_id: '', department_id: '', email: '', notes: '' });
    setShowSuggest(true);
  }

  const canSubmitSuggest = suggestForm.first_name.trim() && suggestForm.last_name.trim() && suggestForm.institution_id;

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">Browse Professors</h1>
        {isAuthenticated && user?.email_verified && (
          <button
            onClick={openSuggest}
            className="text-sm bg-blue-50 hover:bg-blue-100 text-blue-700 font-medium px-4 py-2.5 rounded-xl border border-blue-200 transition-colors min-h-[44px]"
          >
            + Add a Professor
          </button>
        )}
      </div>

      {searchParams.get('welcome') === '1' && (
        <div className="mb-6 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-700 text-green-800 dark:text-green-300 text-sm px-4 py-3 rounded-xl flex items-center gap-3">
          <span className="text-lg">🎉</span>
          <span><span className="font-medium">Welcome to MyUniReviews!</span> Verify your email, then find a professor to write your first review.</span>
        </div>
      )}

      <div className="flex flex-col gap-3 mb-8">
        <form onSubmit={handleSearch} className="flex w-full">
          <input
            type="text"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            placeholder="Search by name..."
            className="flex-1 min-w-0 border border-gray-300 dark:border-gray-600 rounded-l-lg px-4 py-3 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button type="submit" className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-3 rounded-r-lg text-sm font-medium min-h-[44px]">
            Search
          </button>
        </form>

        <div className="flex flex-col sm:flex-row gap-3">
          <select
            value={institutionId ?? ''}
            onChange={(e) => {
              const val = e.target.value ? Number(e.target.value) : undefined;
              setInstitutionId(val); setDepartmentId(undefined); setPage(1);
              pushParams({ institution: val, department: undefined, page: 1 });
            }}
            className="flex-1 border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 min-h-[44px]"
          >
            <option value="">All Institutions</option>
            {institutionsData?.data.map((inst) => (
              <option key={inst.id} value={inst.id}>{inst.name}</option>
            ))}
          </select>

          {filterDepts.length > 0 && (
            <select
              value={departmentId ?? ''}
              onChange={(e) => {
                const val = e.target.value ? Number(e.target.value) : undefined;
                setDepartmentId(val); setPage(1);
                pushParams({ department: val, page: 1 });
              }}
              className="flex-1 border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 min-h-[44px]"
            >
              <option value="">All Departments</option>
              {filterDepts.map((d) => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </select>
          )}

          <select
            value={sort}
            onChange={(e) => {
              const val = e.target.value as typeof sort;
              setSort(val); setPage(1);
              pushParams({ sort: val, page: 1 });
            }}
            className="flex-1 border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 min-h-[44px]"
          >
            <option value="rating">Sort: Highest Rated</option>
            <option value="reviews">Sort: Most Reviewed</option>
            <option value="name">Sort: Name A–Z</option>
          </select>
        </div>
      </div>

      {data && (
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
          {data.pagination.total} professor{data.pagination.total !== 1 ? 's' : ''}
          {search && <> matching &ldquo;<span className="font-medium text-gray-700 dark:text-gray-300">{search}</span>&rdquo;</>}
        </p>
      )}

      {isLoading && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 9 }).map((_, i) => (
            <div key={i} className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 h-40 animate-pulse" />
          ))}
        </div>
      )}

      {isError && <div className="text-center py-20 text-red-500">Failed to load professors. Please try again.</div>}

      {data?.data && data.data.length === 0 && (
        <div className="text-center py-20">
          <p className="text-gray-400 dark:text-gray-500 text-lg mb-2">No professors found</p>
          <p className="text-gray-400 dark:text-gray-500 text-sm mb-4">Try a different search or clear the filters.</p>
          {isAuthenticated && user?.email_verified && (
            <button onClick={openSuggest} className="text-blue-600 hover:underline text-sm">
              Can&apos;t find your professor? Add them →
            </button>
          )}
        </div>
      )}

      {data?.data && data.data.length > 0 && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {data.data.map((p) => <ProfessorCard key={p.id} professor={p} />)}
          </div>
          <Pagination page={page} totalPages={data.pagination.totalPages} onPageChange={(p) => { setPage(p); pushParams({ page: p }); }} />
        </>
      )}

      {/* Suggest modal */}
      {showSuggest && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center px-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto">
            {suggestSuccess ? (
              <div className="text-center py-6 space-y-3">
                <div className="text-4xl">✅</div>
                <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">Suggestion submitted!</h2>
                <p className="text-sm text-gray-500 dark:text-gray-400">Our moderators will review and add the professor shortly.</p>
                <button onClick={() => setShowSuggest(false)} className="mt-2 text-sm text-blue-600 hover:underline">
                  Close
                </button>
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between mb-5">
                  <div>
                    <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">Add a Professor</h2>
                    <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">Your suggestion will be reviewed before it goes live.</p>
                  </div>
                  <button onClick={() => setShowSuggest(false)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 text-2xl leading-none w-8 h-8 flex items-center justify-center">×</button>
                </div>

                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">First name <span className="text-red-500">*</span></label>
                      <input
                        type="text"
                        value={suggestForm.first_name}
                        onChange={(e) => setSuggestForm((f) => ({ ...f, first_name: e.target.value }))}
                        className="w-full border border-gray-300 dark:border-gray-600 rounded-xl px-3 py-2.5 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="e.g. James"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Last name <span className="text-red-500">*</span></label>
                      <input
                        type="text"
                        value={suggestForm.last_name}
                        onChange={(e) => setSuggestForm((f) => ({ ...f, last_name: e.target.value }))}
                        className="w-full border border-gray-300 dark:border-gray-600 rounded-xl px-3 py-2.5 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="e.g. Smith"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Title</label>
                    <select
                      value={suggestForm.title}
                      onChange={(e) => setSuggestForm((f) => ({ ...f, title: e.target.value }))}
                      className="w-full border border-gray-300 dark:border-gray-600 rounded-xl px-3 py-2.5 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      {TITLES.map((t) => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">University <span className="text-red-500">*</span></label>
                    <select
                      value={suggestForm.institution_id}
                      onChange={(e) => setSuggestForm((f) => ({ ...f, institution_id: e.target.value, department_id: '' }))}
                      className="w-full border border-gray-300 dark:border-gray-600 rounded-xl px-3 py-2.5 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">Select university</option>
                      {institutionsData?.data.map((inst) => (
                        <option key={inst.id} value={inst.id}>{inst.name}</option>
                      ))}
                    </select>
                  </div>

                  {(selectedInstData?.data?.departments?.length ?? 0) > 0 && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Department <span className="text-gray-400 dark:text-gray-500 font-normal">(optional)</span></label>
                      <select
                        value={suggestForm.department_id}
                        onChange={(e) => setSuggestForm((f) => ({ ...f, department_id: e.target.value }))}
                        className="w-full border border-gray-300 dark:border-gray-600 rounded-xl px-3 py-2.5 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="">Select department</option>
                        {selectedInstData?.data?.departments?.map((d) => (
                          <option key={d.id} value={d.id}>{d.name}</option>
                        ))}
                      </select>
                    </div>
                  )}

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">University email <span className="text-gray-400 dark:text-gray-500 font-normal">(optional)</span></label>
                    <input
                      type="email"
                      value={suggestForm.email}
                      onChange={(e) => setSuggestForm((f) => ({ ...f, email: e.target.value }))}
                      placeholder="e.g. j.smith@uni.sydney.edu.au"
                      className="w-full border border-gray-300 dark:border-gray-600 rounded-xl px-3 py-2.5 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Notes <span className="text-gray-400 dark:text-gray-500 font-normal">(optional)</span></label>
                    <textarea
                      rows={2}
                      value={suggestForm.notes}
                      onChange={(e) => setSuggestForm((f) => ({ ...f, notes: e.target.value }))}
                      placeholder="Any additional info to help verify..."
                      className="w-full border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 rounded-xl px-3 py-2.5 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  {suggestMutation.error && (
                    <p className="text-sm text-red-600">{(suggestMutation.error as Error).message}</p>
                  )}

                  <div className="flex gap-3 pt-1">
                    <button
                      onClick={() => suggestMutation.mutate(token!)}
                      disabled={!canSubmitSuggest || suggestMutation.isPending}
                      className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-semibold py-2.5 rounded-xl text-sm transition-colors"
                    >
                      {suggestMutation.isPending ? 'Submitting…' : 'Submit Suggestion'}
                    </button>
                    <button
                      onClick={() => setShowSuggest(false)}
                      className="px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-xl text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default function ProfessorsPage() {
  return (
    <Suspense fallback={<div className="max-w-6xl mx-auto px-4 py-8 animate-pulse" />}>
      <ProfessorsPageInner />
    </Suspense>
  );
}
