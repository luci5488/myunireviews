CREATE TABLE IF NOT EXISTS review_responses (
  id           SERIAL PRIMARY KEY,
  review_id    INTEGER NOT NULL REFERENCES reviews(id) ON DELETE CASCADE,
  professor_id INTEGER NOT NULL REFERENCES professors(id) ON DELETE CASCADE,
  claimant_id  INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  content      TEXT NOT NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE (review_id, professor_id)
);

CREATE INDEX IF NOT EXISTS idx_review_responses_review ON review_responses(review_id);
