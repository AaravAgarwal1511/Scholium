// Cache for composed PDFs, stored in the public R2 `papers` bucket.
//
// A composed chapter runs 10–65 MB, far over the ~4.5 MB body a Vercel function
// may return, so /api/chapter-paper writes the PDF to R2 and returns its public
// URL instead of inlining base64. Keys are deterministic (see chapterCacheKey),
// so the same year range + order is composed once and served from R2 after that.
// /api/compose-paper does the same for any generated paper that overflows the
// response body (see generatedCacheKey).
//
// Objects live under `_cache/`, which build-paper-index.js skips so they never
// show up as browseable chapters. A bucket lifecycle rule can expire this prefix.

import { createHash } from 'node:crypto';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';

export const CACHE_PREFIX = '_cache';

// Bump when the composition output changes in a way that invalidates old PDFs
// (layout, crop geometry, banner text) — old keys are simply orphaned.
//
// v2 (2026-07-27): multi-page crops were being cut off at `sentinel - headroom`
// instead of running to the bottom of the page, so every v1 chapter PDF holding
// a question that spans a page break is truncated — visibly so on 0625 Paper 2,
// where it removed MCQ answer options and reduced some mark-scheme rows to the
// bare table header. Every v1 object is stale and must not be served.
//
// v3 (2026-07-27): blank pages. Run-on crops swept in BLANK PAGE separators and
// header-only slivers, and the layout could strand a section banner — or nothing
// at all — on a page of its own. v2 was never deployed, but objects were written
// under it while testing, so it is retired too rather than served stale.
//
// v4 (2026-07-29): the "BLANK PAGE" banner itself is 9 non-whitespace
// characters, enough to clear regionHasContent's MIN_CONTENT_CHARS on its own —
// so a filler page whose byte stream slipped past isBlankPage's threshold could
// still be swept into a continuation crop and rendered. Every v3 chapter that
// hit that gap is stale (see hasBlankPageBanner in page-chars.js).
//
// v5 (2026-08-01): the first section-divider page now also prints the subject
// name + paper number above "Questions"/"Mark Scheme", so every v4 object is
// missing that title.
const CACHE_VERSION = 'v5';

const R2_PUBLIC_URL = (
  process.env.VITE_R2_PUBLIC_URL ||
  process.env.R2_PUBLIC_URL ||
  ''
).replace(/\/+$/, '');

const R2_BUCKET = process.env.R2_BUCKET || 'papers';

// `subject` and `component` never contain slashes, so the key is safe to build
// by concatenation; encode each segment for the public URL only.
export function chapterCacheKey({ subject, paperNum, chapter, yearFrom, yearTo, order, kind }) {
  return (
    `${CACHE_PREFIX}/${subject}/` +
    `P${paperNum}-C${chapter}-${yearFrom}-${yearTo}-${order}-${kind}-${CACHE_VERSION}.pdf`
  );
}

// Key for a one-off paper from /generate. Its questions are drawn at random, so
// the request is no use as a cache key — hash the composed bytes instead. Two
// runs that happen to produce the same paper then share one object rather than
// leaving a new one behind on every download.
export function generatedCacheKey(subject, bytes) {
  const digest = createHash('sha256').update(Buffer.from(bytes)).digest('hex').slice(0, 32);
  return `${CACHE_PREFIX}/${subject}/generated-${digest}-${CACHE_VERSION}.pdf`;
}

export function cacheUrl(key) {
  if (!R2_PUBLIC_URL) {
    throw new Error('Missing VITE_R2_PUBLIC_URL — cannot serve cached chapter PDFs');
  }
  return `${R2_PUBLIC_URL}/${key.split('/').map(encodeURIComponent).join('/')}`;
}

// Returns the public URL if the object already exists, else null.
export async function readCached(key) {
  const url = cacheUrl(key);
  try {
    const res = await fetch(url, { method: 'HEAD' });
    return res.ok ? url : null;
  } catch {
    return null; // Treat a probe failure as a miss and recompose.
  }
}

let client;
function s3() {
  if (client) return client;

  const { R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY } = process.env;
  const missing = Object.entries({ R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY })
    .filter(([, v]) => !v)
    .map(([k]) => k);
  if (missing.length) {
    throw new Error(`Missing R2 credential env var(s): ${missing.join(', ')}`);
  }

  client = new S3Client({
    region: 'auto',
    endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: R2_ACCESS_KEY_ID,
      secretAccessKey: R2_SECRET_ACCESS_KEY,
    },
  });
  return client;
}

// `fileName` is what the browser saves the PDF as. A chapter download is opened
// in a tab, so it stays `inline`; a generated paper is fetched by a plain anchor
// click and asks for `attachment` so the browser saves it instead of navigating
// the app away.
export async function writeCached(key, bytes, fileName, disposition = 'inline') {
  await s3().send(
    new PutObjectCommand({
      Bucket: R2_BUCKET,
      Key: key,
      Body: Buffer.from(bytes),
      ContentType: 'application/pdf',
      ContentDisposition: `${disposition}; filename="${fileName.replace(/["\\]/g, '')}"`,
    }),
  );
  return cacheUrl(key);
}
