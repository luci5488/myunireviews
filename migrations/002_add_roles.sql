-- Phase 1 add-on: student roles for moderation access control

CREATE TYPE user_role AS ENUM ('student', 'moderator', 'admin');

ALTER TABLE students
    ADD COLUMN role user_role NOT NULL DEFAULT 'student';

CREATE INDEX idx_students_role ON students(role);
