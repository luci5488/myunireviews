-- Allow students to enter a free-text course code when their course isn't in the DB.
-- Mutually exclusive with course_id: application logic enforces only one is set.
ALTER TABLE reviews ADD COLUMN IF NOT EXISTS course_text VARCHAR(30);
