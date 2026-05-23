ALTER TABLE institutions ADD COLUMN IF NOT EXISTS allowed_semesters TEXT[];

UPDATE institutions SET allowed_semesters = ARRAY['Semester 1','Semester 2'] WHERE short_name = 'USYD';
