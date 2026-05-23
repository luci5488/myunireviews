-- Periodic cleanup of expired tokens to keep tables lean.
-- The application also runs this on startup and every 6 hours via setInterval.

CREATE OR REPLACE FUNCTION cleanup_expired_tokens() RETURNS void AS $$
BEGIN
  DELETE FROM email_verification_tokens WHERE expires_at < NOW();
  DELETE FROM password_reset_tokens      WHERE expires_at < NOW();
END;
$$ LANGUAGE plpgsql;
