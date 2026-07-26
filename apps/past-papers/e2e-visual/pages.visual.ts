import { test, expect, type BrowserContext } from '@playwright/test';
import { seedAuth } from '../e2e/support/auth';

const TREE: Record<string, unknown[]> = {
  '': [{ name: '0606', id: null }, { name: '0607', id: null }],
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

test('subjects', async ({ page, context }) => {
  await seedAuth(context);
  await stubPaperTree(context);
  await page.goto('/');
  await expect(page.getByText('International Mathematics')).toBeVisible();
  await page.waitForTimeout(500);
  await expect(page).toHaveScreenshot('subjects.png', { fullPage: true });
});
