import { test, expect } from '@playwright/test';
import { seedAuth, testUserId } from './support/auth';

/**
 * The starter-sets catalog imports a curated set into vocabulary_sets +
 * vocabulary_items with no account and no backend. The stub in support/auth.ts
 * answers reads only and ignores the HTTP method, so the write assertions below
 * register their own vocabulary_sets / vocabulary_items routes AFTER seedAuth
 * (last route registered wins) and branch on method to capture the POST bodies.
 */

const CORS = { 'access-control-allow-origin': '*' };

test('importing a starter set inserts the set then its items', async ({ page, context }) => {
  const inserts: { table: string; body: unknown }[] = [];

  await seedAuth(context, { folders: [], set_progress: [], vocabulary_items: [] });

  await context.route('**/rest/v1/vocabulary_sets*', (route) => {
    const req = route.request();
    if (req.method() === 'POST') {
      const body = req.postDataJSON();
      inserts.push({ table: 'vocabulary_sets', body });
      const row = Array.isArray(body) ? body[0] : body;
      return route.fulfill({
        status: 201,
        contentType: 'application/json',
        headers: CORS,
        body: JSON.stringify({ ...row, id: 'new-set-id' }),
      });
    }
    // Initial "what have I already imported?" read — nothing yet.
    return route.fulfill({ status: 200, contentType: 'application/json', headers: CORS, body: '[]' });
  });

  await context.route('**/rest/v1/vocabulary_items*', (route) => {
    const req = route.request();
    if (req.method() === 'POST') {
      inserts.push({ table: 'vocabulary_items', body: req.postDataJSON() });
    }
    return route.fulfill({ status: 201, contentType: 'application/json', headers: CORS, body: '[]' });
  });

  await page.goto('/starter-sets');

  const card = page.getByTestId('starter-set-fr-greetings');
  await expect(card).toBeVisible();
  await card.getByRole('button', { name: /import set/i }).click();

  await expect(page.getByText(/added to your sets/i)).toBeVisible();
  // The button now reflects the imported state.
  await expect(card.getByRole('button', { name: /import again/i })).toBeVisible();

  const setInsert = inserts.find((i) => i.table === 'vocabulary_sets');
  const itemsInsert = inserts.find((i) => i.table === 'vocabulary_items');
  expect(setInsert, 'vocabulary_sets POST captured').toBeTruthy();
  expect(itemsInsert, 'vocabulary_items POST captured').toBeTruthy();

  const setBody = Array.isArray(setInsert!.body) ? setInsert!.body[0] : (setInsert!.body as Record<string, unknown>);
  expect(setBody).toMatchObject({ user_id: testUserId, language: 'french' });
  expect(String(setBody.name)).toContain('French');

  const itemsBody = itemsInsert!.body as Array<{ set_id: string; term: string; definition: string }>;
  expect(Array.isArray(itemsBody)).toBe(true);
  expect(itemsBody.length).toBeGreaterThan(5);
  expect(itemsBody[0]).toMatchObject({ set_id: 'new-set-id' });
  expect(itemsBody[0].term).toBeTruthy();
  expect(itemsBody[0].definition).toBeTruthy();
});

test('the catalog is reachable from the dashboard', async ({ page, context }) => {
  await seedAuth(context, { vocabulary_sets: [], folders: [], vocabulary_items: [], set_progress: [] });
  await page.goto('/');
  await page.getByRole('link', { name: 'Starter Sets', exact: true }).click();
  await expect(page).toHaveURL(/starter-sets/);
  await expect(page.getByRole('heading', { name: 'Starter Sets' })).toBeVisible();
});
