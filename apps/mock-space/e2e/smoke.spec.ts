import { test, expect } from '@playwright/test';
import { openDemo, startClock } from './helpers';

test('the demo opens a real attempt on the sample paper', async ({ page }) => {
  await openDemo(page);
  // The clock is present and idle, showing the 5-minute demo duration.
  await expect(page.getByTestId('clock')).toBeVisible();
  await expect(page.getByTestId('timer-start')).toBeVisible();
});

test('the paper is read-only until the clock is started', async ({ page }) => {
  await openDemo(page);

  // Before Start, a click on the page must not create an answer box.
  const surface = page.locator('[data-page="0"] > div').first();
  await surface.click({ position: { x: 100, y: 100 } });
  await expect(page.locator('[data-box]')).toHaveCount(0);

  await startClock(page);
  await surface.click({ position: { x: 100, y: 100 } });
  await expect(page.locator('[data-box]')).toHaveCount(1);
});
