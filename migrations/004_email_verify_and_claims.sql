-- ── Email verification tokens ────────────────────────────────
CREATE TABLE email_verification_tokens (
    id          SERIAL PRIMARY KEY,
    student_id  INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    token       VARCHAR(64) NOT NULL UNIQUE,
    expires_at  TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '24 hours'),
    used_at     TIMESTAMPTZ,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_email_tokens_student ON email_verification_tokens(student_id);

-- ── Professor claim / verification requests ───────────────────
CREATE TABLE professor_claims (
    id                SERIAL PRIMARY KEY,
    professor_id      INTEGER NOT NULL REFERENCES professors(id) ON DELETE CASCADE,
    claimant_id       INTEGER NOT NULL REFERENCES students(id)   ON DELETE CASCADE,

    -- Evidence fields (at least one expected)
    institution_email VARCHAR(255),   -- claimant's institutional email
    staff_id          VARCHAR(50),    -- employee / staff ID number

    additional_info   TEXT CHECK (char_length(additional_info) <= 1000),

    status            VARCHAR(20) NOT NULL DEFAULT 'pending'
                          CHECK (status IN ('pending', 'approved', 'rejected')),
    reviewed_by       INTEGER REFERENCES students(id) ON DELETE SET NULL,
    reviewed_at       TIMESTAMPTZ,
    moderator_note    TEXT,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    UNIQUE (professor_id, claimant_id)
);

CREATE INDEX idx_claims_professor ON professor_claims(professor_id);
CREATE INDEX idx_claims_status    ON professor_claims(status);

-- ── Extend moderation_action enum ────────────────────────────
ALTER TYPE moderation_action ADD VALUE IF NOT EXISTS 'approve_claim';
ALTER TYPE moderation_action ADD VALUE IF NOT EXISTS 'reject_claim';
