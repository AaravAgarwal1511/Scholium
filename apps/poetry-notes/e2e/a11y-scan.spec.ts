import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { seedAuth, stubStorage, testUserId } from './support/auth';

// No serious/critical WCAG 2.1 A/AA structural violations on the landing page.
// color-contrast excluded (design-token concern, tracked separately).
const PROJECT_ID = 'proj-1';
const INDEX = [{ projectId: PROJECT_ID, title: 'The Road Not Taken', lastModified: '2026-02-01T00:00:00.000Z' }];

test('landing has no serious/critical a11y violations', async ({ page, context }) => {
  await seedAuth(context);
  await stubStorage(context, { '_index.json': INDEX, [`${testUserId}/${PROJECT_ID}.json`]: {} });
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
