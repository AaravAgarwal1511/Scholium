import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { openDemo, openDemoMcq, startClock } from './helpers';

// No serious/critical WCAG 2.1 A/AA structural violations. mock-space needs no
// auth — the signed-out /demo is a real attempt. color-contrast excluded
// (design-token concern, tracked separately).

async function blockingViolations(page: import('@playwright/test').Page) {
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .disableRules(['color-contrast'])
    .analyze();
  return results.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical');
}

test('the home page has no serious/critical a11y violations', async ({ page }) => {
  await page.goto('/');
  await page.waitForTimeout(500);
  const blocking = await blockingViolations(page);
  const report = blocking.map((v) => `[${v.impact}] ${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`).join('\n');
  expect(blocking, `serious/critical a11y on /:\n${report}`).toEqual([]);
});

test('the attempt page has no serious/critical a11y violations', async ({ page }) => {
  await openDemo(page);
  await page.waitForTimeout(500);
  const blocking = await blockingViolations(page);
  const report = blocking.map((v) => `[${v.impact}] ${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`).join('\n');
  expect(blocking, `serious/critical a11y on the attempt page:\n${report}`).toEqual([]);
});

test('the MCQ attempt page has no serious/critical a11y violations', async ({ page }) => {
  await openDemoMcq(page);
  await startClock(page);
  // Scan both the unanswered and answered/revealed states — OptionButtons'
  // aria-pressed/aria-live wiring only exists once a choice has been made.
  await page.waitForTimeout(500);
  const beforeAnswering = await blockingViolations(page);

  await page.getByTestId('mcq-option-A').click();
  await page.waitForTimeout(300);
  const afterAnswering = await blockingViolations(page);

  const blocking = [...beforeAnswering, ...afterAnswering];
  const report = blocking.map((v) => `[${v.impact}] ${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`).join('\n');
  expect(blocking, `serious/critical a11y on the MCQ attempt page:\n${report}`).toEqual([]);
});
