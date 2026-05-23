-- Tighten course_text to match the 10-char app-level validation (Zod max: 10).
ALTER TABLE reviews
  ALTER COLUMN course_text TYPE VARCHAR(10);
