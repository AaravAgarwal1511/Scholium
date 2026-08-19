// Shared request handler for /api/proxy-paper, used by both the dev Express
// server (server.js) and the production Vercel function (api/proxy-paper.js).
//
// The `papers` R2 bucket is public but has no CORS headers configured, so a
// browser `fetch()` against its public URL is blocked cross-origin (the past-
// papers -> mock-space handoff needs exactly that, to read a generated paper's
// bytes back out for re-upload). This endpoint reads the object server-side —
// same-origin from the browser's point of view — using the same R2 credentials
// compose-handler already writes with.

import { CACHE_PREFIX, readObjectBytes } from './r2-cache.js';

// Only ever reads from the `_cache/` prefix this app itself writes to, never an
// arbitrary key — this is a read-only proxy for the app's own cached PDFs, not
// a general-purpose fetch of anything in the bucket.
export async function handleProxyPaper(key) {
  if (typeof key !== 'string' || !key.startsWith(`${CACHE_PREFIX}/`)) {
    return { status: 400, body: { error: 'Invalid key' } };
  }

  try {
    const bytes = await readObjectBytes(key);
    if (!bytes) return { status: 404, body: { error: 'Not found' } };
    return { status: 200, bytes };
  } catch (error) {
    console.error('Proxy paper error:', error);
    return { status: 500, body: { error: 'Failed to fetch cached PDF' } };
  }
}
