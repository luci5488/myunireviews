'use client';

import { useState, useEffect } from 'react';
import { clsx } from 'clsx';
import type { Review } from '@/types';
import { StarRating } from './StarRating';
import { useAuth } from '@/lib/auth-context';
import { auth as authApi, reviews as reviewApi, professors as profApi } from '@/lib/api';
import { roleLabel } from '@/lib/professorUtils';
import { useQuery } from '@tanstack/react-query';
import { useToast } from '@/lib/toast-context';

interface Props {
  review: Review;
  onReported?: () => void;
  onDeleted?: () => void;
  showProfessor?: boolean;
  professorTitle?: string;
  searchQuery?: string;
  hasClaim?: boolean;
  professorId?: number;
}

function escapeRegex(str: string) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function highlight(text: string, query: string) {
  if (!query.trim()) return <>{text}</>;
  const parts = text.split(new RegExp(`(${escapeRegex(query)})`, 'gi'));
  return (
    <>
      {parts.map((p, i) =>
        p.toLowerCase() === query.toLowerCase()
          ? <mark key={i} className="bg-yellow-100 text-yellow-800 rounded px-0.5">{p}</mark>
          : p
      )}
    </>
  );
}

export function ReviewCard({ review: r, onReported, onDeleted, showProfessor, professorTitle, searchQuery, hasClaim, professorId }: Props) {
  const { token, isAuthenticated, user, login, promptVerification, promptLogin } = useAuth();
  const { showToast } = useToast();
  const [helpful, setHelpful] = useState(r.helpful_votes);
  const [notHelpful, setNotHelpful] = useState(r.not_helpful_votes);
  const [voted, setVoted] = useState<'helpful' | 'not_helpful' | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [reporting, setReporting] = useState(false);
  const [reportReasonId, setReportReasonId] = useState<number | null>(null);
  const [reportText, setReportText] = useState('');
  const [reportSubmitted, setReportSubmitted] = useState(false);
  const [reportSubmitting, setReportSubmitting] = useState(false);
  const [reportError, setReportError] = useState('');

  // Vote pop states
  const [showHelpfulPop, setShowHelpfulPop] = useState(false);
  const [showNotHelpfulPop, setShowNotHelpfulPop] = useState(false);

  // Edit state
  const [editing, setEditing] = useState(false);
  const [editComment, setEditComment] = useState(r.comment ?? '');
  const [editDifficulty, setEditDifficulty] = useState(r.difficulty_rating ?? 0);
  const [editWouldTakeAgain, setEditWouldTakeAgain] = useState<boolean | null>(r.would_take_again ?? null);
  const [editAnonymous, setEditAnonymous] = useState(r.is_anonymous);
  const [editSaving, setEditSaving] = useState(false);
  const [liveReview, setLiveReview] = useState(r);
  const [replyOpen, setReplyOpen] = useState(false);
  const [replyText, setReplyText] = useState('');
  const [replySaving, setReplySaving] = useState(false);

  // Delete state
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Sync with fresh prop when the parent refetches (e.g. SSE-triggered), but not while editing
  useEffect(() => {
    if (!editing) setLiveReview(r);
  }, [r]); // eslint-disable-line react-hooks/exhaustive-deps

  const { data: reasonsData } = useQuery({
    queryKey: ['report-reasons'],
    queryFn: reviewApi.reportReasons,
    staleTime: Infinity,
    enabled: reporting,
  });

  async function vote(type: 'helpful' | 'not_helpful') {
    if (!isAuthenticated) { promptLogin(); return; }
    if (!user?.email_verified) { promptVerification(); return; }
    if (!token) return;
    try {
      const refreshed = await authApi.me();
      login(refreshed.token, refreshed.data);
      const res = await reviewApi.vote(r.id, type, refreshed.token) as {
        action: 'added' | 'removed' | 'switched';
        helpful_votes: number;
        not_helpful_votes: number;
      };
      setHelpful(res.helpful_votes);
      setNotHelpful(res.not_helpful_votes);
      if (res.action === 'removed') {
        setVoted(null);
        showToast('Vote removed');
      } else {
        setVoted(type);
        if (res.action === 'added') {
          if (type === 'helpful') {
            setShowHelpfulPop(true);
            setTimeout(() => setShowHelpfulPop(false), 800);
          } else {
            setShowNotHelpfulPop(true);
            setTimeout(() => setShowNotHelpfulPop(false), 800);
          }
        }
        showToast('Vote recorded');
      }
    } catch (err: unknown) {
      showToast((err as Error).message ?? 'Failed to record vote', 'error');
    }
  }

  async function submitReport() {
    if (!token || !reportReasonId) return;
    setReportSubmitting(true);
    setReportError('');
    try {
      const refreshed = await authApi.me();
      login(refreshed.token, refreshed.data);
      await reviewApi.report(r.id, {
        reason_id: reportReasonId,
        additional_info: reportText.trim() || undefined,
      }, refreshed.token);
      setReportSubmitted(true);
      showToast('Report submitted — our team will review it');
      onReported?.();
    } catch (err: unknown) {
      setReportError((err as Error).message ?? 'Failed to submit report. Please try again.');
    } finally {
      setReportSubmitting(false);
    }
  }

  async function saveEdit() {
    if (!token) return;
    setEditSaving(true);
    try {
      const refreshed = await authApi.me();
      login(refreshed.token, refreshed.data);
      const result = await reviewApi.update(liveReview.id, {
        comment: editComment.trim() || undefined,
        difficulty_rating: editDifficulty || undefined,
        would_take_again: editWouldTakeAgain ?? undefined,
        is_anonymous: editAnonymous,
      }, refreshed.token);
      setLiveReview((prev) => ({
        ...prev,
        comment: editComment.trim() || undefined,
        difficulty_rating: editDifficulty || undefined,
        would_take_again: editWouldTakeAgain ?? undefined,
        is_anonymous: editAnonymous,
        updated_at: result.data.updated_at,
        is_edited: true,
      }));
      setEditing(false);
      showToast('Review updated');
    } catch (err: unknown) {
      showToast((err as Error).message ?? 'Failed to save changes', 'error');
    } finally {
      setEditSaving(false);
    }
  }

  async function submitReply() {
    if (!token || !professorId || !replyText.trim()) return;
    setReplySaving(true);
    try {
      const refreshed = await authApi.me();
      login(refreshed.token, refreshed.data);
      await profApi.replyToReview(professorId, liveReview.id, replyText.trim(), refreshed.token);
      setLiveReview((prev) => ({ ...prev, professor_reply: replyText.trim(), professor_reply_at: new Date().toISOString() }));
      setReplyOpen(false);
      setReplyText('');
      showToast('Reply saved');
    } catch (err: unknown) {
      showToast((err as Error).message ?? 'Failed to save reply', 'error');
    } finally {
      setReplySaving(false);
    }
  }

  async function deleteReply() {
    if (!token || !professorId) return;
    try {
      const refreshed = await authApi.me();
      login(refreshed.token, refreshed.data);
      await profApi.deleteReplyToReview(professorId, liveReview.id, refreshed.token);
      setLiveReview((prev) => ({ ...prev, professor_reply: undefined, professor_reply_at: undefined }));
      showToast('Reply removed');
    } catch (err: unknown) {
      showToast((err as Error).message ?? 'Failed to remove reply', 'error');
    }
  }

  async function deleteReview() {
    if (!token) return;
    setDeleting(true);
    try {
      const refreshed = await authApi.me();
      login(refreshed.token, refreshed.data);
      await reviewApi.delete(liveReview.id, refreshed.token);
      showToast('Review deleted');
      onDeleted?.();
    } catch (err: unknown) {
      showToast((err as Error).message ?? 'Failed to delete review', 'error');
      setDeleteConfirm(false);
    } finally {
      setDeleting(false);
    }
  }

  function openReport() {
    if (!isAuthenticated) { promptLogin(); return; }
    if (!user?.email_verified) { promptVerification(); return; }
    setReportReasonId(null);
    setReportText('');
    setReportSubmitted(false);
    setReportError('');
    setReporting(true);
  }

  const isOwn = !!liveReview.is_own || (liveReview.student_id !== null && liveReview.student_id !== undefined && !!user && user.id === liveReview.student_id);
  const isEdited = !!liveReview.is_edited;
  // Guard against missing updated_at — falls back to created_at to prevent "Invalid Date"
  const dateSource = isEdited && liveReview.updated_at ? liveReview.updated_at : liveReview.created_at;
  const displayDate = new Date(dateSource)
    .toLocaleDateString('en-AU', { day: 'numeric', month: 'long', year: 'numeric' });
  const dateLabel = isEdited ? `Edited ${displayDate}` : `Added ${displayDate}`;

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm p-5">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <StarRating value={liveReview.overall_rating} size="sm" />
            <span className="text-sm font-semibold text-gray-800 dark:text-gray-200">{liveReview.overall_rating}/5</span>
            {(liveReview.course_code || liveReview.course_text) && (
              <span className="text-xs bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 px-2 py-0.5 rounded-full">
                {liveReview.course_code ?? liveReview.course_text}
              </span>
            )}
            {liveReview.semester && liveReview.year && (
              <span className="text-xs text-gray-400">{liveReview.semester} {liveReview.year}</span>
            )}
          </div>

          {showProfessor && liveReview.professor_first_name && (
            <p className="text-sm text-blue-600 mt-1 font-medium">
              {liveReview.professor_first_name} {liveReview.professor_last_name}
            </p>
          )}
        </div>

        <div className="text-right flex-shrink-0">
          <p className="text-xs text-gray-400 dark:text-gray-500 italic">{dateLabel}</p>
          {liveReview.reviewer && (
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 flex items-center gap-1">
              {liveReview.reviewer}
              {liveReview.is_verified_student && (
                <span title="Verified student — email domain matches this institution" className="text-xs bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-400 border border-green-200 dark:border-green-700 px-1 py-0.5 rounded font-medium leading-none">
                  ✓ Verified
                </span>
              )}
            </p>
          )}
          {liveReview.is_anonymous && <p className="text-xs text-gray-400 dark:text-gray-500">Anonymous</p>}
        </div>
      </div>

      {/* Edit form */}
      {editing ? (
        <div className="mt-4 space-y-4 border-t border-gray-100 dark:border-gray-700 pt-4">
          {liveReview.status === 'approved' && (
            <div className="text-xs bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 text-amber-700 dark:text-amber-400 px-3 py-2 rounded-lg">
              ⚠️ Saving changes will re-submit your review for moderation. It will be hidden from the profile until re-approved.
            </div>
          )}
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">Difficulty</label>
            <StarRating value={editDifficulty} onChange={setEditDifficulty} size="sm" />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">Would take again?</label>
            <div className="flex gap-2">
              {([{ v: true, l: 'Yes' }, { v: false, l: 'No' }] as { v: boolean; l: string }[]).map(({ v, l }) => (
                <button
                  key={l}
                  type="button"
                  onClick={() => setEditWouldTakeAgain(editWouldTakeAgain === v ? null : v)}
                  className={clsx(
                    'px-4 py-1.5 rounded-lg border text-xs font-medium transition-all',
                    editWouldTakeAgain === v
                      ? v ? 'bg-green-600 border-green-600 text-white' : 'bg-red-500 border-red-500 text-white'
                      : 'border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700'
                  )}
                >{l}</button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">Written review</label>
            <textarea
              rows={4}
              value={editComment}
              onChange={(e) => setEditComment(e.target.value)}
              maxLength={3000}
              className="w-full border border-gray-300 dark:border-gray-600 rounded-xl px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            {editComment.length > 0 && editComment.length < 20 && (
              <p className="text-xs text-red-500 mt-1">{20 - editComment.length} more characters needed</p>
            )}
          </div>

          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={editAnonymous} onChange={(e) => setEditAnonymous(e.target.checked)} className="accent-blue-600" />
            <span className="text-xs text-gray-600 dark:text-gray-400">Post anonymously</span>
          </label>

          <div className="flex gap-2">
            <button
              onClick={saveEdit}
              disabled={editSaving || (editComment.length > 0 && editComment.length < 20)}
              className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-semibold px-4 py-2 rounded-lg transition-colors"
            >
              {editSaving ? 'Saving…' : 'Save changes'}
            </button>
            <button
              onClick={() => { setEditing(false); setEditComment(liveReview.comment ?? ''); setEditDifficulty(liveReview.difficulty_rating ?? 0); setEditWouldTakeAgain(liveReview.would_take_again ?? null); setEditAnonymous(liveReview.is_anonymous); }}
              className="text-xs px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <>
          {/* Stats row */}
          <div className="flex items-center gap-3 flex-wrap mt-3 text-sm">
            {liveReview.difficulty_rating && (
              <span className="text-gray-600 dark:text-gray-400">
                Difficulty: <span className="font-medium">{liveReview.difficulty_rating}/5</span>
              </span>
            )}
            {liveReview.would_take_again != null && (
              <span className={liveReview.would_take_again ? 'text-green-600 font-medium' : 'text-red-500 font-medium'}>
                {liveReview.would_take_again
                  ? `✓ Would take ${roleLabel(professorTitle)} again`
                  : `✗ Wouldn't take ${roleLabel(professorTitle)} again`}
              </span>
            )}
          </div>

          {/* Comment */}
          {liveReview.comment && (
            <p className="mt-3 text-gray-700 dark:text-gray-300 text-sm leading-relaxed">
              {searchQuery ? highlight(liveReview.comment, searchQuery) : liveReview.comment}
            </p>
          )}
        </>
      )}

      {/* Tags */}
      {liveReview.tags?.length ? (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {liveReview.tags.map((tag) => (
            <span key={tag} className="text-xs bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 px-2 py-0.5 rounded-full">
              {tag}
            </span>
          ))}
        </div>
      ) : null}

      {/* Professor reply */}
      {liveReview.professor_reply && (
        <div className="mt-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800 rounded-xl p-3">
          <div className="flex items-start justify-between gap-2">
            <p className="text-xs font-semibold text-blue-700 dark:text-blue-400 mb-1 flex items-center gap-1">
              <span>🎓</span> Professor&apos;s response
              {liveReview.professor_reply_at && (
                <span className="font-normal text-blue-400 dark:text-blue-500 ml-1">
                  · {new Date(liveReview.professor_reply_at).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })}
                </span>
              )}
            </p>
            {hasClaim && (
              <button onClick={deleteReply} className="text-xs text-blue-300 hover:text-red-400 flex-shrink-0">Remove</button>
            )}
          </div>
          <p className="text-sm text-blue-800 dark:text-blue-200 leading-relaxed">{liveReview.professor_reply}</p>
        </div>
      )}

      {/* Professor reply form (hasClaim + no existing reply + approved) */}
      {hasClaim && !liveReview.professor_reply && liveReview.status === 'approved' && (
        <div className="mt-3">
          {replyOpen ? (
            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-xl p-3 space-y-2">
              <p className="text-xs font-semibold text-blue-700 dark:text-blue-400">🎓 Reply as professor</p>
              <textarea
                rows={3}
                value={replyText}
                onChange={(e) => setReplyText(e.target.value)}
                maxLength={1000}
                placeholder="Write a professional response to this review…"
                className="w-full border border-blue-200 dark:border-blue-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 resize-none focus:outline-none focus:ring-2 focus:ring-blue-400"
              />
              <div className="flex gap-2">
                <button
                  onClick={submitReply}
                  disabled={replySaving || !replyText.trim()}
                  className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors"
                >
                  {replySaving ? 'Saving…' : 'Save reply'}
                </button>
                <button onClick={() => { setReplyOpen(false); setReplyText(''); }} className="text-xs px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-600 dark:text-gray-400">
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setReplyOpen(true)}
              className="text-xs text-blue-500 hover:text-blue-700 dark:hover:text-blue-300 flex items-center gap-1 py-1"
            >
              🎓 Reply as professor
            </button>
          )}
        </div>
      )}

      {/* Criterion scores (collapsible) */}
      {liveReview.criterion_scores?.length ? (
        <div className="mt-3">
          <button
            onClick={() => setExpanded(!expanded)}
            className="text-xs text-blue-600 hover:underline"
          >
            {expanded ? '▲ Hide' : '▼ Show'} detailed scores
          </button>
          {expanded && (
            <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1">
              {liveReview.criterion_scores.map((cs) => (
                <div key={cs.criterion} className="flex items-center justify-between text-xs">
                  <span className="text-gray-600 dark:text-gray-400">{cs.criterion}</span>
                  <div className="flex items-center gap-1">
                    <div className="w-16 bg-gray-100 dark:bg-gray-700 rounded-full h-1.5">
                      <div
                        className="h-full bg-blue-500 rounded-full"
                        style={{ width: `${(cs.score / 5) * 100}%` }}
                      />
                    </div>
                    <span className="text-gray-700 dark:text-gray-300 font-medium w-5 text-right">{cs.score}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : null}

      {/* Footer actions */}
      <div className="mt-4 pt-3 border-t border-gray-50 dark:border-gray-700 flex items-center justify-between">
        <div className="flex items-center gap-3">
          {!isOwn && <span className="text-xs text-gray-400 dark:text-gray-500">Helpful?</span>}
          {!isOwn && (
            <div className="relative">
              {showHelpfulPop && (
                <span className="absolute -top-6 left-1/2 -translate-x-1/2 text-xs font-bold text-green-600 animate-vote-pop select-none">
                  +1
                </span>
              )}
              <button
                onClick={() => vote('helpful')}
                className={clsx(
                  'text-xs px-3 py-2.5 rounded-md border transition-colors min-h-[44px]',
                  voted === 'helpful'
                    ? 'bg-green-50 border-green-200 text-green-700'
                    : 'border-gray-200 dark:border-gray-600 text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700'
                )}
              >
                👍 {helpful}
              </button>
            </div>
          )}
          {!isOwn && (
            <div className="relative">
              {showNotHelpfulPop && (
                <span className="absolute -top-6 left-1/2 -translate-x-1/2 text-xs font-bold text-red-500 animate-vote-pop select-none">
                  +1
                </span>
              )}
              <button
                onClick={() => vote('not_helpful')}
                className={clsx(
                  'text-xs px-3 py-2.5 rounded-md border transition-colors min-h-[44px]',
                  voted === 'not_helpful'
                    ? 'bg-red-50 border-red-200 text-red-600'
                    : 'border-gray-200 dark:border-gray-600 text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700'
                )}
              >
                👎 {notHelpful}
              </button>
            </div>
          )}
        </div>

        <div className="flex items-center gap-2">
          {isOwn && !editing && (
            <>
              <button
                onClick={() => setEditing(true)}
                title={liveReview.status === 'approved' ? 'Editing will re-submit your review for moderation' : undefined}
                className="text-xs text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors flex items-center gap-1 py-1 px-2 rounded hover:bg-blue-50 dark:hover:bg-blue-900/20"
              >
                ✎ Edit
              </button>
              {deleteConfirm ? (
                <span className="flex items-center gap-1.5">
                  <span className="text-xs text-red-500 dark:text-red-400">Delete?</span>
                  <button
                    onClick={deleteReview}
                    disabled={deleting}
                    className="text-xs bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white px-2 py-1 rounded transition-colors"
                  >
                    {deleting ? '…' : 'Yes'}
                  </button>
                  <button
                    onClick={() => setDeleteConfirm(false)}
                    className="text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 px-2 py-1 rounded border border-gray-200 dark:border-gray-600 transition-colors"
                  >
                    Cancel
                  </button>
                </span>
              ) : (
                <button
                  onClick={() => setDeleteConfirm(true)}
                  className="text-xs text-gray-400 hover:text-red-500 dark:hover:text-red-400 transition-colors flex items-center gap-1 py-1 px-2 rounded hover:bg-red-50 dark:hover:bg-red-900/20"
                >
                  🗑 Delete
                </button>
              )}
            </>
          )}
          {!isOwn && (
            <button
              onClick={openReport}
              className="text-xs text-gray-400 hover:text-red-500 dark:hover:text-red-400 transition-colors flex items-center gap-1 py-1 px-2 rounded hover:bg-red-50 dark:hover:bg-red-900/20"
            >
              <span>⚑</span> Report
            </button>
          )}
        </div>
      </div>

      {/* Report modal */}
      {reporting && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center px-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl w-full max-w-md p-6">
            {reportSubmitted ? (
              <div className="text-center py-4 space-y-3">
                <div className="text-4xl">✅</div>
                <h3 className="font-bold text-gray-900 dark:text-gray-100">Report submitted</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400">Our moderation team will review this shortly.</p>
                <button onClick={() => setReporting(false)} className="text-sm text-blue-600 hover:underline">
                  Close
                </button>
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-bold text-gray-900 dark:text-gray-100">Report this review</h3>
                  <button onClick={() => setReporting(false)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 text-2xl leading-none w-8 h-8 flex items-center justify-center">×</button>
                </div>

                <div className="space-y-3">
                  <div>
                    <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Why are you reporting this? <span className="text-red-500">*</span></p>
                    <div className="space-y-2">
                      {reasonsData?.data.map((reason) => (
                        <label key={reason.id} className="flex items-start gap-2.5 cursor-pointer group">
                          <input
                            type="radio"
                            name={`report-reason-${r.id}`}
                            value={reason.id}
                            checked={reportReasonId === reason.id}
                            onChange={() => setReportReasonId(reason.id)}
                            className="mt-0.5 accent-red-500"
                          />
                          <div>
                            <p className="text-sm font-medium text-gray-800 dark:text-gray-200 group-hover:text-red-600 dark:group-hover:text-red-400">{reason.name}</p>
                            {reason.description && <p className="text-xs text-gray-400 dark:text-gray-500">{reason.description}</p>}
                          </div>
                        </label>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 block">
                      Additional details <span className="text-gray-400 dark:text-gray-500 font-normal">(optional)</span>
                    </label>
                    <textarea
                      rows={3}
                      value={reportText}
                      onChange={(e) => setReportText(e.target.value)}
                      placeholder="Any extra context that helps our team..."
                      className="w-full border border-gray-300 dark:border-gray-600 rounded-xl px-3 py-2.5 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-400 resize-none focus:outline-none focus:ring-2 focus:ring-red-400"
                    />
                  </div>

                  {reportError && (
                    <p className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 rounded-lg px-3 py-2">{reportError}</p>
                  )}

                  <div className="flex gap-3 pt-1">
                    <button
                      onClick={submitReport}
                      disabled={!reportReasonId || reportSubmitting}
                      className="flex-1 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white font-semibold py-2.5 rounded-xl text-sm transition-colors"
                    >
                      {reportSubmitting ? 'Submitting…' : 'Submit Report'}
                    </button>
                    <button
                      onClick={() => setReporting(false)}
                      className="px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-xl text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700"
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
