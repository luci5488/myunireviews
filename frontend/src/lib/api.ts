import type {
  User, Professor, ProfessorSummary, Review, RatingCriterion,
  Tag, Institution, Course, Paginated, CursorPaginated, ModerationReview, Report,
  ProfessorClaim, ProfessorSuggestion, SearchResults,
} from '@/types';

const BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000';

export class ApiError extends Error {
  constructor(public status: number, message: string, public details?: unknown) {
    super(message);
  }
}

async function req<T>(path: string, options?: RequestInit, token?: string | null): Promise<T> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`${BASE}${path}`, {
    ...options,
    credentials: 'include',   // always send the httpOnly session cookie
    headers: { ...headers, ...(options?.headers as Record<string, string> ?? {}) },
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
    throw new ApiError(res.status, body.error ?? 'Request failed', body.details);
  }
  return res.json();
}

// ── Auth ──────────────────────────────────────────────────────

export const auth = {
  register: (data: { email: string; username: string; password: string; institution_id?: number }) =>
    req<{ data: { token: string; user: User } }>('/api/auth/register', {
      method: 'POST', body: JSON.stringify(data),
    }),

  login: (data: { email: string; password: string; remember_me?: boolean }) =>
    req<{ data: { token: string; user: User } }>('/api/auth/login', {
      method: 'POST', body: JSON.stringify(data),
    }),

  /** Called without a token on page-reload to rehydrate from the httpOnly cookie. */
  me: (token?: string) =>
    req<{ data: User; token: string }>('/api/auth/me', undefined, token),

  verifyEmail: (token: string) =>
    req<{ message: string }>(`/api/auth/verify-email/${token}`),

  resendVerification: (token: string) =>
    req<{ message: string }>('/api/auth/resend-verification', { method: 'POST' }, token),

  deleteAccount: (token: string) =>
    req<{ message: string }>('/api/auth/me', { method: 'DELETE' }, token),

  logout: () =>
    req<{ message: string }>('/api/auth/logout', { method: 'POST' }),

  myReviews: (token: string) =>
    req<{ data: (Review & { professor_id: number; professor_first_name: string; professor_last_name: string; professor_title?: string; institution_name: string; course_code?: string })[] }>('/api/auth/me/reviews', undefined, token),

  getNotifications: (token: string) =>
    req<{ data: { notif_upvotes: boolean; notif_bookmarked_reviews: boolean } }>('/api/auth/me/notifications', undefined, token),

  updateNotifications: (prefs: { notif_upvotes?: boolean; notif_bookmarked_reviews?: boolean }, token: string) =>
    req<{ message: string }>('/api/auth/me/notifications', { method: 'PATCH', body: JSON.stringify(prefs) }, token),

  forgotPassword: (email: string) =>
    req<{ message: string }>('/api/auth/forgot-password', { method: 'POST', body: JSON.stringify({ email }) }),

  resetPassword: (data: { token: string; password: string }) =>
    req<{ message: string }>('/api/auth/reset-password', { method: 'POST', body: JSON.stringify(data) }),

  updateProfile: (data: { username?: string }, token: string) =>
    req<{ data: User; token: string }>('/api/auth/me/profile', { method: 'PATCH', body: JSON.stringify(data) }, token),

  changePassword: (data: { current_password: string; new_password: string }, token: string) =>
    req<{ message: string }>('/api/auth/me/change-password', { method: 'POST', body: JSON.stringify(data) }, token),

  notificationsInbox: (token: string) =>
    req<{ data: Array<{ type: string; message: string; link?: string; created_at: string }>; unread_count: number }>(
      '/api/auth/me/notifications/inbox', undefined, token
    ),

  markNotificationsSeen: (token: string) =>
    req<{ message: string }>('/api/auth/me/notifications/inbox/seen', { method: 'PATCH' }, token),
};

// ── Contact ───────────────────────────────────────────────────────
export const contact = {
  send: (data: { name: string; email: string; category: string; subject: string; message: string }) =>
    req<{ message: string }>('/api/contact', { method: 'POST', body: JSON.stringify(data) }),
};

// ── Institutions ──────────────────────────────────────────────

export const institutions = {
  list: (params?: { search?: string; country?: string; page?: number; limit?: number }) => {
    const qs = new URLSearchParams(
      Object.fromEntries(Object.entries(params ?? {}).filter(([, v]) => v != null).map(([k, v]) => [k, String(v)]))
    ).toString();
    return req<Paginated<Institution>>(`/api/institutions${qs ? `?${qs}` : ''}`);
  },
  get: (id: number) => req<{ data: Institution & { professor_count?: number; departments: { id: number; name: string; code: string }[] } }>(`/api/institutions/${id}`),
};

// ── Courses ───────────────────────────────────────────────────

export const courses = {
  list: (params?: { institution_id?: number; department_id?: number; search?: string; page?: number; limit?: number }) => {
    const qs = new URLSearchParams(
      Object.fromEntries(Object.entries(params ?? {}).filter(([, v]) => v != null).map(([k, v]) => [k, String(v)]))
    ).toString();
    return req<Paginated<Course>>(`/api/courses${qs ? `?${qs}` : ''}`);
  },
  get: (id: number) =>
    req<{ data: Course & {
      description?: string;
      credits?: number;
      department_name?: string;
      institution_name?: string;
      professors?: {
        id: number; first_name: string; last_name: string; title?: string;
        is_verified: boolean; department_name?: string; institution_name?: string;
        total_reviews?: number; avg_overall_rating?: number;
        avg_difficulty?: number; pct_would_take_again?: number;
      }[];
    } }>(`/api/courses/${id}`),
};

// ── Professors ────────────────────────────────────────────────

export const professors = {
  list: (params?: {
    institution_id?: number;
    department_id?: number;
    search?: string;
    sort?: 'rating' | 'reviews' | 'name';
    page?: number;
    limit?: number;
  }) => {
    const qs = new URLSearchParams(
      Object.fromEntries(Object.entries(params ?? {}).filter(([, v]) => v != null).map(([k, v]) => [k, String(v)]))
    ).toString();
    return req<Paginated<ProfessorSummary>>(`/api/professors${qs ? `?${qs}` : ''}`);
  },

  get: (id: number) =>
    req<{ data: Professor }>(`/api/professors/${id}`),

  reviews: (id: number, params?: Record<string, unknown>) => {
    const clean = Object.fromEntries(
      Object.entries(params ?? {}).filter(([, v]) => v != null && v !== '')
    ) as Record<string, string>;
    const qs = new URLSearchParams(clean).toString();
    return req<CursorPaginated<Review>>(`/api/professors/${id}/reviews${qs ? `?${qs}` : ''}`);
  },

  myReview: (id: number, token: string) =>
    req<{ data: { id: number; status: string; overall_rating?: number; difficulty_rating?: number; would_take_again?: boolean | null; comment?: string; is_anonymous?: boolean; rejection_reason?: string | null; created_at: string; updated_at?: string } | null }>(
      `/api/professors/${id}/my-review`,
      undefined,
      token
    ),

  claim: (id: number, data: {
    institution_email?: string;
    staff_id?: string;
    additional_info?: string;
  }, token: string) =>
    req<{ data: { id: number; status: string }; message: string }>(
      `/api/professors/${id}/claim`,
      { method: 'POST', body: JSON.stringify(data) },
      token
    ),

  suggest: (data: {
    institution_id: number;
    first_name: string;
    last_name: string;
    department_id?: number;
    title?: string;
    email?: string;
    notes?: string;
  }, token: string) =>
    req('/api/professors/suggest', { method: 'POST', body: JSON.stringify(data) }, token),

  updateProfile: (id: number, data: {
    bio?: string | null;
    office_hours?: string | null;
    welcome_message?: string | null;
  }, token: string) =>
    req<{ data: Professor }>(`/api/professors/${id}/profile`, {
      method: 'PATCH', body: JSON.stringify(data),
    }, token),

  stats: () =>
    req<{ data: { total_professors: number; total_reviews: number; total_institutions: number } }>('/api/professors/stats'),

  similar: (id: number) =>
    req<{ data: ProfessorSummary[] }>(`/api/professors/${id}/similar`),

  replyToReview: (profId: number, reviewId: number, reply: string, token: string) =>
    req<{ message: string }>(`/api/professors/${profId}/reviews/${reviewId}/reply`, { method: 'PATCH', body: JSON.stringify({ reply }) }, token),

  deleteReplyToReview: (profId: number, reviewId: number, token: string) =>
    req<{ message: string }>(`/api/professors/${profId}/reviews/${reviewId}/reply`, { method: 'DELETE' }, token),
};

// ── Departments ───────────────────────────────────────────────

export const departments = {
  get: (id: number) =>
    req<{ data: {
      id: number; name: string; code?: string;
      institution_id: number; institution_name: string;
      professor_count: number;
    } }>(`/api/departments/${id}`),
};

// ── Search ────────────────────────────────────────────────────

export const search = {
  global: (q: string, type = 'all') =>
    req<{ data: SearchResults; query: string }>(
      `/api/search?q=${encodeURIComponent(q)}&type=${type}`
    ),
};

// ── Reviews ───────────────────────────────────────────────────

export const reviews = {
  criteria: () => req<{ data: RatingCriterion[] }>('/api/reviews/meta/criteria'),
  tags: () => req<{ data: Tag[] }>('/api/reviews/meta/tags'),
  reportReasons: () => req<{ data: { id: number; name: string; description?: string }[] }>('/api/reviews/meta/report-reasons'),
  top: () => req<{ data: {
    id: number; overall_rating: number; comment: string; is_anonymous: boolean;
    created_at: string; reviewer?: string; helpful_votes: number;
    professor_first_name: string; professor_last_name: string;
    professor_title?: string; professor_id: number;
    institution_id: number; institution_name: string;
  }[] }>('/api/reviews/top'),

  create: (data: {
    professor_id: number;
    course_id?: number;
    course_text?: string;
    semester: string;   // required by backend Zod schema
    year: number;       // required by backend Zod schema
    // overall_rating is computed by the backend from criterion_scores — omit it here
    difficulty_rating?: number;
    would_take_again?: boolean;
    comment?: string;
    is_anonymous: boolean;
    criterion_scores?: { criteria_id: number; score: number }[];
    tag_ids?: number[];
  }, token: string) =>
    req<{ data: Review; message: string }>('/api/reviews', {
      method: 'POST', body: JSON.stringify(data),
    }, token),

  update: (id: number, data: {
    comment?: string;
    difficulty_rating?: number;
    would_take_again?: boolean | null;
    is_anonymous?: boolean;
    semester?: string;
    year?: number;
  }, token: string) =>
    req<{ data: { id: number; status: string; updated_at: string; is_edited: boolean } }>(
      '/api/reviews/' + id,
      { method: 'PUT', body: JSON.stringify(data) },
      token
    ),

  analyze: (comment: string, token: string) =>
    req<{ score: number; feedback: string | null }>('/api/reviews/analyze', {
      method: 'POST', body: JSON.stringify({ comment }),
    }, token),

  vote: (id: number, vote: 'helpful' | 'not_helpful', token: string) =>
    req('/api/reviews/' + id + '/vote', { method: 'POST', body: JSON.stringify({ vote }) }, token),

  report: (id: number, data: { reason_id?: number; additional_info?: string }, token: string) =>
    req('/api/reviews/' + id + '/report', { method: 'POST', body: JSON.stringify(data) }, token),

  delete: (id: number, token: string) =>
    req('/api/reviews/' + id, { method: 'DELETE' }, token),
};

// ── Moderation ────────────────────────────────────────────────

export const moderation = {
  queue: (status: 'pending' | 'flagged', params: { page?: number }, token: string) => {
    const qs = new URLSearchParams({ status, ...params as Record<string, string> }).toString();
    return req<Paginated<ModerationReview>>(`/api/moderation/reviews?${qs}`, undefined, token);
  },

  approve: (id: number, token: string) =>
    req('/api/moderation/reviews/' + id + '/approve', { method: 'PATCH' }, token),

  reject: (id: number, reason: string, token: string) =>
    req('/api/moderation/reviews/' + id + '/reject', {
      method: 'PATCH', body: JSON.stringify({ reason }),
    }, token),

  reports: (params: { page?: number }, token: string) => {
    const qs = new URLSearchParams(params as Record<string, string>).toString();
    return req<Paginated<Report>>(`/api/moderation/reports?${qs}`, undefined, token);
  },

  dismissReport: (id: number, note: string | undefined, token: string) =>
    req('/api/moderation/reports/' + id + '/dismiss', {
      method: 'PATCH', body: JSON.stringify({ note }),
    }, token),

  actionReport: (id: number, reason: string, token: string) =>
    req('/api/moderation/reports/' + id + '/action', {
      method: 'PATCH', body: JSON.stringify({ reason }),
    }, token),

  students: (params: { search?: string; banned?: string; page?: number }, token: string) => {
    const qs = new URLSearchParams(params as Record<string, string>).toString();
    return req<Paginated<User & { is_banned: boolean; ban_reason?: string }>>(`/api/moderation/students?${qs}`, undefined, token);
  },

  ban: (id: number, reason: string, token: string) =>
    req('/api/moderation/students/' + id + '/ban', {
      method: 'PATCH', body: JSON.stringify({ reason }),
    }, token),

  unban: (id: number, token: string) =>
    req('/api/moderation/students/' + id + '/unban', { method: 'PATCH' }, token),

  logs: (params: { page?: number }, token: string) => {
    const qs = new URLSearchParams(params as Record<string, string>).toString();
    return req(`/api/moderation/logs?${qs}`, undefined, token);
  },

  claims: (params: { page?: number }, token: string) => {
    const qs = new URLSearchParams(params as Record<string, string>).toString();
    return req<Paginated<ProfessorClaim>>(`/api/moderation/claims?${qs}`, undefined, token);
  },

  approveClaim: (id: number, token: string) =>
    req(`/api/moderation/claims/${id}/approve`, { method: 'PATCH' }, token),

  rejectClaim: (id: number, reason: string, token: string) =>
    req(`/api/moderation/claims/${id}/reject`, {
      method: 'PATCH', body: JSON.stringify({ reason }),
    }, token),

  suggestions: (params: { page?: number }, token: string) => {
    const qs = new URLSearchParams(params as Record<string, string>).toString();
    return req<Paginated<ProfessorSuggestion>>(`/api/moderation/suggestions?${qs}`, undefined, token);
  },

  approveSuggestion: (id: number, token: string) =>
    req(`/api/moderation/suggestions/${id}/approve`, { method: 'PATCH' }, token),

  rejectSuggestion: (id: number, reason: string, token: string) =>
    req(`/api/moderation/suggestions/${id}/reject`, {
      method: 'PATCH', body: JSON.stringify({ reason }),
    }, token),
};

// ── Bookmarks ─────────────────────────────────────────────────

export const bookmarks = {
  list: (token: string) =>
    req<{ data: (ProfessorSummary & { bookmark_id: number; bookmarked_at: string })[] }>('/api/bookmarks', undefined, token),

  check: (professorId: number, token: string) =>
    req<{ bookmarked: boolean }>(`/api/bookmarks/check/${professorId}`, undefined, token),

  add: (professorId: number, token: string) =>
    req<{ message: string }>('/api/bookmarks', { method: 'POST', body: JSON.stringify({ professor_id: professorId }) }, token),

  remove: (professorId: number, token: string) =>
    req<{ message: string }>(`/api/bookmarks/${professorId}`, { method: 'DELETE' }, token),
};
