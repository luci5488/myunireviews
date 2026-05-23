'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/lib/auth-context';
import { auth as authApi } from '@/lib/api';

export default function DashboardPage() {
  const { user, token, isAuthenticated, hydrated, logout, updateUser, login } = useAuth();
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteMsg, setDeleteMsg] = useState<string | null>(null);
  const router = useRouter();
  const queryClient = useQueryClient();

  // ── Change username ─────────────────────────────────────────
  const [newUsername, setNewUsername] = useState('');
  const [usernameMsg, setUsernameMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [usernameSaving, setUsernameSaving] = useState(false);

  // ── Change password ─────────────────────────────────────────
  const [currentPwd, setCurrentPwd] = useState('');
  const [newPwd, setNewPwd] = useState('');
  const [confirmPwd, setConfirmPwd] = useState('');
  const [showCurrentPwd, setShowCurrentPwd] = useState(false);
  const [showNewPwd, setShowNewPwd] = useState(false);
  const [pwdMsg, setPwdMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pwdSaving, setPwdSaving] = useState(false);

  // ── Notification preferences ────────────────────────────────
  const { data: notifData, refetch: refetchNotif } = useQuery({
    queryKey: ['notif-prefs'],
    queryFn: () => authApi.getNotifications(token!),
    enabled: isAuthenticated && !!token,
    staleTime: 60_000,
  });
  // Optimistic local overrides — updated instantly on toggle, cleared after network round-trip
  const [optimisticPrefs, setOptimisticPrefs] = useState<Partial<{ notif_upvotes: boolean; notif_bookmarked_reviews: boolean }>>({});
  const notifPrefs = {
    notif_upvotes:           optimisticPrefs.notif_upvotes           ?? notifData?.data?.notif_upvotes           ?? true,
    notif_bookmarked_reviews: optimisticPrefs.notif_bookmarked_reviews ?? notifData?.data?.notif_bookmarked_reviews ?? true,
  };
  const [notifSaving, setNotifSaving] = useState(false);
  const [notifMsg, setNotifMsg] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    if (hydrated && !isAuthenticated) router.push('/auth/login');
  }, [hydrated, isAuthenticated, router]);

  if (!hydrated || !isAuthenticated) return null;

  async function handleUsernameUpdate(e: React.FormEvent) {
    e.preventDefault();
    if (!newUsername.trim()) return;
    setUsernameSaving(true);
    setUsernameMsg(null);
    try {
      // Refresh token first — the in-memory JWT may have aged since page load
      const { token: freshToken } = await authApi.me();
      const res = await authApi.updateProfile({ username: newUsername.trim() }, freshToken);
      // Server returns a new JWT — update both user and token in auth context
      login(res.token, res.data);
      setUsernameMsg({ ok: true, text: 'Username updated!' });
      setNewUsername('');
    } catch (err: unknown) {
      setUsernameMsg({ ok: false, text: (err as Error).message ?? 'Failed to update username' });
    } finally {
      setUsernameSaving(false);
    }
  }

  async function handlePasswordChange(e: React.FormEvent) {
    e.preventDefault();
    if (newPwd !== confirmPwd) { setPwdMsg({ ok: false, text: 'New passwords do not match' }); return; }
    if (newPwd.length < 8) { setPwdMsg({ ok: false, text: 'New password must be at least 8 characters' }); return; }
    setPwdSaving(true);
    setPwdMsg(null);
    try {
      // Refresh token first — the in-memory JWT may have aged since page load
      const { token: freshToken } = await authApi.me();
      await authApi.changePassword({ current_password: currentPwd, new_password: newPwd }, freshToken);
      // Password change increments token_version — call /me to pick up the new JWT
      // the server just issued (with updated token_version) and sync auth context
      const refreshed = await authApi.me();
      login(refreshed.token, refreshed.data);
      setPwdMsg({ ok: true, text: 'Password updated successfully' });
      setCurrentPwd('');
      setNewPwd('');
      setConfirmPwd('');
    } catch (err: unknown) {
      setPwdMsg({ ok: false, text: (err as Error).message ?? 'Failed to update password' });
    } finally {
      setPwdSaving(false);
    }
  }

  async function toggleNotif(field: 'notif_upvotes' | 'notif_bookmarked_reviews', value: boolean) {
    // Flip the toggle immediately so the UI feels instant
    setOptimisticPrefs((p) => ({ ...p, [field]: value }));
    setNotifMsg(null);
    setNotifSaving(true);
    try {
      const { token: freshToken } = await authApi.me();
      await authApi.updateNotifications({ [field]: value }, freshToken);
      await refetchNotif();
      setOptimisticPrefs({});   // let remote state take over
    } catch (err: unknown) {
      // Revert the optimistic flip and show error
      setOptimisticPrefs((p) => ({ ...p, [field]: !value }));
      setNotifMsg({ ok: false, text: (err as Error).message ?? 'Failed to save preference — please try again.' });
    } finally {
      setNotifSaving(false);
    }
  }

  const cardCls = 'bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm p-6 mb-6';
  const inputCls = 'w-full border border-gray-300 dark:border-gray-600 rounded-xl px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500';
  const btnCls = 'bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-semibold px-4 py-2 rounded-xl transition-colors';

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">My Dashboard</h1>
          <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">Welcome back, {user?.username}</p>
        </div>
        <Link href="/professors" className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-2.5 rounded-xl transition-colors">
          Write a Review
        </Link>
      </div>

      {/* Account card */}
      <div className={cardCls}>
        <h2 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-4">Account</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
          <div>
            <p className="text-gray-400 dark:text-gray-500">Username</p>
            <p className="font-medium text-gray-800 dark:text-gray-200">{user?.username}</p>
          </div>
          <div>
            <p className="text-gray-400 dark:text-gray-500">Email</p>
            <div className="flex items-center gap-1.5">
              <p className="font-medium text-gray-800 dark:text-gray-200">{user?.email}</p>
              {user?.email_verified ? (
                <span title="Email verified" className="text-green-500 text-base leading-none">✓</span>
              ) : (
                <span className="text-xs text-amber-500 font-medium">unverified</span>
              )}
            </div>
          </div>
          <div>
            <p className="text-gray-400 dark:text-gray-500">Role</p>
            <p className="font-medium text-gray-800 dark:text-gray-200 capitalize">{user?.role}</p>
          </div>
          {user?.institution_name && (
            <div>
              <p className="text-gray-400 dark:text-gray-500">Institution</p>
              <p className="font-medium text-gray-800 dark:text-gray-200">{user.institution_name}</p>
            </div>
          )}
        </div>
      </div>

      {/* Change username */}
      <div className={cardCls}>
        <h2 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-4">Change Username</h2>
        <form onSubmit={handleUsernameUpdate} className="space-y-3">
          <input
            type="text"
            value={newUsername}
            onChange={(e) => setNewUsername(e.target.value)}
            placeholder={`Current: ${user?.username}`}
            minLength={3}
            maxLength={30}
            pattern="[a-zA-Z0-9_]+"
            className={inputCls}
          />
          <p className="text-xs text-gray-400">Letters, numbers, and underscores only. 3–30 characters.</p>
          {usernameMsg && (
            <p className={`text-sm ${usernameMsg.ok ? 'text-green-600' : 'text-red-500'}`}>{usernameMsg.text}</p>
          )}
          <button type="submit" disabled={!newUsername.trim() || usernameSaving} className={btnCls}>
            {usernameSaving ? 'Saving…' : 'Update username'}
          </button>
        </form>
      </div>

      {/* Change password */}
      <div className={cardCls}>
        <h2 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-4">Change Password</h2>
        <form onSubmit={handlePasswordChange} className="space-y-3">
          <div>
            <label className="text-xs text-gray-500 dark:text-gray-400 mb-1 block">Current password</label>
            <div className="relative">
              <input type={showCurrentPwd ? 'text' : 'password'} value={currentPwd} onChange={(e) => setCurrentPwd(e.target.value)} autoComplete="current-password" className={`${inputCls} pr-10`} />
              <button type="button" tabIndex={-1} onClick={() => setShowCurrentPwd((v) => !v)} aria-label={showCurrentPwd ? 'Hide' : 'Show'} className="absolute inset-y-0 right-3 flex items-center text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors">
                {showCurrentPwd ? <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" /></svg> : <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>}
              </button>
            </div>
          </div>
          <div>
            <label className="text-xs text-gray-500 dark:text-gray-400 mb-1 block">New password</label>
            <div className="relative">
              <input type={showNewPwd ? 'text' : 'password'} value={newPwd} onChange={(e) => setNewPwd(e.target.value)} minLength={8} autoComplete="new-password" className={`${inputCls} pr-10`} />
              <button type="button" tabIndex={-1} onClick={() => setShowNewPwd((v) => !v)} aria-label={showNewPwd ? 'Hide' : 'Show'} className="absolute inset-y-0 right-3 flex items-center text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors">
                {showNewPwd ? <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" /></svg> : <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>}
              </button>
            </div>
          </div>
          <div>
            <label className="text-xs text-gray-500 dark:text-gray-400 mb-1 block">Confirm new password</label>
            <input type="password" value={confirmPwd} onChange={(e) => setConfirmPwd(e.target.value)} autoComplete="new-password" className={inputCls} />
          </div>
          {pwdMsg && (
            <p className={`text-sm ${pwdMsg.ok ? 'text-green-600' : 'text-red-500'}`}>{pwdMsg.text}</p>
          )}
          <button type="submit" disabled={!currentPwd || !newPwd || !confirmPwd || pwdSaving} className={btnCls}>
            {pwdSaving ? 'Saving…' : 'Change password'}
          </button>
        </form>
      </div>

      {/* Notification preferences */}
      <div className={cardCls}>
        <h2 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-4">Email Notifications</h2>
        <div className="space-y-4">
          {[
            { field: 'notif_upvotes' as const, label: 'My reviews receive helpful votes', desc: "Get notified when other students find your review useful" },
            { field: 'notif_bookmarked_reviews' as const, label: 'New reviews on bookmarked professors', desc: "Get notified when a professor you've bookmarked gets a new review" },
          ].map(({ field, label, desc }) => (
            <label key={field} className={`flex items-start justify-between gap-4 cursor-pointer ${notifSaving ? 'opacity-60' : ''}`}>
              <div>
                <p className="text-sm font-medium text-gray-800 dark:text-gray-200">{label}</p>
                <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">{desc}</p>
              </div>
              <div className="relative flex-shrink-0 mt-0.5 w-10 h-5">
                <input
                  type="checkbox"
                  className="sr-only"
                  checked={notifPrefs[field]}
                  disabled={notifSaving}
                  onChange={(e) => toggleNotif(field, e.target.checked)}
                />
                <div
                  className={`w-10 h-5 rounded-full transition-colors ${notifPrefs[field] ? 'bg-blue-600' : 'bg-gray-300 dark:bg-gray-600'}`}
                />
                <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${notifPrefs[field] ? 'translate-x-5' : 'translate-x-0.5'}`} />
              </div>
            </label>
          ))}
          {notifMsg && (
            <p className={`text-sm mt-1 ${notifMsg.ok ? 'text-green-600' : 'text-red-500'}`}>{notifMsg.text}</p>
          )}
        </div>
      </div>

      {/* Danger zone */}
      <div className="border border-red-200 dark:border-red-800/60 rounded-xl p-5 mb-6">
        <h2 className="text-sm font-semibold text-red-600 uppercase tracking-wide mb-1">Danger Zone</h2>
        <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
          Deleting your account is permanent. Your personal data will be removed in accordance with the Australian Privacy Act 1988. Your reviews will be anonymised and remain on the platform.
        </p>
        {!showDeleteConfirm ? (
          <button
            onClick={() => setShowDeleteConfirm(true)}
            className="text-sm border border-red-300 dark:border-red-700 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 px-4 py-2 rounded-lg transition-colors"
          >
            Delete my account
          </button>
        ) : (
          <div className="bg-red-50 dark:bg-red-900/20 rounded-lg p-4 space-y-3">
            <p className="text-sm font-medium text-red-700 dark:text-red-400">Are you sure? This cannot be undone.</p>
            {deleteMsg && (
              <p className="text-xs text-red-600 dark:text-red-400">{deleteMsg}</p>
            )}
            <div className="flex gap-3">
              <button
                onClick={async () => {
                  setDeleting(true);
                  setDeleteMsg(null);
                  try {
                    // Refresh the token first — the in-memory JWT expires in 15 min
                    // and we never want a stale token to silently block deletion.
                    const { token: freshToken } = await authApi.me();
                    await authApi.deleteAccount(freshToken);
                    logout();
                    router.push('/');
                  } catch (err: unknown) {
                    setDeleting(false);
                    setDeleteMsg(
                      (err as Error).message && (err as Error).message !== 'Request failed'
                        ? (err as Error).message
                        : 'Something went wrong — please try again or contact support.'
                    );
                  }
                }}
                disabled={deleting}
                className="text-sm bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white px-4 py-2 rounded-lg font-medium"
              >
                {deleting ? 'Deleting...' : 'Yes, delete my account'}
              </button>
              <button
                onClick={() => { setShowDeleteConfirm(false); setDeleteMsg(null); }}
                className="text-sm border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700 px-4 py-2 rounded-lg"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Tips */}
      <div className="bg-blue-50 dark:bg-blue-950/30 border border-blue-100 dark:border-blue-800/50 rounded-xl p-5 text-sm text-blue-700 dark:text-blue-300">
        <p className="font-medium mb-1">Keep your reviews helpful</p>
        <ul className="list-disc list-inside space-y-1 text-blue-600 dark:text-blue-400 text-xs">
          <li>Focus on the academic experience, not personal opinions</li>
          <li>Be specific — mention course structure, workload, and communication</li>
          <li>Reviews are moderated to maintain quality and fairness</li>
          <li>You can edit or delete pending reviews within 24 hours</li>
        </ul>
      </div>
    </div>
  );
}
