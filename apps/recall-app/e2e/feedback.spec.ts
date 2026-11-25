import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { seedAuth } from './support/auth';

/**
 * Suite-wide feedback (@repo/feedback): footer link → dialog → submit_feedback RPC,
 * plus the forced bottom-right prompt and an axe pass with the dialog open.
 * recall-app is the representative; every app mounts the same provider.
 */

const stub = {
  recall_chapters: (single: boolean) => (single ? {} : []),
  recall_disabled: [],
  recall_progress: [],
  active_sessions: (single: boolean) => (single ? {} : []),
};

test('footer link opens the dialog and submits to submit_feedback', async ({ page, context }) => {
  await seedAuth(context, stub);
  let body: Record<string, unknown> | null = null;
  await context.route('**/rest/v1/rpc/submit_feedback', async (route) => {
    body = route.request().postDataJSON();
    await route.fulfill({ status: 204, body: '' });
  });

  await page.goto('/');
  await page.getByRole('button', { name: 'Send feedback' }).click();

  const dialog = page.getByRole('dialog', { name: 'Send feedback' });
  await expect(dialog).toBeVisible();
  await dialog.getByText('Idea', { exact: true }).click();
  await dialog.getByLabel('4 out of 5').check({ force: true });
  await dialog.getByLabel('Your message').fill('More chemistry chapters please');
  await dialog.getByRole('button', { name: 'Send', exact: true }).click();

  await expect(page.getByText('Thanks for your feedback')).toBeVisible();
  expect(body).toMatchObject({
    p_app_key: 'recall-app',
    p_category: 'idea',
    p_rating: 4,
    p_message: 'More chemistry chapters please',
    p_source: 'form',
    p_path: '/',
    p_website: null,
  });
});

test('rate limit shows a friendly error', async ({ page, context }) => {
  await seedAuth(context, stub);
  await context.route('**/rest/v1/rpc/submit_feedback', (route) =>
    route.fulfill({
      status: 400,
      contentType: 'application/json',
      body: JSON.stringify({ code: 'P0429', message: 'rate limited' }),
    }),
  );
  await page.goto('/');
  await page.getByRole('button', { name: 'Send feedback' }).click();
  const dialog = page.getByRole('dialog', { name: 'Send feedback' });
  await dialog.getByLabel('Your message').fill('hello');
  await dialog.getByRole('button', { name: 'Send', exact: true }).click();
  await expect(page.getByText(/sent a lot of feedback recently/)).toBeVisible();
});

test('forced prompt: hovering lights the stars, a click sends the rating without a form', async ({ page, context }) => {
  await seedAuth(context, stub);
  let body: Record<string, unknown> | null = null;
  await context.route('**/rest/v1/rpc/submit_feedback', async (route) => {
    body = route.request().postDataJSON();
    await route.fulfill({ status: 204, body: '' });
  });

  await page.goto('/?feedbackPrompt=1');
  const prompt = page.getByRole('complementary', { name: /working for you/ });
  await expect(prompt).toBeVisible();

  // Hover the 4th star: stars 1–4 light up, the 5th doesn't.
  const stars = prompt.locator('.rui-fb-star');
  await stars.nth(3).hover();
  await expect(stars.nth(3)).toHaveClass(/is-lit/);
  await expect(stars.nth(0)).toHaveClass(/is-lit/);
  await expect(stars.nth(4)).not.toHaveClass(/is-lit/);

  await stars.nth(3).click();
  // The card's accessible name changes to the thank-you, so re-locate it by that.
  const thanks = page.getByRole('complementary', { name: /Thanks! Your rating was sent/ });
  await expect(thanks).toBeVisible();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  expect(body).toMatchObject({ p_rating: 4, p_source: 'prompt', p_message: null, p_category: 'other' });

  // Optional follow-up opens a blank form (the rating is already saved).
  await thanks.getByRole('button', { name: 'Tell us more' }).click();
  const dialog = page.getByRole('dialog', { name: 'Send feedback' });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByLabel('4 out of 5')).not.toBeChecked();
});

test('no serious/critical a11y violations with the feedback dialog open', async ({ page, context }) => {
  await seedAuth(context, stub);
  await page.goto('/');
  await page.getByRole('button', { name: 'Send feedback' }).click();
  await expect(page.getByRole('dialog')).toBeVisible();

  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .disableRules(['color-contrast'])
    .analyze();
  const blocking = results.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical');
  const report = blocking
    .map((v) => `[${v.impact}] ${v.id}: ${v.help}\n    ${v.nodes.map((n) => n.target.join(' ')).join('\n    ')}`)
    .join('\n');
  expect(blocking, report).toEqual([]);
});
