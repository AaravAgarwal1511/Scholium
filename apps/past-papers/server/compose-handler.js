// Shared request handler for /api/compose-paper, used by both the dev Express
// server (server.js) and the production Vercel function (api/compose-paper.js).
// The only difference between environments is the source loader passed in.

import { composePdf } from './compose-pdf.js';

// `loaderFactory(subject)` returns a loader (see server/loaders.js).
// Returns { status, body } for the caller to send.
export async function handleCompose(body, loaderFactory) {
  const { selections, includeMarkScheme = true, randomize = false, subject } = body || {};

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
  if (randomize) {
    orderedIds = orderedIds.sort(() => Math.random() - 0.5);
  }

  try {
    const loader = loaderFactory(subject);
    const { bytes, metadata } = await composePdf(orderedIds, subject, loader, { includeMarkScheme });
    return { status: 200, body: { pdfBase64: Buffer.from(bytes).toString('base64'), metadata } };
  } catch (error) {
    console.error('PDF composition error:', error);
    return {
      status: 500,
      body: { error: error.message || 'Failed to compose PDF', details: error.stack },
    };
  }
}
