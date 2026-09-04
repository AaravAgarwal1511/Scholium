import { defineConfig, devices } from '@playwright/test';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';
import { loadEnv } from 'vite';

// See e2e/support/auth.ts for the full rationale. --mode test loads the
// committed .env.test (dummy URL, no secrets). The runner is handed the same
// VITE_SUPABASE_URL so the fixture derives the same localStorage key the
// supabase-js client reads its seeded session from.
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
    baseURL: 'http://localhost:3060',
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    command: 'pnpm exec vite --mode test',
    url: 'http://localhost:3060',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
