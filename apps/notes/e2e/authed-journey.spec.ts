import { test, expect } from '@playwright/test';
import { seedAuth, stubNotesStorage } from './support/auth';

test('open a note and reach the viewer on a signed URL', async ({ page, context }) => {
  await seedAuth(context);
  await stubNotesStorage(context, ['3-Waves-and-Sound.pdf', 'Formula sheet.pdf']);

  await page.goto('/');
  await page.getByRole('link', { name: /Waves and Sound/ }).click();

  await expect(page).toHaveURL(/\/notes\/3-Waves-and-Sound\.pdf/);
  await expect(page.getByRole('heading', { name: 'Waves and Sound' })).toBeVisible();

  // The iframe must be pointed at a signed URL, not a bare object path — that is
  // what proves createSignedUrl ran and the private-bucket read path works.
  const iframe = page.locator('iframe[title="Waves and Sound"]');
  await expect(iframe).toHaveAttribute('src', /\/object\/sign\/notes\/.*token=/);

  // Download offers the same signed object, forced to attachment.
  await expect(page.getByRole('link', { name: 'Download' })).toHaveAttribute(
    'href',
    /\/object\/sign\/notes\/.*token=.*download=/,
  );

  await page.getByRole('link', { name: 'All notes' }).click();
  await expect(page).toHaveURL('http://localhost:3060/');
  await expect(page.getByRole('heading', { name: 'Notes.' })).toBeVisible();
});

test('a note whose signed URL fails shows an error, not a blank frame', async ({ page, context }) => {
  await seedAuth(context);
  await stubNotesStorage(context, ['1-Thermodynamics.pdf']);
  // Override the sign route registered by stubNotesStorage: make signing fail.
  await context.route('**/storage/v1/object/sign/notes/**', (route) => {
    if (route.request().method() === 'GET') return route.continue();
    return route.fulfill({ status: 404, contentType: 'application/json', body: '{"error":"Not found"}' });
  });

  await page.goto('/notes/1-Thermodynamics.pdf');

  await expect(page.getByRole('alert')).toContainText(/could not be opened/i);
  await expect(page.locator('iframe')).toHaveCount(0);
});
