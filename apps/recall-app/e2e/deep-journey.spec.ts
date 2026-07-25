import { test, expect } from '@playwright/test';
import { seedAuth } from './support/auth';

/**
 * Completing Pass 1 (the matching round) — the core study interaction, not just
 * reaching the overview. Drives the real term→definition matching to a finished
 * round, against stubbed data.
 */

const CHAPTER_ID = 'chap-photosynthesis';
const CARDS = [
  { term: 'Chlorophyll', definition: 'The green pigment that traps light' },
  { term: 'Stomata', definition: 'Pores in a leaf for gas exchange' },
  { term: 'Glucose', definition: 'The sugar photosynthesis produces' },
];
const stub = {
  recall_chapters: (single: boolean) =>
    single
      ? { id: CHAPTER_ID, name: 'Photosynthesis' }
      : [
          {
            id: CHAPTER_ID, subject_id: 'subj-biology', subject_name: 'Biology',
            subject_emoji: '🧬', section_id: 'sec-cells', section_name: 'Cells',
            name: 'Photosynthesis', sort_order: 0, section_sort_order: 0, subject_sort_order: 0,
          },
        ],
  recall_disabled: [],
  recall_cards: CARDS.map((c) => ({ chapter_id: CHAPTER_ID, ...c })),
  recall_progress: [],
  active_sessions: (single: boolean) => (single ? {} : []),
};

test('completing the Pass 1 matching round', async ({ page, context }) => {
  await seedAuth(context, stub);
  await page.goto(`/study/${CHAPTER_ID}`);
  await page.getByRole('button', { name: /Start Studying/ }).click();

  // Match each term to its definition. Both render as buttons with their text;
  // clicking a term selects it, then its definition completes the pair.
  for (const card of CARDS) {
    await page.getByRole('button', { name: card.term }).click();
    await page.getByRole('button', { name: card.definition }).click();
  }

  // All pairs matched → the round reports complete and offers to continue. This
  // only appears once every pair registered, so it doubles as the match check.
  await expect(page.getByText('Round complete!')).toBeVisible();
  await page.getByRole('button', { name: 'Continue' }).click();
  // Continue advances past the matching round rather than staying on it.
  await expect(page.getByText('Round complete!')).toBeHidden();
});

test('answering the Pass 2 multiple-choice round correctly scores full marks', async ({ page, context }) => {
  await seedAuth(context, stub);
  // Jump straight to Pass 2 via the URL (Study reads ?pass); questions are in card
  // order, so the correct term for each is simply the next card's term.
  await page.goto(`/study/${CHAPTER_ID}?pass=2`);
  await page.getByRole('button', { name: /Start Studying/ }).click();

  for (let i = 0; i < CARDS.length; i++) {
    // Read the definition, choose the term. The correct term is a unique option
    // on the page (distractors are the other cards' terms).
    await page.getByRole('button', { name: CARDS[i].term, exact: true }).click();
    const last = i === CARDS.length - 1;
    await page.getByRole('button', { name: last ? 'See results' : 'Next' }).click();
  }

  // Every answer correct → the completion screen shows a full tally.
  await expect(page.getByText(`${CARDS.length} / ${CARDS.length} correct`)).toBeVisible();
});
