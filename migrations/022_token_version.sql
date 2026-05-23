-- Migration 022: Add token_version for JWT revocation
-- Incrementing this column instantly invalidates all existing JWTs for a user.
-- Used on password change and account ban.
ALTER TABLE students ADD COLUMN IF NOT EXISTS token_version INTEGER NOT NULL DEFAULT 1;
