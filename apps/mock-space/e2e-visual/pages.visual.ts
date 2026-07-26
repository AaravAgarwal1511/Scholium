import { test, expect } from '@playwright/test';

// mock-space home is signed-out and static (no live data), so it needs no
// seeding. The canvas-heavy attempt page is deliberately not snapshotted — pdf.js
// rasterisation varies by platform; it is covered functionally by the e2e specs.
test('home', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('link', { name: /demo|try/i }).first().or(page.locator('body'))).toBeVisible();
  await page.waitForTimeout(500);
  await expect(page).toHaveScreenshot('home.png', { fullPage: true });
});
