import { test, expect } from '@playwright/test';
import { openDemoMcq, startClock } from './helpers';

/**
 * The MCQ interface: /demo/mcq rides the same ephemeral, signed-out pipeline
 * /demo does (see Demo.tsx), but opens the click-through runner instead of
 * the PDF workspace. Its answer key is DEMO_MCQ_ANSWERS in Demo.tsx —
 * ["B", "C", "A", "D", "B"] for questions 1–5 — which these tests answer
 * against directly rather than duplicating as a separate constant.
 */

test('options are inert until the clock starts', async ({ page }) => {
  await openDemoMcq(page);
  await expect(page.getByTestId('mcq-option-A')).toBeDisabled();
});

test('clicking an option locks it in, marks it, and reveals the correct answer', async ({
  page,
}) => {
  await openDemoMcq(page);
  await startClock(page);

  // Q1's correct answer is B; click the wrong one (A) to exercise both the
  // chosen-wrong and reveal-correct states in one assertion.
  await page.getByTestId('mcq-option-A').click();

  await expect(page.getByTestId('mcq-option-A')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByTestId('mcq-verdict')).toHaveText(/Incorrect.*correct answer is B/);
  await expect(page.getByTestId('mcq-score')).toHaveText('0 / 1');

  // Every option is locked out once the question has been answered.
  for (const letter of ['A', 'B', 'C', 'D']) {
    await expect(page.getByTestId(`mcq-option-${letter}`)).toBeDisabled();
  }
});

test('clicking again after answering changes nothing — the integrity guarantee', async ({
  page,
}) => {
  await openDemoMcq(page);
  await startClock(page);

  await page.getByTestId('mcq-option-A').click(); // wrong
  await page.getByTestId('mcq-option-B').click({ force: true }); // the correct one, too late

  // Still shows the original (wrong) choice, not a switch to correct.
  await expect(page.getByTestId('mcq-verdict')).toHaveText(/Incorrect/);
  await expect(page.getByTestId('mcq-score')).toHaveText('0 / 1');
});

test('next/prev move through questions, and a revealed question stays revealed on return', async ({
  page,
}) => {
  await openDemoMcq(page);
  await startClock(page);

  await expect(page.getByTestId('mcq-progress')).toHaveText('Question 1 of 5');
  await page.getByTestId('mcq-option-B').click(); // Q1 correct
  await expect(page.getByTestId('mcq-score')).toHaveText('1 / 1');

  await page.getByTestId('mcq-next').click();
  await expect(page.getByTestId('mcq-progress')).toHaveText('Question 2 of 5');
  // A fresh question starts unanswered — all four options clickable again.
  await expect(page.getByTestId('mcq-option-A')).toBeEnabled();

  await page.getByTestId('mcq-prev').click();
  await expect(page.getByTestId('mcq-progress')).toHaveText('Question 1 of 5');
  await expect(page.getByTestId('mcq-verdict')).toHaveText(/Correct/);
  await expect(page.getByTestId('mcq-option-B')).toBeDisabled();
});

test('finishing lands on the score summary with the right tally and no PDF download', async ({
  page,
}) => {
  await openDemoMcq(page);
  await startClock(page);

  // Answer B, C, A, D, B — every one correct.
  const correctAnswers = ['B', 'C', 'A', 'D', 'B'];
  for (let i = 0; i < correctAnswers.length; i++) {
    await page.getByTestId(`mcq-option-${correctAnswers[i]}`).click();
    if (i < correctAnswers.length - 1) await page.getByTestId('mcq-next').click();
  }

  await page.getByTestId('timer-finish').click();
  await page.waitForURL('**/export');

  await expect(page.getByRole('heading', { name: /Time.s up/ })).toBeVisible();
  await expect(page.getByText('5 / 5')).toBeVisible();
  await expect(page.getByText('100%')).toBeVisible();
  await expect(page.locator('[data-testid="download"]')).toHaveCount(0);
});
