import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { seedAuth, stubNotesStorage } from './support/auth';

// No serious/critical WCAG 2.1 A/AA structural violations on the two pages the
// app has. color-contrast excluded (design-token concern, tracked separately).
const NOTES = ['1-Electricity-and-Magnetism.pdf', 'Reference tables.pdf'];

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

test('the notes list has no serious/critical a11y violations', async ({ page, context }) => {
  await seedAuth(context);
  await stubNotesStorage(context, NOTES);
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Notes.' })).toBeVisible();
  await page.waitForTimeout(500);

  const blocking = await scan(page);
  expect(blocking, `serious/critical a11y on /:\n${report(blocking)}`).toEqual([]);
});

test('the note viewer has no serious/critical a11y violations', async ({ page, context }) => {
  await seedAuth(context);
  await stubNotesStorage(context, NOTES);
  await page.goto('/notes/1-Electricity-and-Magnetism.pdf');
  await expect(page.getByRole('heading', { name: 'Electricity and Magnetism' })).toBeVisible();
  await page.waitForTimeout(500);

  const blocking = await scan(page);
  expect(blocking, `serious/critical a11y on the viewer:\n${report(blocking)}`).toEqual([]);
});
