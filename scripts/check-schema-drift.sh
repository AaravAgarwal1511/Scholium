#!/usr/bin/env bash
#
# Contract check: has the live database schema drifted from the committed
# snapshot? Regenerates the public-schema TypeScript types from the linked
# Supabase project and diffs them against database/schema-types.snapshot.ts.
#
# A difference means a migration changed the live schema and the snapshot was not
# updated to match — exactly the class of drift that left `scholium_apps` absent
# from the apps' generated types and produced the 30-error typecheck baseline.
#
# This does NOT check the apps' own src/integrations/supabase/types.ts (those are
# knowingly stale — that IS the baseline). It checks that our recorded picture of
# the *live* schema stays current, so a new migration can't land silently.
#
# Needs the linked Supabase CLI (keychain creds locally, or SUPABASE_ACCESS_TOKEN
# + a `supabase link` in CI). Run:  ./scripts/check-schema-drift.sh
# Update the snapshot after an intended schema change:  pnpm schema:snapshot

set -uo pipefail
cd "$(dirname "$0")/.."

SNAPSHOT="database/schema-types.snapshot.ts"
HEADER='// AUTO-GENERATED SNAPSHOT of the live public schema types — do not edit by hand.
// Regenerate with: pnpm schema:snapshot   (see scripts/check-schema-drift.sh)'

if [ ! -f "$SNAPSHOT" ]; then
  echo "FAIL: $SNAPSHOT is missing. Create it with: pnpm schema:snapshot"
  exit 1
fi

current="$(mktemp)"
trap 'rm -f "$current"' EXIT
{
  printf '%s\n' "$HEADER"
  npx supabase gen types typescript --linked --schema public 2>/dev/null
} > "$current"

if ! grep -q "export type Database" "$current"; then
  echo "SKIP: could not generate types (no linked project / credentials)."
  exit 0
fi

if diff -q "$SNAPSHOT" "$current" >/dev/null; then
  echo "OK: live schema matches the snapshot."
  exit 0
fi

echo "DRIFT: the live schema differs from $SNAPSHOT."
echo "A migration changed the schema without updating the snapshot. Diff:"
echo "-----------------------------------------------------------------"
diff "$SNAPSHOT" "$current" | head -80
echo "-----------------------------------------------------------------"
echo "If this change is intended, refresh with: pnpm schema:snapshot"
exit 1
