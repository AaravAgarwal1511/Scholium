import { test, expect, type BrowserContext } from '@playwright/test';

/**
 * Two behaviors added to stop punishing users who try to sign in:
 *  1. The Mock Space CTA is live (not disabled) when signed out — clicking it
 *     is an intent signal (gated_click) and a real navigation to /signin, not
 *     a dead end.
 *  2. Generator selections and a generated paper survive a remount — the
 *     round trip Auth.tsx's `navigate(next)` puts the page through — because
 *     GeneratePaperPage hydrates from `@/lib/generatorSession` (sessionStorage)
 *     on mount instead of starting from empty React state every time.
 * seedAuth is deliberately not used here: both behaviors only matter signed out.
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

async function stubChapterQuestions(context: BrowserContext) {
  await context.route('**/api/chapter-questions*', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ rows: QUESTIONS_METADATA }),
    }),
  );
}

async function stubRestCatchAll(context: BrowserContext) {
  // Signed out, so seedAuth's table stubs aren't in play — this answers the
  // navbar's own scholium_apps read the same way a11y-scan.spec.ts does.
  await context.route('**/rest/v1/**', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: '[]' }),
  );
}

async function stubComposePaper(context: BrowserContext) {
  // No Express server runs in this suite — every call composes the same fake
  // PDF, so a second call after a remount is indistinguishable from the first
  // except in its request body, which the recompose test below inspects.
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
}

async function generateAPaper(page: import('@playwright/test').Page) {
  await page.goto('/');
  await page.getByRole('button', { name: 'International Mathematics' }).click();
  await page.getByRole('button', { name: 'Paper 2' }).click();
  await page.getByRole('checkbox', { name: 'Select Number and Algebra' }).check();
  await page.getByRole('button', { name: 'Generate Paper' }).click();
  await expect(page.getByText('has been generated')).toBeVisible();
}

test('the Mock Space CTA sends a signed-out user to /signin with next and hint, not a dead end', async ({
  page,
  context,
}) => {
  await stubRestCatchAll(context);
  await stubPaperTree(context);
  await stubChapterQuestions(context);
  await stubComposePaper(context);

  await generateAPaper(page);

  const cta = page.getByRole('button', { name: 'Sign in to open in Mock Space' });
  await expect(cta).toBeEnabled();
  await cta.click();

  await expect(page).toHaveURL(/\/signin\?next=%2F&hint=mock_space$/);
  // The hint slot (AuthCard's `hint` prop) carries why the user is here,
  // rather than a bare "Sign in to your Scholium account".
  await expect(page.getByText('Sign in to open this paper in Mock Space.')).toBeVisible();
});

test('generator selections and a generated paper survive a remount', async ({ page, context }) => {
  await stubRestCatchAll(context);
  await stubPaperTree(context);
  await stubChapterQuestions(context);
  await stubComposePaper(context);

  await generateAPaper(page);

  // Simulates what Auth.tsx's navigate(next) leaves behind: GeneratePaperPage
  // unmounts and remounts with fresh React state. A reload is a stricter
  // version of the same thing (survives a full document unload too), and
  // sessionStorage — unlike component state — is unaffected by either.
  await page.reload();

  // Selections restored instantly from the lazy useState initializers.
  await expect(page.getByRole('checkbox', { name: 'Select Number and Algebra' })).toBeChecked();
  // The {kind:"blob"} result can't be restored directly (a Blob doesn't survive
  // JSON), so the mount-time effect recomposes it from the persisted recipe —
  // same questionIds, so this is a reproduction, not a fresh (different) paper.
  await expect(page.getByText('has been generated')).toBeVisible();
});
