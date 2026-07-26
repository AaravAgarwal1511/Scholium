import { test, expect } from '@playwright/test';
import { seedAuth, stubStorage, testUserId } from '../e2e/support/auth';

const PROJECT_ID = 'proj-1';
const INDEX = [{ projectId: PROJECT_ID, title: 'The Road Not Taken', lastModified: '2026-02-01T00:00:00.000Z' }];

test('landing', async ({ page, context }) => {
  await seedAuth(context);
  await stubStorage(context, { '_index.json': INDEX, [`${testUserId}/${PROJECT_ID}.json`]: {} });
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Poetry Notes.' })).toBeVisible();
  await page.waitForTimeout(500);
  await expect(page).toHaveScreenshot('landing.png', { fullPage: true });
});
