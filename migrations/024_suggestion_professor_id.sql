-- Link approved suggestions to the professor record that was created from them.
-- Used to generate in-app "Your suggestion was approved" notifications.
ALTER TABLE professor_suggestions
  ADD COLUMN IF NOT EXISTS professor_id INTEGER REFERENCES professors(id) ON DELETE SET NULL;
