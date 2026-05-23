ALTER TABLE professors
  ADD COLUMN IF NOT EXISTS office_hours    TEXT,
  ADD COLUMN IF NOT EXISTS welcome_message TEXT CHECK (char_length(welcome_message) <= 500);
