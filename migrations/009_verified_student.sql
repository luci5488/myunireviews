-- Add verified_student flag: set when email domain matches a known institution
ALTER TABLE students ADD COLUMN IF NOT EXISTS is_verified_student BOOLEAN NOT NULL DEFAULT FALSE;

-- Back-fill for existing students whose email domain matches their institution
UPDATE students s
SET is_verified_student = TRUE
FROM institutions i
WHERE s.institution_id = i.id
  AND i.email_domain IS NOT NULL
  AND s.email ILIKE '%@' || i.email_domain;
