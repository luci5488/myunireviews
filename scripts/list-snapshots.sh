#!/usr/bin/env bash
# list-snapshots.sh — Show all available stable snapshots.
set -euo pipefail

SNAPSHOT_DIR="snapshots"
LAST_SNAPSHOT_FILE=".last-snapshot"

LAST=$(cat "$LAST_SNAPSHOT_FILE" 2>/dev/null || echo "")

echo ""
echo "📸 Available snapshots:"
echo "────────────────────────────────────────────"

if [ ! -d "$SNAPSHOT_DIR" ] || [ -z "$(ls "$SNAPSHOT_DIR"/*.dump 2>/dev/null)" ]; then
  echo "   None yet. Run 'npm run snapshot' to create one."
  echo ""
  exit 0
fi

for dump in $(ls -t "$SNAPSHOT_DIR"/*.dump 2>/dev/null); do
  TAG=$(basename "$dump" | sed 's/^db-//;s/\.dump$//')
  SIZE=$(du -sh "$dump" | cut -f1)

  # Get git info for this tag
  COMMIT=$(git rev-parse --short "$TAG" 2>/dev/null || echo "?")
  DATE=$(git log -1 --format="%ci" "$TAG" 2>/dev/null || echo "")

  MARKER=""
  if [ "$TAG" = "$LAST" ]; then MARKER=" ← latest"; fi

  printf "   %-36s  %s  %s  %s%s\n" "$TAG" "$COMMIT" "$DATE" "$SIZE" "$MARKER"
done

echo ""
echo "Rollback:  npm run rollback"
echo "Specific:  npm run rollback -- <tag-name>"
echo ""
