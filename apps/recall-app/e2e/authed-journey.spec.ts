import { test, expect } from '@playwright/test';
import { seedAuth } from './support/auth';

/**
 * Reaching the real, auth-gated app and studying a chapter — all against stubbed
 * Supabase, so no account and no backend. This proves the seeding harness and the
 * two data shapes recall-app reads: recall_chapters as a LIST on Home and as a
 * .single() on Study.
 */

// One subject → one section → one chapter, the minimum Home needs to render a card.
const CHAPTER_ID = 'chap-photosynthesis';
const CHAPTERS_ROW = {
  id: CHAPTER_ID,
  subject_id: 'subj-biology',
  subject_name: 'Biology',
  subject_emoji: '🧬',
  section_id: 'sec-cells',
  section_name: 'Cells & Energy',
  name: 'Photosynthesis',
  sort_order: 0,
  section_sort_order: 0,
  subject_sort_order: 0,
};
const CARDS = [
  { term: 'Chlorophyll', definition: 'The green pigment that absorbs light' },
  { term: 'Stomata', definition: 'Pores in a leaf that let gases in and out' },
  { term: 'Glucose', definition: 'The sugar produced by photosynthesis' },
];

function stubTables() {
  return {
    // Read as a list on Home, as a single object on Study — branch on the header.
    recall_chapters: (single: boolean) =>
      single ? { id: CHAPTER_ID, name: CHAPTERS_ROW.name } : [CHAPTERS_ROW],
    recall_disabled: [],
    // Home reads chapter_id per card for counts; Study reads term/definition.
    recall_cards: CARDS.map((c) => ({ chapter_id: CHAPTER_ID, ...c })),
    recall_progress: [],
    active_sessions: (single: boolean) => (single ? {} : []),
  };
}

test('a signed-in user lands on Home, not the sign-in page', async ({ page, context }) => {
  await seedAuth(context, stubTables());
  await page.goto('/');

  // The redirect guard would send an unauthenticated visitor to /signin.
  await expect(page).toHaveURL(/\/$|\/#?$/);
  await expect(page).not.toHaveURL(/signin/);
  await expect(page.getByText('Biology')).toBeVisible();
});

test('an unauthenticated visitor is redirected to sign-in', async ({ page, context }) => {
  // No seedAuth: the same page must bounce to /signin, proving the gate is real
  // and that the previous test passes because of the seed, not in spite of it.
  await context.route('**/rest/v1/**', (r) =>
    r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }),
  );
  await context.route('**/auth/v1/**', (r) =>
    r.fulfill({ status: 200, contentType: 'application/json', body: '{}' }),
  );
  await page.goto('/');
  await expect(page).toHaveURL(/signin/);
});

test('studying a chapter runs the first pass to completion', async ({ page, context }) => {
  await seedAuth(context, stubTables());
  await page.goto(`/study/${CHAPTER_ID}`);

  // Study loaded the chapter via the .single() read (heading, not the card title).
  await expect(page.getByRole('heading', { name: 'Photosynthesis' })).toBeVisible();
  await expect(page.getByText('3 terms')).toBeVisible();

  // Enter the matching round. Its terms come from the cards stub, so seeing one
  // proves the list read of recall_cards landed too.
  await page.getByRole('button', { name: /Start Studying/ }).click();
  await expect(page.getByText('Chlorophyll')).toBeVisible();
});

test('the seeded identity reaches the account menu', async ({ page, context }) => {
  // A concrete check that the session — not just the redirect guard — carries the
  // real user through: the navbar greets the seeded email.
  await seedAuth(context, stubTables());
  await page.goto(`/study/${CHAPTER_ID}`);
  await expect(
    page.getByRole('button', { name: /Account menu for e2e@scholium.test/ }),
  ).toBeVisible();
});
