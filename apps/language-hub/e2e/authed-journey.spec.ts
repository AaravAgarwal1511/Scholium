import { test, expect } from '@playwright/test';
import { seedAuth, testUserId } from './support/auth';

/**
 * Reaching language-hub's auth-gated dashboard and opening a set — all against
 * stubbed Supabase, no account, no backend. Proves the seeding harness here and
 * the two reads the Index makes: vocabulary_sets and folders, both as lists.
 */

const SET_ID = 'set-french-basics';
const VOCAB_SET = {
  id: SET_ID,
  user_id: testUserId,
  name: 'French Basics',
  description: 'Everyday words and phrases',
  language: 'french',
  folder_id: null,
  created_at: '2026-01-01T00:00:00.000Z',
};

// Columns are term/definition (see the VocabularyItem type), not word/translation.
const ITEMS = [
  { id: 'i1', set_id: SET_ID, term: 'bonjour', definition: 'hello', created_at: '2026-01-01T00:00:01.000Z' },
  { id: 'i2', set_id: SET_ID, term: 'merci', definition: 'thank you', created_at: '2026-01-01T00:00:02.000Z' },
  { id: 'i3', set_id: SET_ID, term: 'chat', definition: 'cat', created_at: '2026-01-01T00:00:03.000Z' },
];

function stubTables() {
  return {
    vocabulary_sets: [VOCAB_SET],
    // Folders may not exist pre-migration; the Index tolerates an empty list.
    folders: [],
    // Read as a list on the study pages, and as a head-count on the dashboard —
    // returning the rows satisfies both (the count read ignores the body).
    vocabulary_items: ITEMS,
    set_progress: [],
  };
}

test('a signed-in user lands on the dashboard, not sign-in', async ({ page, context }) => {
  await seedAuth(context, stubTables());
  await page.goto('/');

  await expect(page).not.toHaveURL(/signin/);
  await expect(page.getByText('French Basics')).toBeVisible();
});

test('an unauthenticated visitor is redirected to sign-in', async ({ page, context }) => {
  await context.route('**/rest/v1/**', (r) =>
    r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }),
  );
  await context.route('**/auth/v1/**', (r) =>
    r.fulfill({ status: 200, contentType: 'application/json', body: '{}' }),
  );
  await page.goto('/');
  await expect(page).toHaveURL(/signin/);
});

test('the set opens into its first-pass study flow', async ({ page, context }) => {
  await seedAuth(context, {
    ...stubTables(),
    // Study/first-pass reads the single set plus its items.
    vocabulary_sets: (single: boolean) => (single ? VOCAB_SET : [VOCAB_SET]),
  });
  await page.goto(`/first-pass/${SET_ID}`);

  // The set loaded via .single() (its name heads the page) and its three items
  // loaded via the list read (the progress counter reflects the count).
  await expect(page.getByRole('heading', { name: 'French Basics' })).toBeVisible();
  await expect(page.getByText('Term 1 of 3')).toBeVisible();
});
