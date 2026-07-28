import { test, expect } from '@playwright/test';
import { seedAuth, testUserId } from '../e2e/support/auth';

// Dashboard render is deterministic under the stubbed seeding (fixed set, dates).
const SET = {
  id: 'set-french-basics', user_id: testUserId, name: 'French Basics',
  description: 'Everyday words and phrases', language: 'french', folder_id: null,
  created_at: '2026-01-01T00:00:00.000Z',
};

test('dashboard', async ({ page, context }) => {
  await seedAuth(context, {
    vocabulary_sets: [SET],
    folders: [],
    vocabulary_items: [{ id: 'i1', set_id: SET.id, term: 'bonjour', definition: 'hello', created_at: '2026-01-01T00:00:01.000Z' }],
    set_progress: [],
  });
  await page.goto('/');
  await expect(page.getByText('French Basics')).toBeVisible();
  await page.waitForTimeout(500);
  await expect(page).toHaveScreenshot('dashboard.png', { fullPage: true });
});
