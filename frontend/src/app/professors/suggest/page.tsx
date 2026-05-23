'use client';

import { useState, useEffect, FormEvent, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useQuery, useMutation } from '@tanstack/react-query';
import { auth as authApi, professors as profApi, institutions as instApi } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { useToast } from '@/lib/toast-context';

const TITLES = ['Professor', 'Associate Professor', 'Assistant Professor', 'Lecturer', 'Senior Lecturer', 'Adjunct Professor', 'Tutor', 'Teaching Assistant', 'Industry Fellow', ''];

function SuggestProfessorPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { token, isAuthenticated, hydrated, login, promptLogin } = useAuth();
  const { showToast } = useToast();

  // Pre-fill name from search query (?name=John Smith)
  const rawName = searchParams.get('name') ?? '';
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');

  useEffect(() => {
    if (!rawName) return;
    const parts = rawName.trim().split(/\s+/);
    if (parts.length >= 2) {
      setFirstName(parts.slice(0, -1).join(' '));
      setLastName(parts[parts.length - 1]);
    } else {
      setFirstName(parts[0] ?? '');
    }
  }, [rawName]);

  const [title, setTitle] = useState('');
  const [institutionQuery, setInstitutionQuery] = useState('');
  const [institutionId, setInstitutionId] = useState<number | null>(null);
  const [institutionName, setInstitutionName] = useState('');
  const [institutionOpen, setInstitutionOpen] = useState(false);
  const [departmentId, setDepartmentId] = useState<number | null>(null);
  const [email, setEmail] = useState('');
  const [notes, setNotes] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const { data: instResults } = useQuery({
    queryKey: ['institutions-suggest', institutionQuery],
    queryFn: () => instApi.list({ search: institutionQuery }),
    enabled: institutionQuery.length >= 2 && !institutionId,
    staleTime: 30_000,
  });

  const { data: instDetail } = useQuery({
    queryKey: ['institution-detail', institutionId],
    queryFn: () => instApi.get(institutionId!),
    enabled: !!institutionId,
  });

  const departments = instDetail?.data?.departments ?? [];

  const mutation = useMutation({
    mutationFn: async () => {
      const refreshed = await authApi.me();
      login(refreshed.token, refreshed.data);
      return profApi.suggest(
        {
          institution_id: institutionId!,
          first_name: firstName.trim(),
          last_name: lastName.trim(),
          department_id: departmentId ?? undefined,
          title: title || undefined,
          email: email.trim() || undefined,
          notes: notes.trim() || undefined,
        },
        refreshed.token
      );
    },
    onSuccess: () => {
      setSubmitted(true);
      showToast('Professor suggested — our team will review it shortly.', 'success');
    },
    onError: (err: Error) => {
      showToast(err.message ?? 'Something went wrong. Please try again.', 'error');
    },
  });

  const canSubmit =
    firstName.trim().length > 0 &&
    lastName.trim().length > 0 &&
    institutionId !== null &&
    !mutation.isPending;

  if (hydrated && !isAuthenticated) {
    return (
      <div className="max-w-lg mx-auto px-4 py-20 text-center">
        <div className="text-5xl mb-4">🔒</div>
        <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-2">Sign in to suggest a professor</h1>
        <p className="text-gray-500 dark:text-gray-400 text-sm mb-6">
          You need an account to submit professor suggestions. It only takes a minute.
        </p>
        <div className="flex gap-3 justify-center">
          <Link href="/auth/login" className="bg-blue-600 hover:bg-blue-700 text-white font-semibold px-5 py-2.5 rounded-xl transition-colors">
            Sign in
          </Link>
          <Link href="/auth/register" className="border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 font-medium px-5 py-2.5 rounded-xl transition-colors">
            Create account
          </Link>
        </div>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="max-w-lg mx-auto px-4 py-20 text-center">
        <div className="text-5xl mb-4">✅</div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-2">Suggestion received!</h1>
        <p className="text-gray-500 dark:text-gray-400 text-sm mb-6">
          Our moderation team will review your suggestion and add the professor if everything checks out.
          This usually takes 1–3 business days.
        </p>
        <div className="flex gap-3 justify-center">
          <Link href="/professors" className="bg-blue-600 hover:bg-blue-700 text-white font-semibold px-5 py-2.5 rounded-xl transition-colors">
            Browse professors
          </Link>
          <button
            onClick={() => { setSubmitted(false); setFirstName(''); setLastName(''); setTitle(''); setInstitutionId(null); setInstitutionName(''); setInstitutionQuery(''); setDepartmentId(null); setEmail(''); setNotes(''); }}
            className="border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 font-medium px-5 py-2.5 rounded-xl transition-colors"
          >
            Suggest another
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-xl mx-auto px-4 py-10">
      {/* Header */}
      <div className="mb-8">
        <Link href="/professors" className="text-sm text-blue-600 dark:text-blue-400 hover:underline mb-4 inline-block">
          ← Back to professors
        </Link>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Suggest a professor</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          Can't find who you're looking for? Fill in what you know — our team will verify and add them.
        </p>
      </div>

      <form
        onSubmit={(e: FormEvent) => { e.preventDefault(); if (canSubmit) mutation.mutate(); }}
        className="space-y-5"
      >
        {/* Name */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
              First name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              placeholder="e.g. Jane"
              required
              className="w-full border border-gray-300 dark:border-gray-600 rounded-xl px-4 py-2.5 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
              Last name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              placeholder="e.g. Smith"
              required
              className="w-full border border-gray-300 dark:border-gray-600 rounded-xl px-4 py-2.5 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        {/* Title */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
            Title <span className="text-gray-400 font-normal">(optional)</span>
          </label>
          <select
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full border border-gray-300 dark:border-gray-600 rounded-xl px-4 py-2.5 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Select a title…</option>
            {TITLES.filter(Boolean).map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        </div>

        {/* Institution search */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
            University / Institution <span className="text-red-500">*</span>
          </label>
          {institutionId ? (
            <div className="flex items-center gap-3 px-4 py-2.5 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-xl text-sm">
              <span className="text-blue-700 dark:text-blue-300 font-medium flex-1">{institutionName}</span>
              <button
                type="button"
                onClick={() => { setInstitutionId(null); setInstitutionName(''); setInstitutionQuery(''); setDepartmentId(null); }}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
              >
                ×
              </button>
            </div>
          ) : (
            <div className="relative">
              <input
                type="text"
                value={institutionQuery}
                onChange={(e) => { setInstitutionQuery(e.target.value); setInstitutionOpen(true); }}
                onFocus={() => setInstitutionOpen(true)}
                onBlur={() => setTimeout(() => setInstitutionOpen(false), 150)}
                placeholder="Search for your university…"
                className="w-full border border-gray-300 dark:border-gray-600 rounded-xl px-4 py-2.5 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              {institutionOpen && instResults?.data && instResults.data.length > 0 && (
                <div className="absolute z-20 top-full mt-1 w-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-xl shadow-lg overflow-hidden">
                  {instResults.data.slice(0, 8).map((inst) => (
                    <button
                      key={inst.id}
                      type="button"
                      onMouseDown={() => {
                        setInstitutionId(inst.id);
                        setInstitutionName(inst.name);
                        setInstitutionOpen(false);
                        setInstitutionQuery('');
                      }}
                      className="w-full text-left px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-700 border-b border-gray-50 dark:border-gray-700 last:border-0"
                    >
                      <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">{inst.name}</p>
                      {inst.city && <p className="text-xs text-gray-400">{[inst.city, inst.country].filter(Boolean).join(', ')}</p>}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Department — only show once institution is selected */}
        {institutionId && departments.length > 0 && (
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
              Department <span className="text-gray-400 font-normal">(optional)</span>
            </label>
            <select
              value={departmentId ?? ''}
              onChange={(e) => setDepartmentId(e.target.value ? Number(e.target.value) : null)}
              className="w-full border border-gray-300 dark:border-gray-600 rounded-xl px-4 py-2.5 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Select a department…</option>
              {departments.map((d) => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </select>
          </div>
        )}

        {/* Email */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
            Institutional email <span className="text-gray-400 font-normal">(optional)</span>
          </label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="professor@university.edu"
            className="w-full border border-gray-300 dark:border-gray-600 rounded-xl px-4 py-2.5 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <p className="text-xs text-gray-400 mt-1">Helps us verify the professor faster. Never shared publicly.</p>
        </div>

        {/* Notes */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
            Additional notes <span className="text-gray-400 font-normal">(optional)</span>
          </label>
          <textarea
            rows={3}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Anything else that helps us identify this professor — their course codes, website, or LinkedIn…"
            className="w-full border border-gray-300 dark:border-gray-600 rounded-xl px-4 py-2.5 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {mutation.error && (
          <p className="text-sm text-red-600 dark:text-red-400">{(mutation.error as Error).message}</p>
        )}

        <button
          type="submit"
          disabled={!canSubmit}
          className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold py-3 rounded-xl transition-colors shadow-sm"
        >
          {mutation.isPending ? 'Submitting…' : 'Submit suggestion'}
        </button>

        <p className="text-xs text-gray-400 text-center">
          Suggestions are reviewed by our moderation team before being added.
        </p>
      </form>
    </div>
  );
}

export default function SuggestProfessorPage() {
  return (
    <Suspense fallback={<div className="max-w-2xl mx-auto px-4 py-8 animate-pulse" />}>
      <SuggestProfessorPageInner />
    </Suspense>
  );
}
