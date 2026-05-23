-- Migration 019: schema correctness fixes
-- Fixes three production-breaking bugs and adds missing indexes / constraints.
-- Safe to run on an existing database — all changes use IF NOT EXISTS / IF EXISTS guards.

-- ─────────────────────────────────────────────────────────────────────────────
-- CRITICAL-1: Add email_marketing_consent to students
--   The registration INSERT always sends this column but the column never existed.
--   Every POST /api/auth/register has been throwing a runtime error.
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE students
  ADD COLUMN IF NOT EXISTS email_marketing_consent BOOLEAN NOT NULL DEFAULT FALSE;


-- ─────────────────────────────────────────────────────────────────────────────
-- CRITICAL-2: Make reviews.student_id nullable with ON DELETE SET NULL
--   The account-deletion handler does:
--     UPDATE reviews SET student_id = NULL … WHERE student_id = $1
--   but student_id was NOT NULL, so the UPDATE always threw a constraint violation,
--   meaning no user could ever successfully delete their account.
--
--   Steps:
--   1. Drop the existing FK (auto-named reviews_student_id_fkey).
--   2. Drop the NOT NULL constraint.
--   3. Re-add the FK with ON DELETE SET NULL so deleting a student anonymises
--      their reviews rather than cascade-deleting them.
--
--   The UNIQUE constraint (student_id, professor_id, course_id, semester, year)
--   is fine with NULLs — PostgreSQL treats each NULL as distinct, so multiple
--   anonymised reviews can coexist without violating the constraint.
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE reviews
  DROP CONSTRAINT IF EXISTS reviews_student_id_fkey;

ALTER TABLE reviews
  ALTER COLUMN student_id DROP NOT NULL;

ALTER TABLE reviews
  ADD CONSTRAINT reviews_student_id_fkey
    FOREIGN KEY (student_id)
    REFERENCES students(id)
    ON DELETE SET NULL;


-- ─────────────────────────────────────────────────────────────────────────────
-- CRITICAL-3: Add missing moderation_action enum values
--   The moderation routes log 'approve_suggestion' and 'reject_suggestion' but
--   neither value existed in the enum, causing every suggestion approval/rejection
--   to throw an invalid enum error.
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TYPE moderation_action ADD VALUE IF NOT EXISTS 'approve_suggestion';
ALTER TYPE moderation_action ADD VALUE IF NOT EXISTS 'reject_suggestion';
ALTER TYPE moderation_action ADD VALUE IF NOT EXISTS 'approve_claim';
ALTER TYPE moderation_action ADD VALUE IF NOT EXISTS 'reject_claim';


-- ─────────────────────────────────────────────────────────────────────────────
-- HIGH: Drop dead notification columns (migration 012 remnants)
--   Migration 012 added notify_bookmark_review / notify_review_upvoted.
--   Migration 016 added the correctly-named notif_upvotes / notif_bookmarked_reviews.
--   All application code exclusively uses the 016 columns; the 012 columns are
--   dead weight and have inconsistent defaults.
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE students
  DROP COLUMN IF EXISTS notify_bookmark_review,
  DROP COLUMN IF EXISTS notify_review_upvoted;


-- ─────────────────────────────────────────────────────────────────────────────
-- HIGH: Missing index on bookmarks(professor_id)
--   The review-approval notification query filters bookmarks by professor_id.
--   Without this index that query does a full seq-scan of the bookmarks table
--   on every single review approval.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_bookmarks_professor ON bookmarks(professor_id);


-- ─────────────────────────────────────────────────────────────────────────────
-- HIGH: Composite index on reviews(professor_id, status)
--   The single most common query pattern throughout the codebase is:
--     WHERE professor_id = $n AND status = 'approved'
--   The separate indexes on each column are less efficient than a composite.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_reviews_professor_status ON reviews(professor_id, status);


-- ─────────────────────────────────────────────────────────────────────────────
-- MEDIUM: Add updated_at trigger to review_responses
--   The table has an updated_at column but no trigger to keep it current on UPDATE.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE TRIGGER trg_review_responses_updated_at
  BEFORE UPDATE ON review_responses
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();


-- ─────────────────────────────────────────────────────────────────────────────
-- MEDIUM: Index on review_responses(professor_id)
--   Natural lookup key when a claimed professor views their responses.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_review_responses_professor ON review_responses(professor_id);


-- ─────────────────────────────────────────────────────────────────────────────
-- MEDIUM: Add updated_at to review_reports to preserve audit trail
--   The ON CONFLICT clause in the report route was overwriting created_at.
--   Adding updated_at lets us track when a report was last changed without
--   destroying the original timestamp.
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE review_reports
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ;
