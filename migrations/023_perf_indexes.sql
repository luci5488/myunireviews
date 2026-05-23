-- Migration 023: Composite indexes for common query patterns
-- These cover the most frequent WHERE + ORDER BY combinations

-- Review votes: used in vote counts (helpful/not_helpful) and vote deduplication
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_review_votes_review_vote
  ON review_votes (review_id, vote);

-- Reviews by student, ordered by time — used by /api/auth/me/reviews
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_reviews_student_created
  ON reviews (student_id, created_at DESC);

-- Reviews by status, ordered by time — used by moderation queue
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_reviews_status_created
  ON reviews (status, created_at DESC);

-- Reports by status, ordered by time — used by moderation reports
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_review_reports_status_created
  ON review_reports (status, created_at DESC);

-- Professor suggestions by status — used by moderation suggestions queue
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_professor_suggestions_status
  ON professor_suggestions (status);
