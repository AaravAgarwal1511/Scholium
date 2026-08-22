// Shared request handler for /api/chapter-questions, used by both the dev
// Express server (server.js) and the production Vercel function
// (api/chapter-questions.js).
//
// The question index used to be read straight from the browser with the anon
// key (src/lib/papers.ts). `questions_metadata` is ~4000 rows of hand-built
// chapter/sub-topic classification plus crop coordinates, and a blanket
// `GRANT SELECT … TO anon` made the whole table dumpable in four paged
// requests. Reading it through here instead is what lets that grant be revoked
// (database/migrations/20260821000000_revoke_anon_questions_metadata.sql) —
// the service role below bypasses RLS, so this path is unaffected by it.
//
// This does NOT make the index unextractable, and is not meant to: the endpoint
// is unauthenticated like the rest of the browsing surface. It removes the
// bulk-dump primitive, turning one loop over PostgREST into a per-component
// scrape. Auth-gating would close it properly, at the cost of signed-out
// browsing, which this app deliberately supports.

import { createClient } from '@supabase/supabase-js';
import { fetchAllRows } from './supabase-rows.js';

// Lazily created for the same reason as compose-pdf.js: importing this module
// must never throw, and env is only guaranteed at request time.
function getSupabase() {
  const url = process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error('Missing VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  }
  return createClient(url, key, { auth: { persistSession: false } });
}

function isInt(v) {
  return Number.isInteger(v);
}

// Every component label the app produces is single-digit ("Paper 2" → 2). The
// bound is only here so a nonsense value can't reach PostgREST as a LIKE
// pattern; paperNum is interpolated into one, unlike the parameterised .eq().
const MAX_PAPER_NUM = 99;

// Subject codes are 4 characters ("0607"). Anything longer is not a subject.
const MAX_SUBJECT_LEN = 64;

// `query` is the raw request query object, so every value arrives as a string —
// paperNum is coerced here rather than at the two call sites.
export async function handleChapterQuestions(query, supabaseFactory = getSupabase) {
  const subject = query?.subject;
  const paperNum = Number(query?.paperNum);

  if (!subject || typeof subject !== 'string' || subject.length > MAX_SUBJECT_LEN) {
    return { status: 400, body: { error: 'subject is required' } };
  }
  if (!isInt(paperNum) || paperNum <= 0 || paperNum > MAX_PAPER_NUM) {
    return { status: 400, body: { error: 'paperNum must be a positive integer' } };
  }

  try {
    // Same scoping the browser used to apply itself: this subject, restricted to
    // the selected paper via the `P<n>-` id prefix. fetchAllRows is not optional
    // — PostgREST's 1000-row cap applies to the service role too, and a
    // truncated result is indistinguishable from a complete one.
    const supabase = supabaseFactory();
    const rows = await fetchAllRows((from, to) =>
      supabase
        .from('questions_metadata')
        .select('id, chapter_num, paper')
        .eq('subject', subject)
        .like('id', `P${paperNum}-%`)
        .order('id')
        .range(from, to),
    );

    return { status: 200, body: { rows } };
  } catch (error) {
    console.error('Chapter questions error:', error);
    return { status: 500, body: { error: 'Failed to load question index' } };
  }
}
