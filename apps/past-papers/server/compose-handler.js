// Shared request handler for /api/compose-paper, used by both the dev Express
// server (server.js) and the production Vercel function (api/compose-paper.js).
// The only difference between environments is the source loader passed in.

import { composePdf } from './compose-pdf.js';
import { generatedCacheKey, writeCached } from './r2-cache.js';

// Composing one exam's worth of questions is quick; composing a whole syllabus is
// not. Every distinct exam a selection touches costs another multi-megabyte source
// PDF fetched and parsed, and the function has 60s and ~1GB to do it all in. Say
// no up front rather than timing out halfway through.
// Mirrored by MAX_GENERATED_QUESTIONS in src/lib/papers.ts so the UI can stop the
// user before the request is made; this is the side that has to hold.
export const MAX_QUESTIONS = 400;

// A Vercel function may return roughly 4.5 MB of response body, and base64
// inflates the PDF by a third — so past ~3 MB of PDF nothing can come back
// inline. Selecting a dozen chapters clears that easily, and the overflow used to
// surface as an opaque 500. Anything bigger goes to R2 and comes back as a URL,
// exactly as /api/chapter-paper has always done it.
const INLINE_LIMIT = 3 * 1024 * 1024;

// This ends up inside a Content-Disposition header, so a quote or a newline in it
// would let the caller inject one. Keep it to a plain PDF file name.
function safeFileName(name, fallback) {
  if (typeof name !== 'string') return fallback;
  const cleaned = name.replace(/[^\w. -]+/g, '').trim().slice(0, 120);
  if (!cleaned) return fallback;
  return cleaned.toLowerCase().endsWith('.pdf') ? cleaned : `${cleaned}.pdf`;
}

// `loaderFactory(subject)` returns a loader (see server/loaders.js).
// Returns { status, body } for the caller to send.
export async function handleCompose(body, loaderFactory) {
  const {
    selections,
    includeMarkScheme = true,
    randomize = false,
    subject,
    fileName,
  } = body || {};

  if (!selections || typeof selections !== 'object' || Object.keys(selections).length === 0) {
    return {
      status: 400,
      body: { error: 'selections is required and must be a non-empty object of {questionId: boolean}' },
    };
  }
  if (!subject || typeof subject !== 'string') {
    return { status: 400, body: { error: 'subject is required' } };
  }

  let orderedIds = Object.entries(selections)
    .filter(([, selected]) => selected)
    .map(([id]) => id)
    .sort();

  if (orderedIds.length === 0) {
    return { status: 400, body: { error: 'No questions selected' } };
  }
  if (orderedIds.length > MAX_QUESTIONS) {
    return {
      status: 400,
      body: {
        error:
          `Too many questions selected (${orderedIds.length}). ` +
          `The most that can be composed in one paper is ${MAX_QUESTIONS} — ` +
          'lower the per-chapter counts, narrow the year range, or drop a few chapters.',
      },
    };
  }
  if (randomize) {
    orderedIds = orderedIds.sort(() => Math.random() - 0.5);
  }

  try {
    const loader = loaderFactory(subject);
    const { bytes, metadata } = await composePdf(orderedIds, subject, loader, { includeMarkScheme });

    if (bytes.length <= INLINE_LIMIT) {
      return { status: 200, body: { pdfBase64: Buffer.from(bytes).toString('base64'), metadata } };
    }

    const url = await writeCached(
      generatedCacheKey(subject, bytes),
      bytes,
      safeFileName(fileName, `${subject}-paper.pdf`),
      'attachment',
    );
    return { status: 200, body: { url, metadata } };
  } catch (error) {
    // Log the stack, but don't ship it to the browser.
    console.error('PDF composition error:', error);
    return { status: 500, body: { error: error.message || 'Failed to compose PDF' } };
  }
}
