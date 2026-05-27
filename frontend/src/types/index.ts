export type UserRole = 'student' | 'moderator' | 'admin';

export interface User {
  id: number;
  email: string;
  username: string;
  role: UserRole;
  institution_id?: number;
  institution_name?: string;
  email_verified: boolean;
}

export interface ProfessorClaim {
  id: number;
  status: 'pending' | 'approved' | 'rejected';
  institution_email?: string;
  staff_id?: string;
  additional_info?: string;
  created_at: string;
  professor_id: number;
  professor_first_name: string;
  professor_last_name: string;
  institution_name?: string;
  claimant_username: string;
  claimant_email: string;
}

export interface SearchResults {
  professors?: ProfessorSummary[];
  courses?: { id: number; code: string; name: string; credits?: number; department_name?: string; institution_name?: string }[];
  institutions?: { id: number; name: string; short_name?: string; country: string; city?: string }[];
}

export interface Institution {
  id: number;
  name: string;
  short_name?: string;
  country: string;
  state_province?: string;
  city?: string;
  email_domain?: string;
}

export interface Course {
  id: number;
  code: string;
  name: string;
  credits?: number;
  department_name?: string;
}

export interface ProfessorSummary {
  id: number;
  first_name: string;
  last_name: string;
  title: string;
  is_verified: boolean;
  profile_photo_url?: string;
  department_name?: string;
  institution_name?: string;
  total_reviews: number;
  avg_overall_rating?: number;
  weighted_avg_rating?: number;
  avg_difficulty?: number;
  pct_would_take_again?: number;
}

export interface Professor extends ProfessorSummary {
  institution_id?: number;
  email?: string;
  bio?: string;
  office_hours?: string | null;
  welcome_message?: string | null;
  allowed_semesters?: string[];
  five_star: number;
  four_star: number;
  three_star: number;
  two_star: number;
  one_star: number;
  criteria_averages: { criterion: string; avg_score: number; score_count: number }[];
  top_tags: { tag: string; is_positive: boolean; tag_count: number }[];
  courses?: Course[];
  viewer_has_claim?: boolean;
}

export interface CursorPaginated<T> {
  data: T[];
  has_more: boolean;
  next_cursor: string | null;
  pagination: { total: number; page: number; limit: number; totalPages: number };
}

export interface Review {
  id: number;
  student_id?: number;
  overall_rating: number;
  difficulty_rating?: number;
  would_take_again?: boolean;
  comment?: string;
  semester?: string;
  year?: number;
  is_anonymous: boolean;
  status: 'pending' | 'approved' | 'rejected' | 'flagged';
  created_at: string;
  updated_at?: string;
  is_edited?: boolean;
  is_own?: boolean;
  is_verified_student?: boolean;
  reviewer?: string;
  professor_first_name?: string;
  professor_last_name?: string;
  course_code?: string;
  course_name?: string;
  course_text?: string;
  helpful_votes: number;
  not_helpful_votes: number;
  criterion_scores?: { criterion: string; score: number }[];
  tags?: string[];
  professor_reply?: string;
  professor_reply_at?: string;
}

export interface RatingCriterion {
  id: number;
  name: string;
  description?: string;
}

export interface Tag {
  id: number;
  name: string;
  is_positive: boolean;
}

export interface Paginated<T> {
  data: T[];
  pagination: { total: number; page: number; limit: number; totalPages: number };
}

export interface ModerationReview extends Review {
  reviewer_username: string;
  reviewer_email: string;
  pending_reports: number;
}

export interface ProfessorSuggestion {
  id: number;
  first_name: string;
  last_name: string;
  title?: string;
  email?: string;
  notes?: string;
  status: 'pending' | 'approved' | 'rejected' | 'duplicate';
  created_at: string;
  institution_name?: string;
  department_name?: string;
  suggested_by_username: string;
  /** Auto-verification fields (added by verification service) */
  verification_status?: 'pending' | 'auto_verified' | 'unverifiable' | 'skipped';
  verification_source?: string | null;
  verification_score?: number | null;
}

export interface Report {
  id: number;
  status: 'pending' | 'dismissed' | 'actioned';
  additional_info?: string;
  created_at: string;
  review_id: number;
  review_comment?: string;
  review_status: string;
  overall_rating: number;
  report_reason?: string;
  reported_by_username: string;
  professor_first_name: string;
  professor_last_name: string;
}
