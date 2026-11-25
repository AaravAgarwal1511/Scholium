import { defineConfig, devices } from "@playwright/test";

// The /blog route (@repo/blog) tested as it is deployed: a production build in
// --mode test, served by `vite preview`, where the @repo/blog/vite plugin sends
// /blog/* through the same built function Vercel runs (dist-server/blog.js). Posts
// come from a fake Supabase (e2e/support/stub-supabase.mjs). Unlike the other
// apps' stubs it must be a real server: posts are fetched by the server renderer,
// where Playwright's page.route() cannot reach. The test build bakes .env.test's
// stub URL into the browser bundle too, so client-side navigation hits the same
// fixtures.
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: "html",
  use: {
    baseURL: "http://localhost:3031",
    trace: "on-first-retry",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: [
    {
      command: "node e2e/support/stub-supabase.mjs",
      port: 54399,
      reuseExistingServer: !process.env.CI,
    },
    {
      command: "pnpm exec vite build --mode test && pnpm exec vite preview --mode test --port 3031 --strictPort",
      url: "http://localhost:3031/blog",
      reuseExistingServer: !process.env.CI,
      timeout: 180_000,
    },
  ],
});
