-- Track whether the user chose "Remember Me" at login.
-- Preserved through token rotation so the cookie lifetime stays consistent.
ALTER TABLE refresh_tokens
  ADD COLUMN IF NOT EXISTS remember_me BOOLEAN NOT NULL DEFAULT TRUE;
