import { defineConfig } from '@playwright/test';
import base from './playwright.config';

/**
 * Visual regression, kept OUT of the default e2e run (which uses
 * playwright.config.ts → testDir ./e2e). Screenshots are inherently
 * platform-specific: Playwright suffixes baselines with the OS (`-darwin`,
 * `-linux`), and font rasterisation differs between them. The committed
 * baselines here are whatever platform generated them — a LOCAL guard. CI
 * enforcement needs Linux baselines; see .github/workflows/visual-baselines.yml.
 *
 * Run: pnpm --filter recall-app test:visual
 * Refresh after an intended UI change: append `-- --update-snapshots`.
 */
export default defineConfig({
  ...base,
  testDir: './e2e-visual',
  // These are named *.visual.ts (not *.spec.ts) so the default e2e run never
  // collects them — only this config, via the matcher below, does.
  testMatch: '**/*.visual.ts',
  // Serial: screenshots want a settled, uncontended page.
  workers: 1,
  fullyParallel: false,
  retries: 0,
  reporter: [['list']],
  expect: {
    toHaveScreenshot: {
      // Absorbs sub-pixel antialiasing noise without hiding real layout changes.
      maxDiffPixelRatio: 0.02,
      animations: 'disabled',
      scale: 'css',
    },
  },
});
