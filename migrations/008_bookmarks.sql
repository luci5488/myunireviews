CREATE TABLE IF NOT EXISTS bookmarks (
  id           SERIAL PRIMARY KEY,
  student_id   INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  professor_id INTEGER NOT NULL REFERENCES professors(id) ON DELETE CASCADE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE (student_id, professor_id)
);

CREATE INDEX IF NOT EXISTS idx_bookmarks_student ON bookmarks(student_id);
