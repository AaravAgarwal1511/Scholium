// Vercel serverless function: POST /api/chapter-paper (production).
// Composes one chapter over a chosen year range / ordering, caches the PDF in
// R2 and returns its public URL. Requires these env vars in the Vercel project:
//   VITE_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, VITE_R2_PUBLIC_URL,
//   R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET (optional).

import { handleChapterPaper } from '../server/chapter-handler.js';
import { createR2Loader } from '../server/loaders.js';

// A full chapter can span 76 source papers; give it room. Vercel clamps to the
// plan's max. Cache hits return in milliseconds without composing.
export const config = { maxDuration: 60 };

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  const { status, body } = await handleChapterPaper(req.body ?? {}, createR2Loader);
  res.status(status).json(body);
}
