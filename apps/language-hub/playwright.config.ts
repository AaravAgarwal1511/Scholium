import { defineConfig, devices } from '@playwright/test';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';
import { loadEnv } from 'vite';

// See apps/recall-app/e2e/support/auth.ts for the full rationale. The Playwright
// runner does not load env; the auth-seeding fixture needs VITE_SUPABASE_URL to
// derive the storage key the client reads. Load the same file the dev server
// loads (in --mode test, the committed .env.test — dummy URL, no secrets).
const envDir = dirname(fileURLToPath(import.meta.url));
const env = loadEnv('test', envDir, 'VITE_');
process.env.VITE_SUPABASE_URL = env.VITE_SUPABASE_URL;

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'html',
  use: {
    baseURL: 'http://localhost:8080',
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    // --mode test loads .env.test, so no real Supabase project is needed.
    command: 'pnpm exec vite --mode test',
    url: 'http://localhost:8080',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
