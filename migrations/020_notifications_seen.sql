-- Migration 020: Add notifications_last_seen_at to track unread notification count
ALTER TABLE students
  ADD COLUMN IF NOT EXISTS notifications_last_seen_at TIMESTAMPTZ;
