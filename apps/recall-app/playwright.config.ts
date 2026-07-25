import { defineConfig, devices } from '@playwright/test';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';
import { loadEnv } from 'vite';

// Everything Supabase is network-stubbed, so the e2e run needs no real project.
// The dev server is started in `test` mode below (--mode test), which loads the
// committed .env.test — a dummy localhost URL with no secrets, so this works in
// CI with nothing configured. The Playwright runner process does NOT load env on
// its own, and the seeding fixture needs VITE_SUPABASE_URL to derive the storage
// key the client reads, so load the SAME file the dev server will and expose it.
const envDir = dirname(fileURLToPath(import.meta.url));
const env = loadEnv('test', envDir, 'VITE_');
process.env.VITE_SUPABASE_URL = env.VITE_SUPABASE_URL;

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: 'html',
  use: {
    baseURL: 'http://localhost:8081',
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
    url: 'http://localhost:8081',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
