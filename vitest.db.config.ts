/// <reference types="vitest/config" />
import { defineConfig, loadEnv } from "vite";
import path from "node:path";

// The database security suite. Deliberately NOT part of `pnpm test`:
//
//   - it needs network access and a real project,
//   - it asserts things about the *deployed* database, not about this checkout,
//     so a green unit run must not imply a green security run and vice versa.
//
// Run it with `pnpm test:db`.
//
// Credentials come from apps/recall-app/.env. The anon key is the right
// credential to test with precisely because it is not a secret: it ships inside
// every client bundle, so it is exactly what an attacker holds. The suite never
// uses the service role key.
// Locally this reads apps/recall-app/.env; in CI that file does not exist and the
// values arrive as real environment variables instead. Listed explicitly rather
// than relying on loadEnv's own process.env merging, so the CI path is obvious.
const fromFile = loadEnv("", path.resolve(__dirname, "apps/recall-app"), "VITE_");

const env = {
  VITE_SUPABASE_URL: process.env.VITE_SUPABASE_URL ?? fromFile.VITE_SUPABASE_URL ?? "",
  VITE_SUPABASE_PUBLISHABLE_KEY:
    process.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? fromFile.VITE_SUPABASE_PUBLISHABLE_KEY ?? "",
};

export default defineConfig({
  test: {
    name: "db-security",
    environment: "node",
    include: ["database/tests/**/*.test.ts"],
    env,
    // Every assertion is a network round trip to the project's region.
    testTimeout: 30_000,
    hookTimeout: 30_000,
  },
});
