import { test, expect } from '@playwright/test';
import { seedAuth, stubStorage, testUserId } from './support/auth';

/**
 * poetry-notes gates the whole app behind auth (App renders <Login /> when there
 * is no session) and keeps projects in a storage bucket rather than tables. This
 * proves both halves of the harness: the seeded session gets past Login, and the
 * storage stub feeds the project index the landing page reads.
 */

const PROJECT_ID = 'proj-road-not-taken';
const INDEX = [
  { projectId: PROJECT_ID, title: 'The Road Not Taken', lastModified: '2026-02-01T00:00:00.000Z' },
];
const PROJECT = {
  projectId: PROJECT_ID,
  version: '1.0',
  title: 'The Road Not Taken',
  createdAt: '2026-01-01T00:00:00.000Z',
  lastModified: '2026-02-01T00:00:00.000Z',
  poem: { content: '<p>Two roads diverged in a yellow wood</p>', highlights: [] },
  notes: [],
  connections: [],
};

async function seed(context: Parameters<typeof seedAuth>[0]) {
  await seedAuth(context);
  await stubStorage(context, {
    // Keyed by path suffix; the app requests <uid>/_index.json and <uid>/<id>.json.
    '_index.json': INDEX,
    [`${testUserId}/${PROJECT_ID}.json`]: PROJECT,
  });
}

test('a signed-in user reaches the landing page, not the login form', async ({ page, context }) => {
  await seed(context);
  await page.goto('/');

  // The landing page's own heading — Login would show the AuthCard instead.
  await expect(page.getByRole('heading', { name: 'Poetry Notes.' })).toBeVisible();
  await expect(page.getByText('Continue Project')).toBeVisible();
});

test('an unauthenticated visitor sees the sign-in form', async ({ page, context }) => {
  // No seed: the app renders <Login />, which mounts @repo/ui's AuthCard.
  await context.route('**/rest/v1/**', (r) =>
    r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }),
  );
  await context.route('**/auth/v1/**', (r) =>
    r.fulfill({ status: 200, contentType: 'application/json', body: '{}' }),
  );
  await page.goto('/');
  await expect(page.getByRole('button', { name: /Create Account/ })).toBeVisible();
});

test('the saved project appears in the project list from storage', async ({ page, context }) => {
  await seed(context);
  await page.goto('/');

  // Continue Project → the "open" screen, which downloads <uid>/_index.json.
  await page.getByText('Continue Project').click();
  await expect(page.getByText('The Road Not Taken')).toBeVisible();
});
