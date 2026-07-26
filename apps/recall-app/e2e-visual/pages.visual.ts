import { test, expect } from '@playwright/test';
import { seedAuth } from '../e2e/support/auth';

/**
 * Full-page visual baselines for recall-app's HTML pages, driven through the same
 * network-stubbed seeding as the journey specs — so the render is deterministic
 * (no live data, fixed dates). Canvas/PDF surfaces are avoided; those vary by
 * platform and are covered functionally elsewhere.
 */

const CHAPTER_ID = 'chap-photosynthesis';
const stub = {
  recall_chapters: (single: boolean) =>
    single
      ? { id: CHAPTER_ID, name: 'Photosynthesis' }
      : [
          {
            id: CHAPTER_ID, subject_id: 'subj-biology', subject_name: 'Biology',
            subject_emoji: '🧬', section_id: 'sec-cells', section_name: 'Cells & Energy',
            name: 'Photosynthesis', sort_order: 0, section_sort_order: 0, subject_sort_order: 0,
          },
        ],
  recall_disabled: [],
  recall_cards: [
    { chapter_id: CHAPTER_ID, term: 'Chlorophyll', definition: 'The green pigment' },
    { chapter_id: CHAPTER_ID, term: 'Stomata', definition: 'Leaf pores' },
  ],
  recall_progress: [],
  active_sessions: (single: boolean) => (single ? {} : []),
};

test('home', async ({ page, context }) => {
  await seedAuth(context, stub);
  await page.goto('/');
  await expect(page.getByText('Biology')).toBeVisible();
  await page.waitForTimeout(500); // let entrance transitions settle
  await expect(page).toHaveScreenshot('home.png', { fullPage: true });
});

test('study-overview', async ({ page, context }) => {
  await seedAuth(context, stub);
  await page.goto(`/study/${CHAPTER_ID}`);
  await expect(page.getByRole('button', { name: /Start Studying/ })).toBeVisible();
  await page.waitForTimeout(500);
  await expect(page).toHaveScreenshot('study-overview.png', { fullPage: true });
});
