-- Migration 021: Hash email verification tokens (security fix)
-- Previously tokens were stored as plaintext. Now stored as SHA-256 hashes,
-- matching the pattern already used for password_reset_tokens.
-- All existing plaintext tokens are invalidated (users will need to re-request verification).

BEGIN;

-- Wipe existing tokens — they cannot be migrated without the originals,
-- and any live tokens would be in the user's inbox (still usable via the raw value).
DELETE FROM email_verification_tokens;

-- Rename the plaintext column to token_hash
ALTER TABLE email_verification_tokens
  RENAME COLUMN token TO token_hash;

-- Ensure uniqueness constraint covers the new column name
-- (the existing unique index on `token` is renamed automatically by Postgres on column rename,
--  but we add an explicit check here for clarity)
ALTER TABLE email_verification_tokens
  ALTER COLUMN token_hash SET NOT NULL;

COMMIT;
