import { test, expect } from '@playwright/test';
import { openDemo, startClock, newAnswerBox } from './helpers';

/**
 * The export journey: write an answer, finish the paper, download the flattened
 * PDF. This is the one path that exercises the exporter for real — pdf.js reads
 * the paper, pdf-lib burns the answers back in, and the browser saves the file.
 * exportPdf.test.ts checks the geometry unit-by-unit; this checks that the button
 * actually yields a PDF.
 */

test('finishing the paper leads to a downloadable flattened PDF', async ({ page }) => {
  await openDemo(page);
  await startClock(page);
  await newAnswerBox(page);
  await page.keyboard.type('mitochondria is the powerhouse');

  // Finish ends the attempt early; the app routes to /export on expiry.
  await page.getByTestId('timer-finish').click();
  await page.waitForURL('**/export');
  // The heading uses a typographic apostrophe (Time&rsquo;s up).
  await expect(page.getByRole('heading', { name: /Time.s up/ })).toBeVisible();

  const downloadPromise = page.waitForEvent('download');
  await page.getByTestId('download').click();
  const download = await downloadPromise;

  // Saved under the attempt's title, as a PDF.
  expect(download.suggestedFilename()).toMatch(/\.pdf$/);

  // And it really is a PDF: the flattened bytes start with the PDF magic number.
  const stream = await download.createReadStream();
  const head = await new Promise<Buffer>((resolve, reject) => {
    const chunks: Buffer[] = [];
    stream.on('data', (c: Buffer) => {
      chunks.push(c);
      if (Buffer.concat(chunks).length >= 5) resolve(Buffer.concat(chunks));
    });
    stream.on('end', () => resolve(Buffer.concat(chunks)));
    stream.on('error', reject);
  });
  expect(head.subarray(0, 5).toString('latin1')).toBe('%PDF-');
});

test('a signed-out demo does not survive a reload', async ({ page }) => {
  // The demo attempt is deliberately ephemeral: it stores nothing, so reopening
  // /attempt after a reload has nothing to restore and bounces home.
  await openDemo(page);
  await startClock(page);
  await newAnswerBox(page);
  await page.keyboard.type('ephemeral');

  await page.goto('/attempt');
  await page.waitForURL((url) => !url.pathname.includes('/attempt'));
  expect(new URL(page.url()).pathname).not.toContain('/attempt');
});
