-- Enable trigram extension for fast fuzzy search
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Professor full-name trigram index (powers ILIKE searches)
CREATE INDEX idx_professors_fullname_trgm
    ON professors
    USING gin ((first_name || ' ' || last_name) gin_trgm_ops);

-- Course name + code trigram indexes
CREATE INDEX idx_courses_name_trgm
    ON courses
    USING gin (name gin_trgm_ops);

CREATE INDEX idx_courses_code_trgm
    ON courses
    USING gin (code gin_trgm_ops);

-- Institution name trigram index
CREATE INDEX idx_institutions_name_trgm
    ON institutions
    USING gin (name gin_trgm_ops);
