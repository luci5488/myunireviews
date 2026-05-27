-- Add auto-verification fields to professor_suggestions
ALTER TABLE professor_suggestions
  ADD COLUMN IF NOT EXISTS verification_status TEXT NOT NULL DEFAULT 'pending'
    CHECK (verification_status IN ('pending', 'auto_verified', 'unverifiable', 'skipped')),
  ADD COLUMN IF NOT EXISTS verification_source TEXT,          -- 'openalex' | 'orcid' | null
  ADD COLUMN IF NOT EXISTS verification_score NUMERIC(4,3),  -- 0.0–1.0 confidence
  ADD COLUMN IF NOT EXISTS verification_data JSONB,          -- raw match data for audit
  ADD COLUMN IF NOT EXISTS verified_at TIMESTAMPTZ;

-- Index so moderators can quickly filter verified vs unverifiable
CREATE INDEX IF NOT EXISTS idx_prof_suggestions_verification
  ON professor_suggestions (verification_status);
