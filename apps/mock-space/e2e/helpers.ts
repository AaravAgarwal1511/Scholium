import { expect, type Page } from '@playwright/test';

/**
 * Every e2e journey here rides the `/demo` route. Demo is a real attempt on a
 * paper we ship — the same pipeline a signed-in upload takes — but signed out
 * and deliberately ephemeral: nothing is written to Supabase or storage, so the
 * whole surface below the auth gate is testable with no account and no seeding.
 * (See apps/mock-space/src/pages/Demo.tsx.)
 */

/** Opens /demo and waits for the paper's first page to have rendered. */
export async function openDemo(page: Page): Promise<void> {
  await page.goto('/demo');
  // Demo redirects to /attempt once the PDF parses.
  await page.waitForURL('**/attempt');
  // The page frame carries data-page; its canvas is drawn by pdf.js.
  await expect(page.locator('[data-page="0"]')).toBeVisible();
}

/** Opens /demo/mcq — the MCQ counterpart, same ephemeral signed-out pipeline. */
export async function openDemoMcq(page: Page): Promise<void> {
  await page.goto('/demo/mcq');
  await page.waitForURL('**/attempt');
  await expect(page.getByTestId('mcq-progress')).toBeVisible();
}

/** Starts the clock. Boxes are inert until the timer runs (`locked`). */
export async function startClock(page: Page): Promise<void> {
  await page.getByTestId('timer-start').click();
  await expect(page.getByTestId('timer-pause')).toBeVisible();
}

/**
 * Creates an answer box by clicking on the first page, then returns a locator
 * for its hidden sink (already focused — the box focuses it on creation). Typing
 * goes through page.keyboard so it produces the same beforeinput/keydown events a
 * real student's typing would.
 */
export async function newAnswerBox(page: Page): Promise<void> {
  const surface = page.locator('[data-page="0"] > div').first();
  const size = await surface.boundingBox();
  if (!size) throw new Error('page surface has no box');
  // Click well inside the page, away from the edges, so the box has room to grow.
  await surface.click({ position: { x: Math.min(120, size.width / 3), y: Math.min(120, size.height / 3) } });
  await expect(page.locator('[data-box]')).toHaveCount(1);
  await expect(page.locator('textarea.ms-sink')).toBeFocused();
}

/** The visible answer text of the one box on the page, whitespace-normalised. */
export async function answerText(page: Page): Promise<string> {
  const text = await page.locator('.ms-text').first().innerText();
  return text.replace(/\s+/g, ' ').trim();
}
