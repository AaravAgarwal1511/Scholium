// Vercel serverless function: GET /api/prune-papers.
//
// Deletes Mock Space attempts more than RETENTION_DAYS old: both the question paper
// in the storage bucket and the mock_attempts row holding the answers. They expire
// together because a script cannot be exported without the paper it was written on.
//
// A daily Vercel Cron invokes it (see vercel.json). Requires these env vars in the
// Vercel project:
//   VITE_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, CRON_SECRET
//
// This runs server-side rather than sweeping from the browser because a student who
// never comes back would otherwise leave their attempt behind forever.
//
// Paper deletion goes through the Storage API, not `delete from storage.objects`:
// the latter drops the row and orphans the file in the storage backend.

import { createClient } from '@supabase/supabase-js';

// Must match PAPER_RETENTION_DAYS in src/lib/paperRetention.ts. This file is not
// part of the Vite build, so it cannot import it — paperRetention.test.ts reads
// this source and fails if the two drift apart.
const RETENTION_DAYS = 15;

const BUCKET = 'mock-space-papers';
const TABLE = 'mock_attempts';
const PAGE = 1000;
const DAY_MS = 86_400_000;

export const config = { maxDuration: 60 };

export default async function handler(req, res) {
  // Vercel Cron sends `Authorization: Bearer $CRON_SECRET`. Fail closed: without a
  // secret configured, anyone could call this endpoint.
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.authorization !== `Bearer ${secret}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const url = process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    return res.status(500).json({ error: 'Missing VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY' });
  }

  const supabase = createClient(url, key, { auth: { persistSession: false } });
  const cutoff = Date.now() - RETENTION_DAYS * DAY_MS;

  try {
    const expired = [];

    // The bucket is one folder per user; `list('')` enumerates those folders.
    for (const folder of await listAll(supabase, '')) {
      if (folder.id !== null) continue; // a file at the root, not a user folder
      for (const file of await listAll(supabase, folder.name)) {
        if (file.id === null) continue;
        const createdAt = Date.parse(file.created_at ?? '');
        if (Number.isFinite(createdAt) && createdAt < cutoff) {
          expired.push(`${folder.name}/${file.name}`);
        }
      }
    }

    for (let i = 0; i < expired.length; i += PAGE) {
      const batch = expired.slice(i, i + PAGE);
      const { error } = await supabase.storage.from(BUCKET).remove(batch);
      if (error) throw new Error(error.message);
    }

    // Papers first, rows second. If the run dies between the two, the leftover row
    // fails to resume with "paper no longer stored" and is swept next time — a row
    // without its paper is inert, whereas a paper without its row is invisible and
    // would never be collected.
    const { error: rowError, count } = await supabase
      .from(TABLE)
      .delete({ count: 'exact' })
      .lt('created_at', new Date(cutoff).toISOString());
    if (rowError) throw new Error(rowError.message);

    return res.status(200).json({
      papersDeleted: expired.length,
      attemptsDeleted: count ?? 0,
      retentionDays: RETENTION_DAYS,
    });
  } catch (e) {
    return res.status(500).json({ error: e instanceof Error ? e.message : 'Prune failed' });
  }
}

/** Storage `list` is capped per call, so page until it stops returning rows. */
async function listAll(supabase, prefix) {
  const rows = [];
  for (let offset = 0; ; offset += PAGE) {
    const { data, error } = await supabase.storage
      .from(BUCKET)
      .list(prefix, { limit: PAGE, offset });
    if (error) throw new Error(error.message);
    if (!data || data.length === 0) return rows;
    rows.push(...data);
    if (data.length < PAGE) return rows;
  }
}
