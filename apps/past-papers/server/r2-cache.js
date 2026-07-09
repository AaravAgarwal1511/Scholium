// Cache for composed chapter PDFs, stored in the public R2 `papers` bucket.
//
// A composed chapter runs 10–65 MB, far over the ~4.5 MB body a Vercel function
// may return, so /api/chapter-paper writes the PDF to R2 and returns its public
// URL instead of inlining base64. Keys are deterministic (see chapterCacheKey),
// so the same year range + order is composed once and served from R2 after that.
//
// Objects live under `_cache/`, which build-paper-index.js skips so they never
// show up as browseable chapters. A bucket lifecycle rule can expire this prefix.

import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';

export const CACHE_PREFIX = '_cache';

// Bump when the composition output changes in a way that invalidates old PDFs
// (layout, crop geometry, banner text) — old keys are simply orphaned.
const CACHE_VERSION = 'v1';

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

// `fileName` is what the browser saves the PDF as.
export async function writeCached(key, bytes, fileName) {
  await s3().send(
    new PutObjectCommand({
      Bucket: R2_BUCKET,
      Key: key,
      Body: Buffer.from(bytes),
      ContentType: 'application/pdf',
      ContentDisposition: `inline; filename="${fileName.replace(/["\\]/g, '')}"`,
    }),
  );
  return cacheUrl(key);
}
