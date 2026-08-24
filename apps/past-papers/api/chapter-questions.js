// Vercel serverless function: GET /api/chapter-questions?subject=...&paperNum=... (production).
// See server/chapter-questions-handler.js for why this exists.
// Requires VITE_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY.

import { handleChapterQuestions } from '../server/chapter-questions-handler.js';

export const config = { maxDuration: 30 };

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  const { status, body } = await handleChapterQuestions(req.query ?? {});
  res.status(status).json(body);
}
