import { test, expect, type BrowserContext, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { seedAuth } from './support/auth';

// No serious/critical WCAG 2.1 A/AA structural violations on the generator page
// — the app's only page now. color-contrast excluded (design-token concern,
// tracked separately).
const TREE: Record<string, unknown[]> = {
  '': [{ name: '0607', id: null }],
  '0607': [{ name: 'Paper 2', id: null }],
  '0607/Paper 2': [
    { name: '3-Number-and-Algebra-QP.pdf', id: 'f1' },
    { name: '3-Number-and-Algebra-MS.pdf', id: 'f2' },
  ],
};

const QUESTIONS_METADATA = [{ id: 'P2-001', chapter_num: 3, paper: 'June-2014-1' }];

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

async function scan(page: Page) {
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .disableRules(['color-contrast'])
    .analyze();

  return results.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical');
}

function report(blocking: Awaited<ReturnType<typeof scan>>) {
  return blocking
    .map((v) => `[${v.impact}] ${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`)
    .join('\n');
}

test('the generator has no serious/critical a11y violations', async ({ page, context }) => {
  await seedAuth(context, { questions_metadata: QUESTIONS_METADATA });
  await stubPaperTree(context);
  await page.goto('/');
  await page.waitForTimeout(500);

  const blocking = await scan(page);
  expect(blocking, `serious/critical a11y on /:\n${report(blocking)}`).toEqual([]);
});

// The disabled "Open in Mock Space" button and its sign-in hint are new surface
// this feature adds — a bare disabled control with no explanation is exactly
// the kind of thing this gate exists to catch, so scan it explicitly rather
// than trusting the initial-view scan above to cover it.
test('the signed-out result step has no serious/critical a11y violations', async ({
  page,
  context,
}) => {
  // Signed out on purpose: seedAuth is not called, so useAuth().user stays null
  // and the mock-space button renders in its disabled state.
  await stubPaperTree(context);
  // Catch-all first — Playwright gives precedence to the most recently
  // registered matching route, so the specific table below must come after
  // this or it gets shadowed (same ordering rule seedAuth documents).
  await context.route('**/rest/v1/**', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: '[]' }),
  );
  await context.route('**/rest/v1/questions_metadata*', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(QUESTIONS_METADATA),
    }),
  );
  await context.route('**/api/compose-paper', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ pdfBase64: Buffer.from('%PDF-1.4 fake').toString('base64'), metadata: {} }),
    }),
  );

  await page.goto('/');
  await page.getByRole('button', { name: 'International Mathematics' }).click();
  await page.getByRole('button', { name: 'Paper 2' }).click();
  await page.getByRole('checkbox', { name: 'Select Number and Algebra' }).check();
  await page.getByRole('button', { name: 'Generate Paper' }).click();
  await expect(page.getByRole('button', { name: 'Open in Mock Space' })).toBeDisabled();

  const blocking = await scan(page);
  expect(blocking, `serious/critical a11y on the result step, signed out:\n${report(blocking)}`).toEqual(
    [],
  );
});
