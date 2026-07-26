import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { seedAuth } from './support/auth';

/**
 * Accessibility gate: no serious or critical WCAG 2.1 A/AA violations on the
 * primary pages. recall-app came in clean except one shared-navbar combobox bug
 * (fixed in @repo/ui), so we can hold the bar at zero here rather than baseline.
 * Minor/moderate rules are not gated — they are noisier and often stylistic.
 * color-contrast is excluded (design-token concern, tracked separately); the gate
 * targets unambiguous semantic defects — missing names, invalid ARIA, roles.
 */

const CHAPTER_ID = 'chap-photosynthesis';
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
  recall_cards: [
    { chapter_id: CHAPTER_ID, term: 'Chlorophyll', definition: 'green pigment' },
    { chapter_id: CHAPTER_ID, term: 'Stomata', definition: 'leaf pores' },
  ],
  recall_progress: [],
  active_sessions: (single: boolean) => (single ? {} : []),
};

for (const [name, path] of [['home', '/'], ['study', `/study/${CHAPTER_ID}`]] as const) {
  test(`no serious/critical a11y violations: ${name}`, async ({ page, context }) => {
    await seedAuth(context, stub);
    await page.goto(path);
    await page.waitForTimeout(500);

    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .disableRules(['color-contrast'])
      .analyze();

    const blocking = results.violations.filter(
      (v) => v.impact === 'serious' || v.impact === 'critical',
    );
    const report = blocking
      .map((v) => `[${v.impact}] ${v.id}: ${v.help}\n    ${v.nodes.map((n) => n.target.join(' ')).join('\n    ')}`)
      .join('\n');

    expect(blocking, `serious/critical a11y violations on ${path}:\n${report}`).toEqual([]);
  });
}
