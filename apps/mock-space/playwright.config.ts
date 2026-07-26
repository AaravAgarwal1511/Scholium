import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  // One worker locally: the append-only journey drives a shared dev server and a
  // real PDF render, and parallel attempts on one origin only add flake.
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'html',
  use: {
    baseURL: 'http://localhost:3050',
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    // --mode test loads the committed .env.test (dummy localhost URL, no secrets),
    // so /demo's Supabase client constructs and the run needs nothing configured —
    // it works in CI as-is. Demo is signed out and never calls Supabase anyway.
    command: 'pnpm exec vite --mode test',
    url: 'http://localhost:3050',
    reuseExistingServer: !process.env.CI,
    // pdf.js + a cold Vite start; give it room.
    timeout: 120_000,
  },
});
