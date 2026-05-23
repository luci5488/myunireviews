'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/lib/auth-context';
import { auth as authApi, moderation as modApi } from '@/lib/api';
import { StarRating } from '@/components/StarRating';
import { Pagination } from '@/components/Pagination';
import { clsx } from 'clsx';

type Tab = 'pending' | 'flagged' | 'reports' | 'claims' | 'suggestions' | 'students';

export default function ModerationPage() {
  const { token, isModerator, isAdmin, hydrated, login } = useAuth();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<Tab>('pending');
  const [page, setPage] = useState(1);
  const [rejectReason, setRejectReason] = useState<Record<number, string>>({});
  const [reportActionReason, setReportActionReason] = useState<Record<number, string>>({});
  const [claimRejectReason, setClaimRejectReason] = useState<Record<number, string>>({});
  const [suggestionRejectReason, setSuggestionRejectReason] = useState<Record<number, string>>({});
  const [banReason, setBanReason] = useState<Record<number, string>>({});
  const [mutationError, setMutationError] = useState<string | null>(null);

  useEffect(() => {
    if (hydrated && !isModerator) router.push('/');
  }, [hydrated, isModerator, router]);

  const reviewQueue = useQuery({
    queryKey: ['mod-queue', tab, page],
    queryFn: () => modApi.queue(tab as 'pending' | 'flagged', { page }, token!),
    enabled: (tab === 'pending' || tab === 'flagged') && !!token,
  });

  const reportsQueue = useQuery({
    queryKey: ['mod-reports', page],
    queryFn: () => modApi.reports({ page }, token!),
    enabled: tab === 'reports' && !!token,
  });

  const suggestionsQuery = useQuery({
    queryKey: ['mod-suggestions', page],
    queryFn: () => modApi.suggestions({ page }, token!),
    enabled: tab === 'suggestions' && !!token,
  });

  const claimsQuery = useQuery({
    queryKey: ['mod-claims', page],
    queryFn: () => modApi.claims({ page }, token!),
    enabled: tab === 'claims' && !!token,
  });

  const studentsQuery = useQuery({
    queryKey: ['mod-students', page],
    queryFn: () => modApi.students({ page }, token!),
    enabled: tab === 'students' && isAdmin && !!token,
  });

  const onError = (err: unknown) =>
    setMutationError((err as Error).message ?? 'Action failed — please try again.');

  const approveMutation = useMutation({
    mutationFn: (id: number) => withFresh(t => modApi.approve(id, t)),
    onSuccess: () => { setMutationError(null); queryClient.invalidateQueries({ queryKey: ['mod-queue'] }); },
    onError,
  });

  const rejectMutation = useMutation({
    mutationFn: ({ id, reason }: { id: number; reason: string }) => withFresh(t => modApi.reject(id, reason, t)),
    onSuccess: () => { setMutationError(null); queryClient.invalidateQueries({ queryKey: ['mod-queue'] }); },
    onError,
  });

  const dismissMutation = useMutation({
    mutationFn: ({ id, note }: { id: number; note?: string }) => withFresh(t => modApi.dismissReport(id, note, t)),
    onSuccess: () => { setMutationError(null); queryClient.invalidateQueries({ queryKey: ['mod-reports'] }); },
    onError,
  });

  const actionMutation = useMutation({
    mutationFn: ({ id, reason }: { id: number; reason: string }) => withFresh(t => modApi.actionReport(id, reason, t)),
    onSuccess: () => { setMutationError(null); queryClient.invalidateQueries({ queryKey: ['mod-reports'] }); },
    onError,
  });

  const approveSuggestionMutation = useMutation({
    mutationFn: (id: number) => withFresh(t => modApi.approveSuggestion(id, t)),
    onSuccess: () => { setMutationError(null); queryClient.invalidateQueries({ queryKey: ['mod-suggestions'] }); },
    onError,
  });

  const rejectSuggestionMutation = useMutation({
    mutationFn: ({ id, reason }: { id: number; reason: string }) => withFresh(t => modApi.rejectSuggestion(id, reason, t)),
    onSuccess: () => { setMutationError(null); queryClient.invalidateQueries({ queryKey: ['mod-suggestions'] }); },
    onError,
  });

  const approveClaimMutation = useMutation({
    mutationFn: (id: number) => withFresh(t => modApi.approveClaim(id, t)),
    onSuccess: () => { setMutationError(null); queryClient.invalidateQueries({ queryKey: ['mod-claims'] }); },
    onError,
  });

  const rejectClaimMutation = useMutation({
    mutationFn: ({ id, reason }: { id: number; reason: string }) => withFresh(t => modApi.rejectClaim(id, reason, t)),
    onSuccess: () => { setMutationError(null); queryClient.invalidateQueries({ queryKey: ['mod-claims'] }); },
    onError,
  });

  const banMutation = useMutation({
    mutationFn: ({ id, reason }: { id: number; reason: string }) => withFresh(t => modApi.ban(id, reason, t)),
    onSuccess: () => { setMutationError(null); queryClient.invalidateQueries({ queryKey: ['mod-students'] }); },
    onError,
  });

  const unbanMutation = useMutation({
    mutationFn: (id: number) => withFresh(t => modApi.unban(id, t)),
    onSuccess: () => { setMutationError(null); queryClient.invalidateQueries({ queryKey: ['mod-students'] }); },
    onError,
  });

  // Refresh token before every moderation action — moderators often keep the page
  // open for extended periods while reviewing content.
  async function withFresh<T>(fn: (freshToken: string) => Promise<T>): Promise<T> {
    const refreshed = await authApi.me();
    login(refreshed.token, refreshed.data);
    return fn(refreshed.token);
  }

  if (!hydrated || !isModerator) return null;

  const tabs: { key: Tab; label: string; adminOnly?: boolean }[] = [
    { key: 'pending', label: 'Pending Reviews' },
    { key: 'flagged', label: 'Flagged Reviews' },
    { key: 'reports', label: 'Reports' },
    { key: 'claims', label: 'Claims' },
    { key: 'suggestions', label: 'Suggestions' },
    { key: 'students', label: 'Students', adminOnly: true },
  ];

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-2">Moderation Dashboard</h1>
      <p className="text-gray-500 dark:text-gray-400 text-sm mb-8">Review and manage submitted content to keep the platform fair and accurate.</p>

      {mutationError && (
        <div className="mb-6 flex items-center justify-between gap-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 text-red-700 dark:text-red-400 text-sm px-4 py-3 rounded-xl">
          <span>⚠️ {mutationError}</span>
          <button onClick={() => setMutationError(null)} className="text-red-400 hover:text-red-600 dark:hover:text-red-300 text-lg leading-none">×</button>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 border-b border-gray-200 dark:border-gray-700 mb-8 overflow-x-auto">
        {tabs.filter((t) => !t.adminOnly || isAdmin).map(({ key, label }) => (
          <button
            key={key}
            onClick={() => { setTab(key); setPage(1); }}
            className={clsx(
              'px-4 py-2.5 text-sm font-medium whitespace-nowrap border-b-2 transition-colors',
              tab === key
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Pending / Flagged review queue */}
      {(tab === 'pending' || tab === 'flagged') && (
        <div className="space-y-4">
          {reviewQueue.isLoading && <div className="text-center text-gray-400 py-12">Loading...</div>}

          {reviewQueue.data?.data.length === 0 && (
            <div className="text-center py-20 text-gray-400">
              No {tab} reviews — all clear!
            </div>
          )}

          {reviewQueue.data?.data.map((r) => (
            <div key={r.id} className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm p-5">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap text-sm">
                    <StarRating value={r.overall_rating} size="sm" />
                    <span className="font-medium">{r.professor_first_name} {r.professor_last_name}</span>
                    {r.course_code
                      ? (
                        <span className="text-gray-400 text-xs font-mono bg-gray-100 dark:bg-gray-700 px-1.5 py-0.5 rounded">
                          {r.course_code}
                        </span>
                      )
                      : r.course_text && (
                        <span
                          title="Course entered manually by the student — not linked to a verified course"
                          className="text-xs font-mono bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-700 px-1.5 py-0.5 rounded"
                        >
                          {r.course_text} ⚠
                        </span>
                      )
                    }
                    {r.pending_reports > 0 && (
                      <span className="bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400 text-xs px-2 py-0.5 rounded-full">
                        {r.pending_reports} report{r.pending_reports > 1 ? 's' : ''}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-gray-400 mt-1">
                    By {r.reviewer_username} · {new Date(r.created_at).toLocaleDateString()}
                  </p>
                  {r.comment && (
                    <p className="text-sm text-gray-700 dark:text-gray-300 mt-2 leading-relaxed line-clamp-3">{r.comment}</p>
                  )}
                </div>
              </div>

              <div className="mt-4 flex items-center gap-3 flex-wrap">
                <button
                  onClick={() => approveMutation.mutate(r.id)}
                  disabled={approveMutation.isPending}
                  className="text-sm bg-green-600 hover:bg-green-700 text-white px-4 py-1.5 rounded-lg font-medium transition-colors"
                >
                  Approve
                </button>

                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <input
                    type="text"
                    placeholder="Rejection reason (required)..."
                    value={rejectReason[r.id] ?? ''}
                    onChange={(e) => setRejectReason((p) => ({ ...p, [r.id]: e.target.value }))}
                    className="flex-1 border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-1.5 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-red-300 min-w-0"
                  />
                  <button
                    onClick={() => {
                      if (rejectReason[r.id]?.trim()) rejectMutation.mutate({ id: r.id, reason: rejectReason[r.id] });
                    }}
                    disabled={!rejectReason[r.id]?.trim() || rejectMutation.isPending}
                    className="text-sm bg-red-500 hover:bg-red-600 disabled:opacity-40 text-white px-4 py-1.5 rounded-lg font-medium transition-colors whitespace-nowrap"
                  >
                    Reject
                  </button>
                </div>
              </div>
            </div>
          ))}

          {reviewQueue.data && (
            <Pagination
              page={page}
              totalPages={reviewQueue.data.pagination.totalPages}
              onPageChange={setPage}
            />
          )}
        </div>
      )}

      {/* Reports queue */}
      {tab === 'reports' && (
        <div className="space-y-4">
          {reportsQueue.isLoading && <div className="text-center text-gray-400 py-12">Loading...</div>}

          {reportsQueue.data?.data.length === 0 && (
            <div className="text-center py-20 text-gray-400">No pending reports — all clear!</div>
          )}

          {reportsQueue.data?.data.map((report) => (
            <div key={report.id} className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
              <div className="flex items-start gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap text-sm">
                    <span className="font-medium text-red-600">Report</span>
                    <span className="text-gray-400">for review of</span>
                    <span className="font-medium">{report.professor_first_name} {report.professor_last_name}</span>
                  </div>
                  {report.report_reason && (
                    <p className="text-xs bg-orange-50 dark:bg-orange-900/20 text-orange-700 dark:text-orange-400 inline-block px-2 py-0.5 rounded mt-1">
                      {report.report_reason}
                    </p>
                  )}
                  {report.review_comment && (
                    <div className="mt-2 bg-gray-50 dark:bg-gray-700 rounded-lg p-3 text-sm text-gray-700 dark:text-gray-300 border border-gray-100 dark:border-gray-600">
                      <p className="text-xs text-gray-400 mb-1">Review content:</p>
                      <p className="line-clamp-3">{report.review_comment}</p>
                    </div>
                  )}
                  {report.additional_info && (
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-2 italic">"{report.additional_info}"</p>
                  )}
                  <p className="text-xs text-gray-400 mt-2">
                    Reported by {report.reported_by_username} · {new Date(report.created_at).toLocaleDateString()}
                  </p>
                </div>
              </div>

              <div className="mt-4 flex items-center gap-3 flex-wrap">
                <button
                  onClick={() => dismissMutation.mutate({ id: report.id })}
                  disabled={dismissMutation.isPending}
                  className="text-sm border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 px-4 py-1.5 rounded-lg font-medium transition-colors"
                >
                  Dismiss
                </button>
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <input
                    type="text"
                    placeholder="Removal reason (required)..."
                    value={reportActionReason[report.id] ?? report.report_reason ?? ''}
                    onChange={(e) => setReportActionReason((p) => ({ ...p, [report.id]: e.target.value }))}
                    className="flex-1 border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-1.5 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-red-300 min-w-0"
                  />
                  <button
                    onClick={() => {
                      const reason = reportActionReason[report.id] ?? report.report_reason ?? '';
                      if (reason.trim()) actionMutation.mutate({ id: report.id, reason: reason.trim() });
                    }}
                    disabled={!(reportActionReason[report.id] ?? report.report_reason ?? '').trim() || actionMutation.isPending}
                    className="text-sm bg-red-500 hover:bg-red-600 disabled:opacity-40 text-white px-4 py-1.5 rounded-lg font-medium transition-colors whitespace-nowrap"
                  >
                    Remove Review
                  </button>
                </div>
              </div>
            </div>
          ))}

          {reportsQueue.data && (
            <Pagination
              page={page}
              totalPages={reportsQueue.data.pagination.totalPages}
              onPageChange={setPage}
            />
          )}
        </div>
      )}

      {/* Claims queue */}
      {tab === 'claims' && (
        <div className="space-y-4">
          {claimsQuery.isLoading && <div className="text-center text-gray-400 py-12">Loading...</div>}

          {claimsQuery.data?.data.length === 0 && (
            <div className="text-center py-20 text-gray-400">No pending claims — all clear!</div>
          )}

          {claimsQuery.data?.data.map((claim) => (
            <div key={claim.id} className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
              <div className="flex items-start gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap text-sm">
                    <span className="font-medium text-blue-700 dark:text-blue-400">Profile Claim</span>
                    <span className="text-gray-400">for</span>
                    <span className="font-medium">{claim.professor_first_name} {claim.professor_last_name}</span>
                    {claim.institution_name && (
                      <span className="text-gray-400 text-xs">· {claim.institution_name}</span>
                    )}
                  </div>
                  <p className="text-xs text-gray-400 mt-1">
                    By {claim.claimant_username} ({claim.claimant_email}) · {new Date(claim.created_at).toLocaleDateString()}
                  </p>
                  <div className="mt-2 space-y-1">
                    {claim.institution_email && (
                      <p className="text-sm text-gray-700 dark:text-gray-300">
                        <span className="text-xs text-gray-400 mr-1">Institutional email:</span>
                        {claim.institution_email}
                      </p>
                    )}
                    {claim.staff_id && (
                      <p className="text-sm text-gray-700 dark:text-gray-300">
                        <span className="text-xs text-gray-400 mr-1">Staff ID:</span>
                        {claim.staff_id}
                      </p>
                    )}
                    {claim.additional_info && (
                      <p className="text-sm text-gray-500 italic">"{claim.additional_info}"</p>
                    )}
                  </div>
                </div>
              </div>

              <div className="mt-4 flex items-center gap-3 flex-wrap">
                <button
                  onClick={() => approveClaimMutation.mutate(claim.id)}
                  disabled={approveClaimMutation.isPending}
                  className="text-sm bg-green-600 hover:bg-green-700 text-white px-4 py-1.5 rounded-lg font-medium transition-colors"
                >
                  Approve
                </button>

                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <input
                    type="text"
                    placeholder="Rejection reason (required)..."
                    value={claimRejectReason[claim.id] ?? ''}
                    onChange={(e) => setClaimRejectReason((p) => ({ ...p, [claim.id]: e.target.value }))}
                    className="flex-1 border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-1.5 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-red-300 min-w-0"
                  />
                  <button
                    onClick={() => {
                      if (claimRejectReason[claim.id]?.trim())
                        rejectClaimMutation.mutate({ id: claim.id, reason: claimRejectReason[claim.id] });
                    }}
                    disabled={!claimRejectReason[claim.id]?.trim() || rejectClaimMutation.isPending}
                    className="text-sm bg-red-500 hover:bg-red-600 disabled:opacity-40 text-white px-4 py-1.5 rounded-lg font-medium transition-colors whitespace-nowrap"
                  >
                    Reject
                  </button>
                </div>
              </div>
            </div>
          ))}

          {claimsQuery.data && (
            <Pagination
              page={page}
              totalPages={claimsQuery.data.pagination.totalPages}
              onPageChange={setPage}
            />
          )}
        </div>
      )}

      {/* Suggestions queue */}
      {tab === 'suggestions' && (
        <div className="space-y-4">
          {suggestionsQuery.isLoading && <div className="text-center text-gray-400 py-12">Loading...</div>}

          {suggestionsQuery.data?.data.length === 0 && (
            <div className="text-center py-20 text-gray-400">No pending suggestions — all clear!</div>
          )}

          {suggestionsQuery.data?.data.map((s) => (
            <div key={s.id} className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap text-sm">
                  <span className="font-medium text-purple-700 dark:text-purple-400">New Professor</span>
                  <span className="font-medium">{s.title} {s.first_name} {s.last_name}</span>
                </div>
                <p className="text-xs text-gray-400 mt-1">
                  Suggested by {s.suggested_by_username} · {new Date(s.created_at).toLocaleDateString()}
                </p>
                <div className="mt-2 space-y-0.5 text-sm text-gray-700 dark:text-gray-300">
                  {s.institution_name && <p><span className="text-xs text-gray-400 mr-1">University:</span>{s.institution_name}</p>}
                  {s.department_name && <p><span className="text-xs text-gray-400 mr-1">Department:</span>{s.department_name}</p>}
                  {s.email && <p><span className="text-xs text-gray-400 mr-1">Email:</span>{s.email}</p>}
                  {s.notes && <p className="text-gray-500 italic mt-1">"{s.notes}"</p>}
                </div>
              </div>

              <div className="mt-4 flex items-center gap-3 flex-wrap">
                <button
                  onClick={() => approveSuggestionMutation.mutate(s.id)}
                  disabled={approveSuggestionMutation.isPending}
                  className="text-sm bg-green-600 hover:bg-green-700 text-white px-4 py-1.5 rounded-lg font-medium transition-colors"
                >
                  Approve & Add
                </button>

                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <input
                    type="text"
                    placeholder="Rejection reason (required)..."
                    value={suggestionRejectReason[s.id] ?? ''}
                    onChange={(e) => setSuggestionRejectReason((p) => ({ ...p, [s.id]: e.target.value }))}
                    className="flex-1 border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-1.5 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-red-300 min-w-0"
                  />
                  <button
                    onClick={() => {
                      if (suggestionRejectReason[s.id]?.trim())
                        rejectSuggestionMutation.mutate({ id: s.id, reason: suggestionRejectReason[s.id] });
                    }}
                    disabled={!suggestionRejectReason[s.id]?.trim() || rejectSuggestionMutation.isPending}
                    className="text-sm bg-red-500 hover:bg-red-600 disabled:opacity-40 text-white px-4 py-1.5 rounded-lg font-medium transition-colors whitespace-nowrap"
                  >
                    Reject
                  </button>
                </div>
              </div>
            </div>
          ))}

          {suggestionsQuery.data && (
            <Pagination
              page={page}
              totalPages={suggestionsQuery.data.pagination.totalPages}
              onPageChange={setPage}
            />
          )}
        </div>
      )}

      {/* Students (admin only) */}
      {tab === 'students' && isAdmin && (
        <div className="space-y-3">
          {studentsQuery.isLoading && <div className="text-center text-gray-400 py-12">Loading...</div>}

          {studentsQuery.data?.data.map((s) => (
            <div key={s.id} className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm p-4 flex flex-col sm:flex-row items-start sm:items-center gap-4">
              <div className="w-9 h-9 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center text-gray-500 dark:text-gray-400 font-bold text-sm uppercase">
                {s.username[0]}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-gray-800 dark:text-gray-200 text-sm">{s.username}</p>
                <p className="text-xs text-gray-400">{s.email} · {s.role}</p>
                {(s as typeof s & { is_banned: boolean; ban_reason?: string }).is_banned && (
                  <p className="text-xs text-red-500 mt-0.5">
                    Banned: {(s as typeof s & { ban_reason?: string }).ban_reason}
                  </p>
                )}
              </div>

              {(s as typeof s & { is_banned: boolean }).is_banned ? (
                <button
                  onClick={() => unbanMutation.mutate(s.id)}
                  className="text-xs border border-green-500 dark:border-green-600 text-green-600 dark:text-green-400 hover:bg-green-50 dark:hover:bg-green-900/20 px-3 py-1.5 rounded-lg font-medium"
                >
                  Unban
                </button>
              ) : (
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    placeholder="Ban reason..."
                    value={banReason[s.id] ?? ''}
                    onChange={(e) => setBanReason((p) => ({ ...p, [s.id]: e.target.value }))}
                    className="border border-gray-200 dark:border-gray-600 rounded-lg px-2 py-1 text-xs bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-red-400 w-full sm:w-36"
                  />
                  <button
                    onClick={() => {
                      if (banReason[s.id]?.trim()) banMutation.mutate({ id: s.id, reason: banReason[s.id] });
                    }}
                    disabled={!banReason[s.id]?.trim()}
                    className="text-xs bg-red-500 disabled:opacity-40 text-white hover:bg-red-600 px-3 py-1.5 rounded-lg font-medium"
                  >
                    Ban
                  </button>
                </div>
              )}
            </div>
          ))}

          {studentsQuery.data && (
            <Pagination
              page={page}
              totalPages={studentsQuery.data.pagination.totalPages}
              onPageChange={setPage}
            />
          )}
        </div>
      )}
    </div>
  );
}
