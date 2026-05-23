-- Add unique constraint on institution name so the seed script can use ON CONFLICT DO NOTHING.
ALTER TABLE institutions ADD CONSTRAINT institutions_name_unique UNIQUE (name);
