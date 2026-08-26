import { test, expect, type BrowserContext } from '@playwright/test';
import { seedAuth } from './support/auth';

/**
 * The past-papers generator journey: subject -> component -> chapter -> generate.
 * Browsing here is NOT auth-gated, and with VITE_R2_PUBLIC_URL unset (the
 * .env.test default) listSubjects/listComponents/listChapters list from the
 * Supabase Storage bucket rather than the paper_files table — so the storage
 * LIST endpoint (`POST /storage/v1/object/list/<bucket>`) is stubbed by
 * branching on the `prefix` in the request body, same as ChaptersPage used to.
 * getChapterQuestions always calls /api/chapter-questions regardless of storage
 * mode (that endpoint reads questions_metadata server-side with the service
 * role — see server/chapter-questions-handler.js — so the browser no longer
 * queries the table directly), so that endpoint is stubbed too via
 * stubChapterQuestions rather than seedAuth's `tables` option, which only
 * covers PostgREST's rest/v1 paths.
 * seedAuth still runs, to answer the navbar's own scholium_apps read and show
 * the signed-in state; /api/compose-paper is stubbed because no server runs in
 * this suite (see playwright.config.ts — only `vite --mode test`, no Express).
 */

const folder = (name: string) => ({ name, id: null });
const file = (name: string, id: string) => ({ name, id });

const TREE: Record<string, unknown[]> = {
  '': [folder('0607')],
  '0607': [folder('Paper 2')],
  '0607/Paper 2': [
    file('3-Number-and-Algebra-QP.pdf', 'f1'),
    file('3-Number-and-Algebra-MS.pdf', 'f2'),
  ],
};

// chapter_num matches the "3-Number-and-Algebra" file above; the P2- prefix
// matches paperNumOf("Paper 2"); the year comes from splitting `paper` on "-".
const QUESTIONS_METADATA = [
  { id: 'P2-001', chapter_num: 3, paper: 'June-2014-1' },
  { id: 'P2-002', chapter_num: 3, paper: 'June-2015-1' },
];

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

// getChapterQuestions's response shape ({ rows: [...] }), not the bare array
// PostgREST returns — see server/chapter-questions-handler.js.
async function stubChapterQuestions(context: BrowserContext) {
  await context.route('**/api/chapter-questions*', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ rows: QUESTIONS_METADATA }),
    }),
  );
}

test('the generator renders at / and walks subject -> component -> chapter', async ({
  page,
  context,
}) => {
  await seedAuth(context);
  await stubPaperTree(context);
  await stubChapterQuestions(context);
  await page.goto('/');

  // "0607" is shown via subjectDisplayName, proving listSubjects -> storage worked.
  await expect(page.getByRole('button', { name: 'International Mathematics' })).toBeVisible();

  await page.getByRole('button', { name: 'International Mathematics' }).click();
  await expect(page.getByRole('button', { name: 'Paper 2' })).toBeVisible();

  await page.getByRole('button', { name: 'Paper 2' }).click();
  // parseFileName turned "3-Number-and-Algebra-QP.pdf" into this chapter title,
  // and questions_metadata supplied the two questions that make it selectable.
  await expect(page.getByText('Chapter 3: Number and Algebra')).toBeVisible();
});

test('/generate redirects to the generator, and an unknown path shows a real 404', async ({
  page,
  context,
}) => {
  await seedAuth(context);

  await page.goto('/generate');
  await expect(page).toHaveURL(/\/$/);

  // /:subject no longer exists — the browsing routes were removed with this
  // feature. It used to fall through to a catch-all redirect to "/", which is
  // exactly the site-wide soft-404 the SEO audit flagged (every invalid URL
  // returned 200 with the homepage). The client route now renders a real
  // NotFound page instead of redirecting — the URL stays put, matching what
  // vercel.json's rewrites + public/404.html do server-side in production.
  await page.goto('/0607');
  await expect(page).toHaveURL(/\/0607$/);
  await expect(page.getByRole('heading', { name: 'Page not found' })).toBeVisible();
});

test('generating a paper shows a result step instead of downloading automatically', async ({
  page,
  context,
}) => {
  await seedAuth(context);
  await stubPaperTree(context);
  await stubChapterQuestions(context);
  // No Express server runs in this suite, so /api/compose-paper is stubbed like
  // every other network call here rather than composed for real.
  await context.route('**/api/compose-paper', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        pdfBase64: Buffer.from('%PDF-1.4 fake').toString('base64'),
        metadata: {},
      }),
    }),
  );

  await page.goto('/');
  await page.getByRole('button', { name: 'International Mathematics' }).click();
  await page.getByRole('button', { name: 'Paper 2' }).click();
  await page.getByRole('checkbox', { name: 'Select Number and Algebra' }).check();
  await page.getByRole('button', { name: 'Generate Paper' }).click();

  await expect(page.getByText('has been generated')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Download paper' })).toBeEnabled();
  // Signed in (seedAuth), so the mock-space handoff button is enabled.
  await expect(page.getByRole('button', { name: 'Open in Mock Space' })).toBeEnabled();

  // Changing the selection after generating invalidates the stale result.
  await page.getByRole('checkbox', { name: 'Select Number and Algebra' }).uncheck();
  await expect(page.getByText('has been generated')).toHaveCount(0);
});

test('opening in Mock Space never leaves a lingering blank tab', async ({ page, context }) => {
  // Regression test: handleOpenInMockSpace used to open a blank tab up front and
  // fill it in once the upload finished, so a slow upload left "about:blank"
  // sitting there. It now only ever calls window.open with the real destination
  // — so the very first thing Playwright observes about the popup is that URL,
  // never a bare "about:blank".
  await seedAuth(context);
  await stubPaperTree(context);
  await stubChapterQuestions(context);
  await context.route('**/api/compose-paper', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        pdfBase64: Buffer.from('%PDF-1.4 fake').toString('base64'),
        metadata: {},
      }),
    }),
  );
  // stageForMockSpace's Storage upload — mock-space itself isn't running in this
  // suite, only the response shape supabase-js's upload() needs to resolve.
  await context.route('**/storage/v1/object/mock-space-papers/**', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ Key: 'mock-space-papers/fake' }),
    }),
  );

  await page.goto('/');
  await page.getByRole('button', { name: 'International Mathematics' }).click();
  await page.getByRole('button', { name: 'Paper 2' }).click();
  await page.getByRole('checkbox', { name: 'Select Number and Algebra' }).check();
  await page.getByRole('button', { name: 'Generate Paper' }).click();
  await expect(page.getByRole('button', { name: 'Open in Mock Space' })).toBeEnabled();

  const [popup] = await Promise.all([
    context.waitForEvent('page'),
    page.getByRole('button', { name: 'Open in Mock Space' }).click(),
  ]);
  expect(popup.url()).not.toBe('about:blank');
  expect(popup.url()).toContain('/open?paper=');
});

test('a blocked popup surfaces a toast with a working retry action', async ({ page, context }) => {
  await seedAuth(context);
  await stubPaperTree(context);
  await stubChapterQuestions(context);
  await context.route('**/api/compose-paper', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        pdfBase64: Buffer.from('%PDF-1.4 fake').toString('base64'),
        metadata: {},
      }),
    }),
  );
  await context.route('**/storage/v1/object/mock-space-papers/**', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ Key: 'mock-space-papers/fake' }),
    }),
  );

  // Simulate the browser's popup blocker: every window.open() call returns
  // null, exactly what a blocked popup looks like from the caller's side.
  await page.addInitScript(() => {
    window.open = () => null;
  });

  await page.goto('/');
  await page.getByRole('button', { name: 'International Mathematics' }).click();
  await page.getByRole('button', { name: 'Paper 2' }).click();
  await page.getByRole('checkbox', { name: 'Select Number and Algebra' }).check();
  await page.getByRole('button', { name: 'Generate Paper' }).click();
  await expect(page.getByRole('button', { name: 'Open in Mock Space' })).toBeEnabled();
  await page.getByRole('button', { name: 'Open in Mock Space' }).click();

  const toast = page.locator('[data-sonner-toast]');
  await expect(toast.getByText('Your browser blocked the new tab')).toBeVisible();
  await expect(toast.getByRole('button', { name: 'Open in Mock Space' })).toBeVisible();
});
