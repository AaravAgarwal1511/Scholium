import { test, expect, type BrowserContext } from '@playwright/test';
import { seedAuth } from './support/auth';

/**
 * The past-papers browse journey: subjects → components → chapters. Unlike the
 * other apps, browsing here is NOT auth-gated, and with VITE_R2_PUBLIC_URL unset
 * (the .env.test default) papers.ts lists from the Supabase Storage bucket rather
 * than the paper_files table. So the surface to stub is the storage LIST endpoint
 * (`POST /storage/v1/object/list/<bucket>`), whose folder tree we fake by
 * branching on the `prefix` in the request body. seedAuth still runs, to answer
 * the navbar's own scholium_apps read and show the signed-in state.
 */

// The bucket's folder tree, keyed by the prefix papers.ts lists with. Folder
// entries have id === null (that is how listFolders tells them from files).
const folder = (name: string) => ({ name, id: null });
const file = (name: string, id: string) => ({ name, id });

const TREE: Record<string, unknown[]> = {
  // Subjects: the top level. "0607" → "International Mathematics" via the display map.
  '': [folder('0607')],
  // Components under the subject.
  '0607': [folder('Paper 2')],
  // Files under the component, grouped into chapters by parseFileName.
  '0607/Paper 2': [
    file('3-Number-and-Algebra-QP.pdf', 'f1'),
    file('3-Number-and-Algebra-MS.pdf', 'f2'),
  ],
};

async function stubPaperTree(context: BrowserContext) {
  await context.route('**/storage/v1/object/list/**', (route) => {
    const prefix = (route.request().postDataJSON()?.prefix ?? '').replace(/\/$/, '');
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(TREE[prefix] ?? []),
    });
  });
}

test('the subjects list renders from storage with friendly names', async ({ page, context }) => {
  await seedAuth(context);
  await stubPaperTree(context);
  await page.goto('/');

  // "0607" is shown via subjectDisplayName, proving listSubjects → storage worked.
  await expect(page.getByText('International Mathematics')).toBeVisible();
});

test('drilling subject → component → chapter walks the storage tree', async ({ page, context }) => {
  await seedAuth(context);
  await stubPaperTree(context);
  await page.goto('/');

  await page.getByRole('link', { name: /International Mathematics/ }).click();
  await expect(page).toHaveURL(/\/0607$/);
  await expect(page.getByText('Paper 2')).toBeVisible();

  await page.getByRole('link', { name: /Paper 2/ }).click();
  await expect(page).toHaveURL(/\/0607\/Paper%202$/);
  // parseFileName turned "3-Number-and-Algebra-QP.pdf" into this chapter title.
  await expect(page.getByText('Number and Algebra')).toBeVisible();
});
