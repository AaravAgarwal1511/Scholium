import { defineConfig } from '@playwright/test';
import base from './playwright.config';

// Visual regression, kept OUT of the default e2e run. Baselines are
// platform-specific (Playwright suffixes -darwin/-linux) and font rasterisation
// differs across OSes, so the committed baselines are a LOCAL guard. CI
// enforcement needs Linux baselines — see .github/workflows/visual-baselines.yml.
// Run: pnpm --filter <app> test:visual   (refresh: append -- --update-snapshots)
export default defineConfig({
  ...base,
  testDir: './e2e-visual',
  testMatch: '**/*.visual.ts',
  workers: 1,
  fullyParallel: false,
  retries: 0,
  reporter: [['list']],
  expect: {
    toHaveScreenshot: {
      maxDiffPixelRatio: 0.02,
      animations: 'disabled',
      scale: 'css',
    },
  },
});
