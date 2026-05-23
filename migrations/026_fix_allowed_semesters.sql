-- Fix allowed_semesters for institutions where the values were either NULL
-- or didn't match the backend Zod semesterValues enum, causing 422 errors
-- or the full semester list falling through to the frontend fallback.
--
-- Root causes corrected:
--   • UniMelb: column was NULL (migration 006 only patched USYD) → Semester 1 & 2
--   • USYD: re-affirm correct value in case it was overwritten
--   • UNSW / Deakin / Griffith / VU: had 'Term 1/2/3' (not in enum) → Trimester 1/2/3
--
-- Uses institution name (UNIQUE constraint) rather than short_name for reliability.

UPDATE institutions
SET allowed_semesters = ARRAY['Semester 1', 'Semester 2']
WHERE name IN ('University of Melbourne', 'University of Sydney');

UPDATE institutions
SET allowed_semesters = ARRAY['Trimester 1', 'Trimester 2', 'Trimester 3']
WHERE name IN ('UNSW Sydney', 'Deakin University', 'Griffith University', 'Victoria University');
