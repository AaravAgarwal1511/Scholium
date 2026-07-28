import { test, expect } from '@playwright/test';
import { openDemo, startClock, newAnswerBox, answerText } from './helpers';

/**
 * The append-only guarantee, proven through the real DOM.
 *
 * model.test.ts already proves the pure functions. What it CANNOT prove is that
 * the wiring holds it up: that the hidden textarea sink, real keyboard events,
 * and the browser's own edit machinery cannot reach behind a committed word.
 * That is the whole security property of a written exam — a student must be
 * unable to revise an answer after moving on — so it earns an end-to-end test on
 * top of the unit ones.
 */

test.beforeEach(async ({ page }) => {
  await openDemo(page);
  await startClock(page);
  await newAnswerBox(page);
});

test('typed text appears in the answer box', async ({ page }) => {
  await page.keyboard.type('photosynthesis in plants');
  await expect(page.locator('.ms-text').first()).toContainText('photosynthesis in plants');
});

test('backspace cannot delete past the last committed word', async ({ page }) => {
  // "alpha beta " commits once the spaces are typed; "gamma" stays pending.
  await page.keyboard.type('alpha beta gamma');
  expect(await answerText(page)).toBe('alpha beta gamma');

  // Far more backspaces than there are pending characters.
  for (let i = 0; i < 40; i++) await page.keyboard.press('Backspace');

  // "gamma" is gone; "alpha beta" survives — deletion stopped dead at the
  // committing space and never reached the committed words.
  expect(await answerText(page)).toBe('alpha beta');
});

test('select-all cannot reach committed text', async ({ page }) => {
  await page.keyboard.type('keep this text');
  const modifier = process.platform === 'darwin' ? 'Meta' : 'Control';

  // Select-all is a blocked chord, so it never selects anything — the committed
  // words are not even in the textarea to be selected. Each Backspace then only
  // nibbles the pending word and stops dead at the committing space. However hard
  // you try to select-all-and-delete, "keep this" is unreachable.
  for (let i = 0; i < 10; i++) {
    await page.keyboard.press(`${modifier}+a`);
    await page.keyboard.press('Backspace');
  }

  expect(await answerText(page)).toBe('keep this');
});

test('paste cannot inject text', async ({ page, context, browserName }) => {
  test.skip(browserName !== 'chromium', 'clipboard permissions are chromium-only here');
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);

  await page.keyboard.type('original answer ');
  await page.evaluate(() => navigator.clipboard.writeText('INJECTED'));
  const modifier = process.platform === 'darwin' ? 'Meta' : 'Control';
  await page.keyboard.press(`${modifier}+v`);

  // insertFromPaste is refused, so the clipboard never reaches the answer.
  const text = await answerText(page);
  expect(text).toContain('original answer');
  expect(text).not.toContain('INJECTED');
});

test('an answer with text cannot be emptied by blurring it away', async ({ page }) => {
  // A box that received a character stays forever; crossing out is the only
  // retraction. Blur commits it rather than discarding it.
  await page.keyboard.type('committed');
  // Click elsewhere on the page to blur the box (not creating a new one on top).
  await page.locator('[data-page="0"] > div').first().click({ position: { x: 400, y: 400 } });

  // The original box and its text are still there.
  await expect(page.locator('.ms-text').first()).toContainText('committed');
  await expect(page.locator('[data-box]')).toHaveCount(2); // the blur-click made a second box
});

test('crossing out a word is a confirmed, permanent strike', async ({ page }) => {
  // Crossing out is the only way to retract committed text — and it is deliberate:
  // a click on a word asks first, and once struck the word is frozen for good.
  await page.keyboard.type('blunder ');
  await expect(page.locator('.ms-text').first()).toContainText('blunder');

  // Click the word; the confirm popover appears rather than striking on one click.
  await page.locator('.ms-text span', { hasText: 'blunder' }).first().click();
  await expect(page.getByTestId('strike-confirm')).toBeVisible();

  await page.getByTestId('strike-confirm-yes').click();
  await expect(page.getByTestId('strike-confirm')).toBeHidden();

  // The word is now rendered struck, and the word text survives (struck, not deleted).
  const struck = page.locator('.ms-text .ms-struck');
  await expect(struck).toBeVisible();
  await expect(struck).toContainText('blunder');
});
