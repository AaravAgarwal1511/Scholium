#!/usr/bin/env bash
#
# Local database test mechanism for the language-hub default-vocab-sets work.
#
#   1. checks Docker is up
#   2. starts the local Supabase stack if it isn't already running
#   3. `supabase db reset` — replays every migration in database/migrations/
#      (including 20260901000000_practice_sample_user_scope.sql) and seeds
#      database/seed.sql
#   4. runs database/tests/local/ against 127.0.0.1:54321
#
# Anything after `--` is passed through to vitest, e.g.
#   pnpm test:db:local -- --reporter=verbose
#   pnpm test:db:local -- -t "practice_sample"
#
# Manual poke-around instead of the suite: after step 3, run
#   pnpm dev --filter language-hub
# language-hub's committed .env.development already points at the local stack.
# Sign in as seed-user-1@example.com / seed-password-1 (and …-2 for the second
# account) — both are created by database/seed.sql.

set -euo pipefail

cd "$(dirname "$0")/.."

SUPABASE="pnpm exec supabase"

if ! docker info >/dev/null 2>&1; then
  echo "✗ Docker isn't running. Start Docker Desktop, wait for it to settle, then re-run." >&2
  exit 1
fi

if $SUPABASE status >/dev/null 2>&1; then
  echo "• Local Supabase already running."
else
  echo "• Starting local Supabase (first run pulls images — a few minutes)…"
  $SUPABASE start
fi

echo "• Resetting local DB: replaying database/migrations/ + seeding database/seed.sql…"
$SUPABASE db reset

# `db reset` ends with "Restarting containers…" and returns before GoTrue is
# back — an immediate sign-in then 502s. Wait for the auth service to answer.
API_URL="$($SUPABASE status -o env 2>/dev/null | sed -n 's/^API_URL="\(.*\)"$/\1/p')"
API_URL="${API_URL:-http://127.0.0.1:54321}"
printf '• Waiting for auth service at %s…' "$API_URL"
for _ in $(seq 1 60); do
  if curl -fsS "$API_URL/auth/v1/health" >/dev/null 2>&1; then
    echo " ready."
    break
  fi
  printf '.'
  sleep 1
done

echo "• Running language-hub scoping + starter-set suite…"
pnpm exec vitest run --config vitest.db.local.config.ts "$@"
