#!/usr/bin/env bash
# Export seed data from your local dev database to import into a fresh production DB.
#
# Usage:
#   ./scripts/export-seed-data.sh
#
# This creates seed-data.sql in the scripts/ directory.
# To import into Railway:
#   psql "$RAILWAY_DATABASE_URL" < scripts/seed-data.sql
#
# The file is gitignored (contains real data — links, users, etc.)

set -e

# Load DATABASE_URL from api-server .env if not already set
if [ -z "$DATABASE_URL" ]; then
  if [ -f "artifacts/api-server/.env" ]; then
    export $(grep -v '^#' artifacts/api-server/.env | grep DATABASE_URL)
  fi
fi

if [ -z "$DATABASE_URL" ]; then
  echo "Error: DATABASE_URL is not set. Run from the repo root or set it manually."
  exit 1
fi

OUTPUT="scripts/seed-data.sql"

echo "Exporting seed data from: $DATABASE_URL"
echo "Output: $OUTPUT"
echo ""

pg_dump "$DATABASE_URL" \
  --data-only \
  --no-owner \
  --no-acl \
  --table=users \
  --table=user_identities \
  --table=tags \
  --table=links \
  --table=link_tags \
  --table=comments \
  --table=reactions \
  --table=suggestions \
  > "$OUTPUT"

echo "Done. To import into Railway:"
echo ""
echo "  psql \"\$RAILWAY_DATABASE_URL\" < $OUTPUT"
echo ""
echo "Note: Run 'drizzle-kit push' against the Railway DB first to create the schema."
