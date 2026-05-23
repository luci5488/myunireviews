#!/usr/bin/env bash
# rollback.sh — Restore code and database to a previous stable snapshot.
# Usage:
#   npm run rollback              → rolls back to the most recent snapshot
#   npm run rollback -- stable-20240519-143022  → rolls back to a specific tag
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

# ── Resolve target tag ────────────────────────────────────────────────────────
if [ -n "${1:-}" ]; then
  TAG="$1"
else
  if [ ! -f "$LAST_SNAPSHOT_FILE" ]; then
    echo "❌ No snapshot found. Run 'npm run snapshot' first, or pass a tag name." >&2
    echo "   Available snapshots:" >&2
    ls "$SNAPSHOT_DIR"/*.dump 2>/dev/null | sed 's|.*/db-||;s|\.dump||' | sed 's/^/   - /' >&2
    exit 1
  fi
  TAG=$(cat "$LAST_SNAPSHOT_FILE")
fi

DB_DUMP="${SNAPSHOT_DIR}/db-${TAG}.dump"

# Validate
if ! git tag --list | grep -qx "$TAG"; then
  echo "❌ Git tag '$TAG' not found." >&2; exit 1
fi
if [ ! -f "$DB_DUMP" ]; then
  echo "❌ Database dump not found: $DB_DUMP" >&2; exit 1
fi

TARGET_COMMIT=$(git rev-parse --short "$TAG")
CURRENT_COMMIT=$(git rev-parse --short HEAD)

echo "⚠️  Rolling back to: $TAG (commit $TARGET_COMMIT)"
echo "   Current commit:    $CURRENT_COMMIT"
echo ""
read -p "   Proceed? This will overwrite your database. [y/N] " confirm
if [[ "$confirm" != "y" && "$confirm" != "Y" ]]; then
  echo "Aborted."; exit 0
fi

# ── Stop dev servers (optional — comment out if you prefer to restart manually)
# pkill -f "ts-node\|next dev" 2>/dev/null || true

# ── Step 1: Restore code ──────────────────────────────────────────────────────
echo ""
echo "▶ Restoring code to $TAG..."

# Stash any uncommitted work so we don't lose it
if ! git diff --quiet || ! git diff --cached --quiet; then
  STASH_MSG="rollback-stash-$(date +%Y%m%d-%H%M%S)"
  git stash push -m "$STASH_MSG"
  echo "   ✓ Uncommitted changes stashed as: $STASH_MSG"
  echo "     (recover with: git stash pop)"
fi

git checkout "$TAG" --quiet
echo "   ✓ Code restored to $TAG"

# ── Step 2: Restore node_modules if needed ────────────────────────────────────
echo ""
echo "▶ Restoring dependencies..."
npm ci --prefix . --silent 2>/dev/null || npm install --prefix . --silent
npm ci --prefix ./frontend --silent 2>/dev/null || npm install --prefix ./frontend --silent
echo "   ✓ Dependencies restored"

# ── Step 3: Restore database ──────────────────────────────────────────────────
echo ""
echo "▶ Restoring database from $DB_DUMP..."

# Parse db name from DATABASE_URL (postgresql://user@host/dbname)
DB_NAME=$(echo "$DATABASE_URL" | sed 's|.*/||')

# Drop all tables (clean slate) then restore
psql "$DATABASE_URL" -q -c "
  DO \$\$ DECLARE
    r RECORD;
  BEGIN
    FOR r IN (SELECT tablename FROM pg_tables WHERE schemaname = 'public') LOOP
      EXECUTE 'DROP TABLE IF EXISTS ' || quote_ident(r.tablename) || ' CASCADE';
    END LOOP;
  END \$\$;
"
pg_restore --no-acl --no-owner --dbname="$DATABASE_URL" "$DB_DUMP"
echo "   ✓ Database restored"

# ── Step 4: Rebuild frontend ──────────────────────────────────────────────────
echo ""
echo "▶ Rebuilding frontend..."
npm run build --prefix ./frontend 2>&1 | tail -5
echo "   ✓ Frontend built"

# ── Done ──────────────────────────────────────────────────────────────────────
echo ""
echo "✅ Rollback complete. You are now at: $TAG"
echo ""
echo "   Start the dev servers:"
echo "   • Backend:  npm run dev"
echo "   • Frontend: npm run dev (in /frontend)"
echo ""
echo "   ℹ️  You are in 'detached HEAD' state. To continue developing:"
echo "   • Create a new branch:  git checkout -b hotfix/after-rollback"
echo "   • Or return to main:    git checkout main"
