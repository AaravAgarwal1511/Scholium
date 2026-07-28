#!/usr/bin/env bash
#
# Typecheck ratchet.
#
# `check-types` is not wired into `build` (vite build never typechecks), and two
# apps carry known pre-existing errors — language-hub (23) and recall-app (7).
# Most of them trace to `.from("scholium_apps")`: that table is absent from both
# apps' generated src/integrations/supabase/types.ts, so the typed client
# resolves the query against the tables it does know and App.tsx casts past the
# resulting SelectQueryError with `as AppLink[]`. Fixing it needs a types regen.
#
# Failing CI on a non-zero count would mean disabling the check entirely, so
# instead this ratchets: the debt may shrink, never grow. Lower BASELINE
# whenever you pay some down — the script tells you when to.
#
# Turbo aborts sibling tasks as soon as one fails, so --continue is required or
# the count is whatever the first failing package happened to report.

set -uo pipefail

BASELINE=30

cd "$(dirname "$0")/.."

output=$(pnpm exec turbo run check-types --continue --output-logs=full 2>&1)
count=$(printf '%s\n' "$output" | grep -c "error TS")

echo "--- errors by package ---"
printf '%s\n' "$output" | grep "error TS" | sed 's/:.*//' | sed 's|/src/.*||' \
  | sort | uniq -c | sort -rn
echo "-------------------------"
echo "total: $count   baseline: $BASELINE"

if [ "$count" -gt "$BASELINE" ]; then
  echo
  echo "FAIL: $((count - BASELINE)) new type error(s) introduced."
  printf '%s\n' "$output" | grep "error TS"
  exit 1
fi

if [ "$count" -lt "$BASELINE" ]; then
  echo
  echo "$((BASELINE - count)) error(s) fixed since the baseline was set."
  echo "Lower BASELINE in scripts/check-types-ratchet.sh to $count to lock that in."
fi

echo "OK"
