#!/usr/bin/env bash
set -euo pipefail

# Load DATABASE_URL from .env if not already in environment
if [ -z "${DATABASE_URL:-}" ] && [ -f .env ]; then
  export $(grep -v '^#' .env | grep 'DATABASE_URL' | xargs)
fi

if [ -z "${DATABASE_URL:-}" ]; then
  echo "ERROR: DATABASE_URL is not set" >&2
  exit 1
fi

echo "▶  Ensuring schema_migrations table exists..."
psql "$DATABASE_URL" -q -c "
  CREATE TABLE IF NOT EXISTS schema_migrations (
    filename   TEXT PRIMARY KEY,
    applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );
"

echo "▶  Scanning migrations/..."
applied=0
skipped=0

for file in $(ls migrations/*.sql | sort); do
  name=$(basename "$file")

  count=$(psql "$DATABASE_URL" -tAc "SELECT COUNT(*) FROM schema_migrations WHERE filename = '$name';")

  if [ "$count" -eq "1" ]; then
    echo "   ✓ $name (already applied)"
    skipped=$((skipped + 1))
  else
    echo "   ▶  Applying $name ..."
    psql "$DATABASE_URL" -f "$file" -q
    psql "$DATABASE_URL" -q -c "INSERT INTO schema_migrations (filename) VALUES ('$name');"
    echo "   ✓ $name applied"
    applied=$((applied + 1))
  fi
done

echo ""
echo "✓ Done. $applied applied, $skipped already up to date."
