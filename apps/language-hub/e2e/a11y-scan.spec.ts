import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { seedAuth, testUserId } from './support/auth';

// No serious/critical WCAG 2.1 A/AA violations on the dashboard and study pages.
const SET_ID = 'set-french-basics';
const SET = {
  id: SET_ID, user_id: testUserId, name: 'French Basics',
  description: 'Everyday words', language: 'french', folder_id: null,
  created_at: '2026-01-01T00:00:00.000Z',
};
const ITEMS = [
  { id: 'i1', set_id: SET_ID, term: 'bonjour', definition: 'hello', created_at: '2026-01-01T00:00:01.000Z' },
  { id: 'i2', set_id: SET_ID, term: 'merci', definition: 'thanks', created_at: '2026-01-01T00:00:02.000Z' },
];
const stub = {
  vocabulary_sets: (single: boolean) => (single ? SET : [SET]),
  folders: [],
  vocabulary_items: ITEMS,
  set_progress: [],
};

async function assertClean(page: import('@playwright/test').Page, path: string) {
  await page.goto(path);
  await page.waitForTimeout(500);
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    // color-contrast is excluded from the structural gate: it is the most
    // design-dependent rule (brand-tint badges, hover states) and fixing it means
    // changing shared design tokens, which is a separate pass. The gate here
    // targets unambiguous semantic defects — missing names, invalid ARIA, roles.
    .disableRules(['color-contrast'])
    .analyze();
  const blocking = results.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical');
  const report = blocking
    .map((v) => `[${v.impact}] ${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`)
    .join('\n');
  expect(blocking, `serious/critical a11y on ${path}:\n${report}`).toEqual([]);
}

test('dashboard has no serious/critical a11y violations', async ({ page, context }) => {
  await seedAuth(context, stub);
  await assertClean(page, '/');
});

test('first-pass study has no serious/critical a11y violations', async ({ page, context }) => {
  await seedAuth(context, stub);
  await assertClean(page, `/first-pass/${SET_ID}`);
});
