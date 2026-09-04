import { test, expect } from '@playwright/test';
import { seedAuth, stubNotesStorage } from '../e2e/support/auth';

// List page only. The viewer is a stubbed <iframe> src — it renders browser
// error chrome under Playwright, so a snapshot of it would be meaningless.
test('notes list', async ({ page, context }) => {
  await seedAuth(context);
  await stubNotesStorage(context, [
    '1-Electricity-and-Magnetism.pdf',
    '2-Kinematics.pdf',
    '3-Waves-and-Sound.pdf',
    'Reference tables.pdf',
  ]);
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Notes.' })).toBeVisible();
  await page.waitForTimeout(500);
  await expect(page).toHaveScreenshot('notes-list.png', { fullPage: true });
});
