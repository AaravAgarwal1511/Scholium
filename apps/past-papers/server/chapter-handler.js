// Shared request handler for /api/chapter-paper, used by both the dev Express
// server (server.js) and the production Vercel function (api/chapter-paper.js).
//
// The chapter cards on ChaptersPage link straight to the prebuilt topical PDFs
// in R2 when the user wants what those files already contain (every year, oldest
// exam first). Narrowing the year range or flipping to newest-first has to be
// composed on demand — that's this endpoint. The result is cached in R2 and the
// caller gets a URL back, never the bytes (see server/r2-cache.js).

import { createClient } from '@supabase/supabase-js';
import { composePdf, PAPER_ORDERS } from './compose-pdf.js';
import { chapterCacheKey, readCached, writeCached } from './r2-cache.js';
import { fetchAllRows } from './supabase-rows.js';

const KINDS = ['qp', 'ms'];

function getSupabase() {
  const url = process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error('Missing VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  }
  return createClient(url, key, { auth: { persistSession: false } });
}

// questions_metadata has no year column — it lives in `paper`, e.g. "June-2014-1".
export function yearOfPaper(paperField) {
  const parts = String(paperField).split('-');
  return parts.length === 3 ? Number(parts[1]) : NaN;
}

function isInt(v) {
  return Number.isInteger(v);
}

export async function handleChapterPaper(body, loaderFactory) {
  const { subject, paperNum, chapter, yearFrom, yearTo, order = 'oldest', kind = 'qp' } = body || {};

  if (!subject || typeof subject !== 'string') {
    return { status: 400, body: { error: 'subject is required' } };
  }
  if (!isInt(paperNum) || paperNum <= 0) {
    return { status: 400, body: { error: 'paperNum must be a positive integer' } };
  }
  if (!isInt(chapter)) {
    return { status: 400, body: { error: 'chapter must be an integer' } };
  }
  if (!isInt(yearFrom) || !isInt(yearTo) || yearFrom > yearTo) {
    return { status: 400, body: { error: 'yearFrom/yearTo must be integers with yearFrom <= yearTo' } };
  }
  if (!PAPER_ORDERS.includes(order)) {
    return { status: 400, body: { error: `order must be one of ${PAPER_ORDERS.join(', ')}` } };
  }
  if (!KINDS.includes(kind)) {
    return { status: 400, body: { error: `kind must be one of ${KINDS.join(', ')}` } };
  }

  try {
    // Same scoping as getQuestionsByChapter: this chapter, restricted to the
    // selected paper via the `P<n>-` id prefix.
    const supabase = getSupabase();
    const rows = await fetchAllRows((from, to) =>
      supabase
        .from('questions_metadata')
        .select('id, paper')
        .eq('subject', subject)
        .eq('chapter_num', chapter)
        .like('id', `P${paperNum}-%`)
        .order('id')
        .range(from, to),
    );

    const matched = rows
      .map((row) => ({ id: row.id, year: yearOfPaper(row.paper) }))
      .filter((row) => Number.isFinite(row.year) && row.year >= yearFrom && row.year <= yearTo);

    if (matched.length === 0) {
      return {
        status: 404,
        body: { error: `No questions for chapter ${chapter} between ${yearFrom} and ${yearTo}` },
      };
    }

    const ids = matched.map((row) => row.id);

    // One year range is applied to every chapter, but chapters don't all span
    // the same years — 2014–2020 and 2015–2020 select identical questions from a
    // chapter that starts in 2015. Key the cache on the years actually matched
    // so those requests share one object instead of composing the same PDF twice.
    const years = matched.map((row) => row.year);
    const fromYear = Math.min(...years);
    const toYear = Math.max(...years);

    const key = chapterCacheKey({
      subject,
      paperNum,
      chapter,
      yearFrom: fromYear,
      yearTo: toYear,
      order,
      kind,
    });

    const hit = await readCached(key);
    if (hit) return { status: 200, body: { url: hit, cached: true } };

    const { bytes, metadata } = await composePdf(ids, subject, loaderFactory(subject), {
      order,
      ...(kind === 'ms' ? { markSchemeOnly: true } : { includeMarkScheme: false }),
    });

    const fileName = `${subject}-P${paperNum}-C${chapter}-${fromYear}-${toYear}-${kind.toUpperCase()}.pdf`;
    const url = await writeCached(key, bytes, fileName);

    return { status: 200, body: { url, cached: false, metadata } };
  } catch (err) {
    // Log the stack, but don't ship it to the browser.
    console.error('Chapter PDF composition error:', err);
    return { status: 500, body: { error: err.message || 'Failed to compose chapter PDF' } };
  }
}
