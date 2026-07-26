import { test, expect, type BrowserContext } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { seedAuth } from './support/auth';

// No serious/critical WCAG 2.1 A/AA structural violations on the subjects page.
// color-contrast excluded (design-token concern, tracked separately).
const TREE: Record<string, unknown[]> = {
  '': [{ name: '0607', id: null }],
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

test('subjects page has no serious/critical a11y violations', async ({ page, context }) => {
  await seedAuth(context);
  await stubPaperTree(context);
  await page.goto('/');
  await page.waitForTimeout(500);

  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .disableRules(['color-contrast'])
    .analyze();

  const blocking = results.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical');
  const report = blocking
    .map((v) => `[${v.impact}] ${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`)
    .join('\n');
  expect(blocking, `serious/critical a11y on /:\n${report}`).toEqual([]);
});
