#!/usr/bin/env bash
#
# Contract check: does a target schema match the committed snapshot
# (database/schema-types.snapshot.ts)? Regenerates TypeScript types from the
# target and diffs them against the snapshot.
#
# The snapshot's meaning depends on which target last wrote it (pnpm
# schema:snapshot writes it from prod; pnpm schema:snapshot:local writes it from
# a local `supabase start` stack). Two callers use this script for two different
# purposes that happen to share one artifact:
#
#   --local            The PR gate (pnpm schema:drift, CI's `reset` job). No
#                       secrets, runs on fork PRs. Proves the migration set itself
#                       produces the schema the snapshot claims — this is what
#                       caught `scholium_apps` having no CREATE TABLE anywhere in
#                       the migration history (see 20260526020000_scholium_apps_base.sql).
#
#   --project-ref <ref>  The daily prod cron (schema-drift.yml). Proves prod
#                       still matches what the migrations produce — i.e. nothing
#                       was hand-applied to prod outside the migration set. Only
#                       needs SUPABASE_ACCESS_TOKEN (gen types --project-id hits
#                       the Management API directly; no `supabase link` needed).
#
# Both checking the same snapshot is the point: a green --local run on a PR
# combined with a green --project-ref run on main is what "staging reproduces
# prod" actually rests on. Update the snapshot after an intended schema change
# with the matching schema:snapshot / schema:snapshot:local script.

set -uo pipefail
cd "$(dirname "$0")/.."

SNAPSHOT="database/schema-types.snapshot.ts"
HEADER='// AUTO-GENERATED SNAPSHOT of the live public schema types — do not edit by hand.
// Regenerate with: pnpm schema:snapshot (prod) or pnpm schema:snapshot:local (local) — see scripts/check-schema-drift.sh'

usage() {
  echo "Usage: $0 --local | --project-ref <ref>" >&2
  exit 1
}

target=""
case "${1:-}" in
  --local)
    target="local"
    ;;
  --project-ref)
    target="project-ref"
    ref="${2:-}"
    [ -n "$ref" ] || usage
    ;;
  *)
    usage
    ;;
esac

if [ ! -f "$SNAPSHOT" ]; then
  echo "FAIL: $SNAPSHOT is missing. Create it with: pnpm schema:snapshot / schema:snapshot:local"
  exit 1
fi

current="$(mktemp)"
baseline="$(mktemp)"
trap 'rm -f "$current" "$baseline"' EXIT
{
  printf '%s\n' "$HEADER"
  if [ "$target" = "local" ]; then
    npx supabase gen types typescript --local --schema public 2>/dev/null
  else
    npx supabase gen types typescript --project-id "$ref" --schema public 2>/dev/null
  fi
} > "$current"

if ! grep -q "export type Database" "$current"; then
  if [ "$target" = "local" ]; then
    echo "SKIP: could not generate types (is 'supabase start' running?)."
  else
    echo "SKIP: could not generate types (no access token / bad project ref)."
  fi
  exit 0
fi

# Normalise before comparing, so the diff reflects real schema drift rather than
# noise from whichever CLI version happened to generate each side:
#   - __InternalSupabase's PostgrestVersion block is stamped by the CLI/postgrest
#     version, not by the schema — local (whatever's in this checkout's
#     node_modules) and prod (pinned separately) commonly disagree here even
#     when the actual tables are identical.
#   - trailing blank lines vary the same way.
strip_cli_noise() {
  sed '/^  \/\/ Allows to automatically instantiate createClient/,/^  }$/d' "$1" \
    | sed -e :a -e '/^\n*$/{$d;N;ba' -e '}'
}
strip_cli_noise "$SNAPSHOT" > "$baseline"
strip_cli_noise "$current" > "$current.stripped" && mv "$current.stripped" "$current"

if diff -q "$baseline" "$current" >/dev/null; then
  echo "OK: $target schema matches the snapshot."
  exit 0
fi

echo "DRIFT: the $target schema differs from $SNAPSHOT."
echo "Diff:"
echo "-----------------------------------------------------------------"
diff "$baseline" "$current" | head -80
echo "-----------------------------------------------------------------"
if [ "$target" = "local" ]; then
  echo "If this change is intended, refresh with: pnpm schema:snapshot:local"
else
  echo "If this change is intended, refresh with: pnpm schema:snapshot"
fi
exit 1
