#!/usr/bin/env bash
# snapshot.sh — Tag the current commit as stable and dump the database.
# Usage:
#   npm run snapshot              → creates snapshot with auto timestamp tag
#   npm run snapshot -- my-label → creates snapshot with tag "stable-my-label"
set -euo pipefail

# ── Config ────────────────────────────────────────────────────────────────────
SNAPSHOT_DIR="snapshots"
LAST_SNAPSHOT_FILE=".last-snapshot"

# Load DATABASE_URL from .env if not set
if [ -z "${DATABASE_URL:-}" ] && [ -f .env ]; then
  export $(grep -v '^#' .env | grep 'DATABASE_URL' | xargs)
fi
if [ -z "${DATABASE_URL:-}" ]; then
  echo "❌ DATABASE_URL is not set. Check your .env file." >&2; exit 1
fi

# ── Build tag name ────────────────────────────────────────────────────────────
LABEL="${1:-$(date +%Y%m%d-%H%M%S)}"
TAG="stable-${LABEL}"

# Warn (but continue) if there are uncommitted changes
if ! git diff --quiet || ! git diff --cached --quiet; then
  echo "⚠️  You have uncommitted changes. The snapshot will tag the last COMMIT."
  echo "   Uncommitted changes won't be included in the snapshot."
  echo ""
fi

# Fail if tag already exists
if git tag --list | grep -qx "$TAG"; then
  echo "❌ Tag '$TAG' already exists. Use a different label." >&2; exit 1
fi

# ── Create snapshot ───────────────────────────────────────────────────────────
mkdir -p "$SNAPSHOT_DIR"

COMMIT=$(git rev-parse --short HEAD)
DB_DUMP="${SNAPSHOT_DIR}/db-${TAG}.dump"

echo "📸 Creating snapshot: $TAG (commit $COMMIT)"

# 1. Git tag
git tag "$TAG"
echo "   ✓ Git tag created: $TAG"

# 2. Database dump (custom format — smallest + fastest restore)
pg_dump --format=custom --no-acl --no-owner "$DATABASE_URL" > "$DB_DUMP"
echo "   ✓ Database dumped: $DB_DUMP ($(du -sh "$DB_DUMP" | cut -f1))"

# 3. Record this as the latest snapshot
echo "$TAG" > "$LAST_SNAPSHOT_FILE"

echo ""
echo "✅ Snapshot ready. To roll back to this point, run:"
echo "   npm run rollback"
echo ""
echo "   Or to roll back to a specific snapshot:"
echo "   npm run rollback -- $TAG"
