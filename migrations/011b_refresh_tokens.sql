-- Migration 011: per-user refresh tokens stored server-side
-- Enables httpOnly cookie-based sessions with token rotation and revocation.

CREATE TABLE IF NOT EXISTS refresh_tokens (
  id          SERIAL PRIMARY KEY,
  student_id  INTEGER      NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  token_hash  TEXT         NOT NULL UNIQUE,   -- SHA-256 of the raw opaque token
  expires_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW() + INTERVAL '7 days',
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  revoked_at  TIMESTAMPTZ                     -- NULL = active
);

CREATE INDEX IF NOT EXISTS idx_refresh_tokens_student_id ON refresh_tokens(student_id);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_token_hash  ON refresh_tokens(token_hash);

-- Clean up expired / revoked tokens automatically (requires pg_cron or periodic job)
-- For now we rely on the application to prune on use.
