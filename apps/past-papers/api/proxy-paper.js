// Vercel serverless function: GET /api/proxy-paper?key=... (production).
// See server/proxy-paper-handler.js for why this exists. Requires the same R2
// env vars as /api/compose-paper: R2_ACCOUNT_ID, R2_ACCESS_KEY_ID,
// R2_SECRET_ACCESS_KEY, R2_BUCKET (optional).

import { handleProxyPaper } from '../server/proxy-paper-handler.js';

export const config = { maxDuration: 30 };

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  const { status, body, bytes } = await handleProxyPaper(req.query.key);
  if (bytes) {
    res.setHeader('Content-Type', 'application/pdf');
    return res.status(status).send(Buffer.from(bytes));
  }
  res.status(status).json(body);
}
