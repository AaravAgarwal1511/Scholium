/// <reference types="vitest/config" />
import { defineConfig, loadEnv } from "vite";
import path from "node:path";

// Local-only database suite. The counterpart to vitest.db.config.ts (`pnpm
// test:db`), which probes the DEPLOYED project — this one runs against the
// Dockerised local stack (`supabase start` + `supabase db reset`), so it can be
// destructive-ish (it signs in as the seed users and inserts a set) and it
// exercises migrations that are not on prod yet.
//
// Driven by scripts/test-db-local.sh, which brings the stack up, resets it, and
// then runs this. Run bare with `pnpm test:db:local`.
//
// Credentials: apps/language-hub/.env.development already holds the CLI's fixed
// local demo URL + publishable key (committed on purpose — not secrets, see that
// file's header). loadEnv("development", …) picks them up. A real env var still
// wins, so CI or a staging run can point this elsewhere.
const fromFile = loadEnv("development", path.resolve(__dirname, "apps/language-hub"), "VITE_");

const env = {
  VITE_SUPABASE_URL:
    process.env.VITE_SUPABASE_URL ?? fromFile.VITE_SUPABASE_URL ?? "http://127.0.0.1:54321",
  VITE_SUPABASE_PUBLISHABLE_KEY:
    process.env.VITE_SUPABASE_PUBLISHABLE_KEY ??
    fromFile.VITE_SUPABASE_PUBLISHABLE_KEY ??
    "sb_publishable_ACJWlzQHlZjBrEguHvfOxg_3BJgxAaH",
};

export default defineConfig({
  test: {
    name: "db-local",
    environment: "node",
    include: ["database/tests/local/**/*.test.ts"],
    env,
    testTimeout: 30_000,
    hookTimeout: 30_000,
  },
});
