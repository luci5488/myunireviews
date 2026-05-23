-- ============================================================
-- MyUniReviews Platform — PostgreSQL Schema (Phase 1)
-- ============================================================

-- ─────────────────────────────────────────────────────────────
-- ENUMS
-- ─────────────────────────────────────────────────────────────

CREATE TYPE professor_title AS ENUM (
    'Professor',
    'Associate Professor',
    'Assistant Professor',
    'Lecturer',
    'Senior Lecturer',
    'Adjunct Professor',
    'Tutor',
    'Teaching Assistant',
    'Industry Fellow'
);

CREATE TYPE review_status AS ENUM (
    'pending',      -- awaiting moderation
    'approved',     -- visible to all
    'rejected',     -- removed by moderator
    'flagged'       -- approved but re-queued for review due to reports
);

CREATE TYPE report_status AS ENUM (
    'pending',
    'dismissed',    -- report found invalid
    'actioned'      -- review was rejected as a result
);

CREATE TYPE vote_type AS ENUM ('helpful', 'not_helpful');

CREATE TYPE semester AS ENUM (
    'Spring', 'Summer', 'Fall', 'Winter',
    'Semester 1', 'Semester 2', 'Trimester 1', 'Trimester 2', 'Trimester 3'
);

CREATE TYPE moderation_action AS ENUM (
    'approve_review',
    'reject_review',
    'flag_review',
    'ban_student',
    'unban_student',
    'verify_professor',
    'dismiss_report',
    'action_report'
);

-- ─────────────────────────────────────────────────────────────
-- INSTITUTIONS
-- ─────────────────────────────────────────────────────────────

CREATE TABLE institutions (
    id              SERIAL PRIMARY KEY,
    name            VARCHAR(255) NOT NULL,
    short_name      VARCHAR(50),                    -- e.g. "MIT", "UNSW"
    country         VARCHAR(100) NOT NULL,
    state_province  VARCHAR(100),
    city            VARCHAR(100),
    website         VARCHAR(255),
    logo_url        VARCHAR(500),
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_institutions_country ON institutions(country);
CREATE INDEX idx_institutions_name ON institutions(name);

-- ─────────────────────────────────────────────────────────────
-- DEPARTMENTS
-- ─────────────────────────────────────────────────────────────

CREATE TABLE departments (
    id              SERIAL PRIMARY KEY,
    institution_id  INTEGER NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,
    name            VARCHAR(255) NOT NULL,
    code            VARCHAR(20),                    -- e.g. "CS", "MATH"
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    UNIQUE (institution_id, code)
);

CREATE INDEX idx_departments_institution ON departments(institution_id);

-- ─────────────────────────────────────────────────────────────
-- COURSES / UNITS
-- ─────────────────────────────────────────────────────────────

CREATE TABLE courses (
    id              SERIAL PRIMARY KEY,
    institution_id  INTEGER NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,
    department_id   INTEGER REFERENCES departments(id) ON DELETE SET NULL,
    name            VARCHAR(255) NOT NULL,
    code            VARCHAR(30),                    -- e.g. "CS101", "MATH2011"
    credits         NUMERIC(4,1),
    description     TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    UNIQUE (institution_id, code)
);

CREATE INDEX idx_courses_institution ON courses(institution_id);
CREATE INDEX idx_courses_department ON courses(department_id);
CREATE INDEX idx_courses_code ON courses(code);

-- ─────────────────────────────────────────────────────────────
-- PROFESSORS / TUTORS
-- ─────────────────────────────────────────────────────────────

CREATE TABLE professors (
    id                  SERIAL PRIMARY KEY,
    institution_id      INTEGER NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,
    department_id       INTEGER REFERENCES departments(id) ON DELETE SET NULL,
    first_name          VARCHAR(100) NOT NULL,
    last_name           VARCHAR(100) NOT NULL,
    title               professor_title NOT NULL DEFAULT 'Professor',
    email               VARCHAR(255),
    profile_photo_url   VARCHAR(500),
    bio                 TEXT,
    is_verified         BOOLEAN NOT NULL DEFAULT FALSE,     -- identity confirmed by admin
    is_active           BOOLEAN NOT NULL DEFAULT TRUE,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_professors_institution ON professors(institution_id);
CREATE INDEX idx_professors_department ON professors(department_id);
CREATE INDEX idx_professors_name ON professors(last_name, first_name);

-- Many-to-many: professors ↔ courses (a professor may teach multiple courses)
CREATE TABLE professor_courses (
    id              SERIAL PRIMARY KEY,
    professor_id    INTEGER NOT NULL REFERENCES professors(id) ON DELETE CASCADE,
    course_id       INTEGER NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    UNIQUE (professor_id, course_id)
);

CREATE INDEX idx_prof_courses_professor ON professor_courses(professor_id);
CREATE INDEX idx_prof_courses_course ON professor_courses(course_id);

-- ─────────────────────────────────────────────────────────────
-- STUDENTS (USERS)
-- ─────────────────────────────────────────────────────────────

CREATE TABLE students (
    id                  SERIAL PRIMARY KEY,
    institution_id      INTEGER REFERENCES institutions(id) ON DELETE SET NULL,
    email               VARCHAR(255) NOT NULL UNIQUE,
    username            VARCHAR(50) NOT NULL UNIQUE,
    password_hash       VARCHAR(255) NOT NULL,
    year_of_study       SMALLINT CHECK (year_of_study BETWEEN 1 AND 10),
    email_verified      BOOLEAN NOT NULL DEFAULT FALSE,
    is_banned           BOOLEAN NOT NULL DEFAULT FALSE,
    ban_reason          TEXT,
    banned_at           TIMESTAMPTZ,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_login_at       TIMESTAMPTZ
);

CREATE INDEX idx_students_institution ON students(institution_id);
CREATE INDEX idx_students_email ON students(email);

-- ─────────────────────────────────────────────────────────────
-- RATING CRITERIA
-- Pre-seeded evaluation dimensions shown on every review form
-- ─────────────────────────────────────────────────────────────

CREATE TABLE rating_criteria (
    id          SERIAL PRIMARY KEY,
    name        VARCHAR(100) NOT NULL UNIQUE,    -- e.g. "Teaching Clarity"
    description TEXT,
    is_active   BOOLEAN NOT NULL DEFAULT TRUE,
    sort_order  SMALLINT NOT NULL DEFAULT 0
);

-- Seed standard criteria
INSERT INTO rating_criteria (name, description, sort_order) VALUES
    ('Teaching Clarity',     'How clearly the professor explains concepts',           1),
    ('Subject Knowledge',    'Depth of expertise in the subject matter',              2),
    ('Helpfulness',          'Willingness to assist students outside class',          3),
    ('Engagement',           'Ability to keep students engaged and motivated',        4),
    ('Fairness',             'Fairness in grading and expectations',                  5),
    ('Course Organisation',  'How well-structured and organised the course was',      6),
    ('Workload',             'Reasonableness of workload relative to credit points',  7);

-- ─────────────────────────────────────────────────────────────
-- TAGS
-- Quick-pick descriptors students attach to professors
-- ─────────────────────────────────────────────────────────────

CREATE TABLE tags (
    id          SERIAL PRIMARY KEY,
    name        VARCHAR(80) NOT NULL UNIQUE,
    is_positive BOOLEAN NOT NULL DEFAULT TRUE,  -- positive vs cautionary tag
    is_active   BOOLEAN NOT NULL DEFAULT TRUE
);

INSERT INTO tags (name, is_positive) VALUES
    -- positive
    ('Caring',              TRUE),
    ('Inspiring',           TRUE),
    ('Clear Explanations',  TRUE),
    ('Engaging',            TRUE),
    ('Accessible',          TRUE),
    ('Gives Good Feedback', TRUE),
    ('Real-World Examples', TRUE),
    ('Responsive to Emails',TRUE),
    -- cautionary (factual, not offensive)
    ('Heavy Workload',      FALSE),
    ('Fast Paced',          FALSE),
    ('Reads Off Slides',    FALSE),
    ('Tough Grader',        FALSE),
    ('Attendance Required', FALSE),
    ('Group Projects',      FALSE);

-- ─────────────────────────────────────────────────────────────
-- REPORT REASONS  (predefined, extensible)
-- ─────────────────────────────────────────────────────────────

CREATE TABLE report_reasons (
    id          SERIAL PRIMARY KEY,
    name        VARCHAR(100) NOT NULL UNIQUE,
    description TEXT,
    is_active   BOOLEAN NOT NULL DEFAULT TRUE
);

INSERT INTO report_reasons (name, description) VALUES
    ('Hate Speech',             'Content targeting protected characteristics'),
    ('Personal Attack',         'Direct personal insults or harassment toward the professor'),
    ('False Information',       'Factually incorrect claims presented as fact'),
    ('Not About Teaching',      'Review discusses personal life rather than academic experience'),
    ('Spam / Duplicate',        'Review appears to be spam or a duplicate submission'),
    ('Student Identification',  'Review reveals identifying information about another student'),
    ('Inappropriate Language',  'Profanity or inappropriate content');

-- ─────────────────────────────────────────────────────────────
-- REVIEWS
-- ─────────────────────────────────────────────────────────────

CREATE TABLE reviews (
    id              SERIAL PRIMARY KEY,
    student_id      INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    professor_id    INTEGER NOT NULL REFERENCES professors(id) ON DELETE CASCADE,
    course_id       INTEGER REFERENCES courses(id) ON DELETE SET NULL,

    -- When the student took the course
    semester        semester,
    year            SMALLINT CHECK (year BETWEEN 1950 AND 2100),

    -- Top-level scores
    overall_rating      SMALLINT NOT NULL CHECK (overall_rating BETWEEN 1 AND 5),
    difficulty_rating   SMALLINT CHECK (difficulty_rating BETWEEN 1 AND 5),
    would_take_again    BOOLEAN,

    -- Written review
    comment             TEXT CHECK (char_length(comment) <= 3000),

    -- Privacy
    is_anonymous        BOOLEAN NOT NULL DEFAULT TRUE,

    -- Moderation
    status              review_status NOT NULL DEFAULT 'pending',
    rejection_reason    TEXT,                          -- shown to student on rejection
    moderated_by        INTEGER REFERENCES students(id) ON DELETE SET NULL,
    moderated_at        TIMESTAMPTZ,

    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- One review per student per professor per course per semester/year
    UNIQUE (student_id, professor_id, course_id, semester, year)
);

CREATE INDEX idx_reviews_professor ON reviews(professor_id);
CREATE INDEX idx_reviews_student ON reviews(student_id);
CREATE INDEX idx_reviews_course ON reviews(course_id);
CREATE INDEX idx_reviews_status ON reviews(status);
CREATE INDEX idx_reviews_created ON reviews(created_at DESC);

-- ─────────────────────────────────────────────────────────────
-- PER-CRITERION SCORES
-- ─────────────────────────────────────────────────────────────

CREATE TABLE review_criterion_scores (
    id          SERIAL PRIMARY KEY,
    review_id   INTEGER NOT NULL REFERENCES reviews(id) ON DELETE CASCADE,
    criteria_id INTEGER NOT NULL REFERENCES rating_criteria(id) ON DELETE CASCADE,
    score       SMALLINT NOT NULL CHECK (score BETWEEN 1 AND 5),

    UNIQUE (review_id, criteria_id)
);

CREATE INDEX idx_criterion_scores_review ON review_criterion_scores(review_id);

-- ─────────────────────────────────────────────────────────────
-- REVIEW TAGS
-- ─────────────────────────────────────────────────────────────

CREATE TABLE review_tags (
    review_id   INTEGER NOT NULL REFERENCES reviews(id) ON DELETE CASCADE,
    tag_id      INTEGER NOT NULL REFERENCES tags(id) ON DELETE CASCADE,

    PRIMARY KEY (review_id, tag_id)
);

-- ─────────────────────────────────────────────────────────────
-- REVIEW VOTES  (helpful / not helpful)
-- ─────────────────────────────────────────────────────────────

CREATE TABLE review_votes (
    id          SERIAL PRIMARY KEY,
    review_id   INTEGER NOT NULL REFERENCES reviews(id) ON DELETE CASCADE,
    student_id  INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    vote        vote_type NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    UNIQUE (review_id, student_id)
);

CREATE INDEX idx_votes_review ON review_votes(review_id);

-- ─────────────────────────────────────────────────────────────
-- REVIEW REPORTS  (censorship / moderation queue)
-- ─────────────────────────────────────────────────────────────

CREATE TABLE review_reports (
    id              SERIAL PRIMARY KEY,
    review_id       INTEGER NOT NULL REFERENCES reviews(id) ON DELETE CASCADE,
    reported_by     INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    reason_id       INTEGER REFERENCES report_reasons(id) ON DELETE SET NULL,
    additional_info TEXT CHECK (char_length(additional_info) <= 1000),
    status          report_status NOT NULL DEFAULT 'pending',
    reviewed_by     INTEGER REFERENCES students(id) ON DELETE SET NULL,   -- moderator
    reviewed_at     TIMESTAMPTZ,
    moderator_note  TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    UNIQUE (review_id, reported_by)   -- one report per user per review
);

CREATE INDEX idx_reports_review ON review_reports(review_id);
CREATE INDEX idx_reports_status ON review_reports(status);

-- ─────────────────────────────────────────────────────────────
-- PROFESSOR SUGGESTIONS
-- Students can nominate professors not yet in the system
-- ─────────────────────────────────────────────────────────────

CREATE TABLE professor_suggestions (
    id              SERIAL PRIMARY KEY,
    suggested_by    INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    institution_id  INTEGER NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,
    department_id   INTEGER REFERENCES departments(id) ON DELETE SET NULL,
    first_name      VARCHAR(100) NOT NULL,
    last_name       VARCHAR(100) NOT NULL,
    title           professor_title,
    email           VARCHAR(255),
    notes           TEXT,
    status          VARCHAR(20) NOT NULL DEFAULT 'pending'
                        CHECK (status IN ('pending', 'approved', 'rejected', 'duplicate')),
    resolved_by     INTEGER REFERENCES students(id) ON DELETE SET NULL,
    resolved_at     TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─────────────────────────────────────────────────────────────
-- MODERATION AUDIT LOG
-- Immutable record of every moderation action taken
-- ─────────────────────────────────────────────────────────────

CREATE TABLE moderation_logs (
    id              SERIAL PRIMARY KEY,
    moderator_id    INTEGER REFERENCES students(id) ON DELETE SET NULL,
    action          moderation_action NOT NULL,
    entity_type     VARCHAR(50) NOT NULL,   -- 'review', 'student', 'professor', etc.
    entity_id       INTEGER NOT NULL,
    reason          TEXT,
    metadata        JSONB,                  -- flexible extra context
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_mod_logs_entity ON moderation_logs(entity_type, entity_id);
CREATE INDEX idx_mod_logs_moderator ON moderation_logs(moderator_id);
CREATE INDEX idx_mod_logs_created ON moderation_logs(created_at DESC);

-- ─────────────────────────────────────────────────────────────
-- VIEWS — pre-aggregated professor stats for fast lookups
-- ─────────────────────────────────────────────────────────────

CREATE VIEW professor_summary AS
SELECT
    p.id                                                    AS professor_id,
    p.first_name,
    p.last_name,
    p.title,
    p.institution_id,
    p.department_id,
    p.is_verified,

    COUNT(r.id)                                             AS total_reviews,
    ROUND(AVG(r.overall_rating)::NUMERIC, 2)                AS avg_overall_rating,
    ROUND(AVG(r.difficulty_rating)::NUMERIC, 2)             AS avg_difficulty,
    ROUND(
        100.0 * COUNT(*) FILTER (WHERE r.would_take_again = TRUE)
        / NULLIF(COUNT(*) FILTER (WHERE r.would_take_again IS NOT NULL), 0),
        1
    )                                                       AS pct_would_take_again,

    COUNT(r.id) FILTER (WHERE r.overall_rating = 5)        AS five_star,
    COUNT(r.id) FILTER (WHERE r.overall_rating = 4)        AS four_star,
    COUNT(r.id) FILTER (WHERE r.overall_rating = 3)        AS three_star,
    COUNT(r.id) FILTER (WHERE r.overall_rating = 2)        AS two_star,
    COUNT(r.id) FILTER (WHERE r.overall_rating = 1)        AS one_star

FROM professors p
LEFT JOIN reviews r
    ON r.professor_id = p.id
   AND r.status = 'approved'
GROUP BY p.id;

-- Per-criterion averages per professor
CREATE VIEW professor_criteria_averages AS
SELECT
    r.professor_id,
    rc.name         AS criterion,
    ROUND(AVG(rcs.score)::NUMERIC, 2) AS avg_score,
    COUNT(rcs.id)   AS score_count
FROM review_criterion_scores rcs
JOIN reviews r   ON r.id = rcs.review_id AND r.status = 'approved'
JOIN rating_criteria rc ON rc.id = rcs.criteria_id
GROUP BY r.professor_id, rc.id, rc.name;

-- Top tags per professor
CREATE VIEW professor_top_tags AS
SELECT
    r.professor_id,
    t.name          AS tag,
    t.is_positive,
    COUNT(*)        AS tag_count
FROM review_tags rt
JOIN reviews r ON r.id = rt.review_id AND r.status = 'approved'
JOIN tags t    ON t.id = rt.tag_id
GROUP BY r.professor_id, t.id, t.name, t.is_positive
ORDER BY r.professor_id, tag_count DESC;

-- ─────────────────────────────────────────────────────────────
-- TRIGGERS — auto-update updated_at timestamps
-- ─────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_professors_updated_at
    BEFORE UPDATE ON professors
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_reviews_updated_at
    BEFORE UPDATE ON reviews
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ─────────────────────────────────────────────────────────────
-- TRIGGER — auto-flag a review when it receives N reports
-- ─────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION auto_flag_review_on_reports()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
    report_count INTEGER;
    flag_threshold CONSTANT INTEGER := 3;
BEGIN
    SELECT COUNT(*) INTO report_count
    FROM review_reports
    WHERE review_id = NEW.review_id
      AND status = 'pending';

    IF report_count >= flag_threshold THEN
        UPDATE reviews
        SET status = 'flagged', updated_at = NOW()
        WHERE id = NEW.review_id
          AND status = 'approved';
    END IF;

    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_auto_flag_review
    AFTER INSERT ON review_reports
    FOR EACH ROW EXECUTE FUNCTION auto_flag_review_on_reports();
