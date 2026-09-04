import { test, expect } from '@playwright/test';
import { seedAuth, stubNotesStorage } from './support/auth';

test('signed out, the list redirects to sign in', async ({ page, context }) => {
  // No seedAuth: no session. Stub rest/v1 so the navbar's scholium_apps read
  // resolves rather than hanging on a refused connection.
  await context.route('**/rest/v1/**', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: '[]' }),
  );

  await page.goto('/');

  await expect(page).toHaveURL(/\/signin/);
  await expect(
    page.getByRole('heading', { name: 'Sign in to your Scholium account' }),
  ).toBeVisible();
});

test('signed in, the list shows the notes in order', async ({ page, context }) => {
  await seedAuth(context);
  await stubNotesStorage(context, [
    '2-Kinematics.pdf',
    '1-Electricity-and-Magnetism.pdf',
    'Reference tables.pdf',
  ]);

  await page.goto('/');

  await expect(page.getByRole('heading', { name: 'Notes.' })).toBeVisible();

  const links = page.getByRole('link').filter({ hasText: /Kinematics|Electricity|Reference tables/ });
  await expect(links).toHaveText([
    /Electricity and Magnetism/,
    /Kinematics/,
    /Reference tables/,
  ]);
});
