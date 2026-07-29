import { PDFDocument, PDFArray, StandardFonts, decodePDFRawStream, rgb } from 'pdf-lib';
import { createClient } from '@supabase/supabase-js';
import { fetchRowsByIds } from './supabase-rows.js';
import { createCharIndex, regionHasContent, tightenBottom, hasBlankPageBanner } from './page-chars.js';

// Lazily create the Supabase client so merely importing this module never throws
// (env is present at runtime in both the dev server and the serverless function).
function getSupabase() {
  const url = process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error('Missing VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  }
  return createClient(url, key, { auth: { persistSession: false } });
}

// Source PDFs + index JSON are fetched through a "loader" so the same composition
// code works from local disk (dev) or R2 over HTTP (prod). A loader exposes:
//   loadIndex(paperNum, kind)        -> parsed JSON object
//   loadPdfBytes(paperNum, kind, stem) -> Uint8Array | Buffer
// See server/loaders.js.

// A4 page geometry (PDF points). Mirrors PAGE_W / PAGE_H in _build_topicals.py.
const PAGE_W = 595.276;
const PAGE_H = 841.89;
const MARGIN = 36; // 0.5"
const CONTENT_W = PAGE_W - 2 * MARGIN;
const CONTENT_TOP = PAGE_H - MARGIN;
const CONTENT_BOTTOM = MARGIN;

// Phase 3 crop knobs (see BUILD.md → Stage 3, Stage 5).
const MIN_CROP_HEIGHT = 20;         // floor every pipeline applies
const INTRA_GROUP_GAP = 4;          // between a stimulus and its sub-part
const BANNER_BLOCK_H = 36;          // inline paper banner (label + q list + rule)
const HEADER_ZONE = 45;             // page number / paper code / © line live above this
const FOOTER_ZONE = 50;             // © UCLES / [Turn over] band at the foot
const MIN_CONTENT_CHARS = 8;        // MIN_CHARS_FOR_CONTENT
const TIGHTEN_PAD = 5;              // breathing room under the last trimmed line

// `has_content` in _build_topicals.py drops crops holding nothing but page
// furniture. It counts extracted characters, which needs a text layer we can't
// read with pdf-lib — but the thing it is actually catching here is the
// "BLANK PAGE" separator, and those are trivially separable by how much is drawn
// on the page. Measured across 544 source pages of 0455/0606/0607/0625/0478:
//
//   every page from 159 to 349 bytes of content stream is a literal BLANK PAGE
//   the smallest page carrying real content is 495 bytes
//
// 400 sits in that gap. Erring high would drop real content, so if this ever
// needs adjusting, move it DOWN — a kept blank page is cosmetic, a dropped
// question is not. Note this measures drawn content, not text, so a full-page
// figure (large stream, no text) is correctly kept — which a text-based check
// would have wrongly discarded.
const BLANK_PAGE_MAX_STREAM = 400;

// Crop geometry is a property of the *extraction pipeline*, not of the app, and
// the pipelines have diverged. 0606/0607/0625/0478 come from the original
// _build_topicals.py, which shifts both crop edges by one headroom value, marks
// "runs past the page bottom" with 720.0, and finds the stop by walking forward
// to question q+1. 0455 comes from a later revision that
//   - moved the sentinel to 760.0,
//   - split the shift into top (clear the first line's ascenders) and bottom
//     (only clear the next marker's baseline), with a 20pt minimum crop height,
//   - records `next_boundary` [page, y] so the stop is read, not walked, and
//   - carries `stem_specs`: the shared stimulus a sub-part belongs to, which must
//     be laid down directly above it or the question is unreadable on its own.
// Getting this wrong is silent — crops land a few points off, or a sub-part
// prints without its source material — so it is keyed per subject explicitly.
const DEFAULT_GEOMETRY = {
  sentinel: 720.0,
  questions: { top: 14, bottom: 14 },   // FRACTION_HEADROOM
  markSchemes: { top: 2, bottom: 2 },
  hasStems: false,
};

const SUBJECT_GEOMETRY = {
  '0455': {
    sentinel: 760.0,
    questions: { top: 10, bottom: 6 },  // TOP_HEADROOM / HEADROOM
    markSchemes: { top: 2, bottom: 2 },
    hasStems: true,
  },
  '0625': {
    sentinel: 720.0,
    questions: { top: 8, bottom: 8 },   // MARKER_HEADROOM
    markSchemes: { top: 2, bottom: 2 },
    hasStems: false,
  },
};

export function geometryFor(subject) {
  return SUBJECT_GEOMETRY[subject] ?? DEFAULT_GEOMETRY;
}

// "2", "2(a)", "10" — order numerically, then by part letter.
const Q_SORT_RE = /^(\d+)(?:\(([a-z])\))?$/;
function qSortKey(q) {
  const m = Q_SORT_RE.exec(String(q).trim());
  return m ? [parseInt(m[1], 10), m[2] ?? ''] : [9999, ''];
}

export function compareQ(a, b) {
  const [an, al] = qSortKey(a);
  const [bn, bl] = qSortKey(b);
  return an !== bn ? an - bn : al < bl ? -1 : al > bl ? 1 : 0;
}

// Source PDF + index cache (per request, so a single composition reuses I/O).
function makeCache() {
  return {
    pdfs: new Map(),     // `${paperNum}/${kind}/${stem}` → PDFDocument
    indexes: new Map(),  // `${paperNum}/${kind}` → Map<stem, {meta, byQ, questions}>
    blank: new Map(),    // PDFDocument → Map<pageIndex, boolean>
    blankText: new Map(), // PDFDocument → Map<pageIndex, boolean>
    bytes: new Map(),    // PDFDocument → { key, bytes }  (for the text layer)
    chars: createCharIndex(),
  };
}

// How much is drawn on a source page — see BLANK_PAGE_MAX_STREAM. Memoized:
// one spanning question can revisit the same page for every sub-part.
function isBlankPage(cache, srcDoc, pageIndex) {
  let perDoc = cache.blank.get(srcDoc);
  if (!perDoc) cache.blank.set(srcDoc, (perDoc = new Map()));
  if (perDoc.has(pageIndex)) return perDoc.get(pageIndex);

  let blank = false;
  try {
    let contents = srcDoc.getPage(pageIndex).node.Contents();
    if (contents instanceof PDFArray) contents = contents.lookup(0);
    blank = decodePDFRawStream(contents).decode().length <= BLANK_PAGE_MAX_STREAM;
  } catch {
    blank = false; // unreadable stream → keep the page, never drop content on a guess
  }
  perDoc.set(pageIndex, blank);
  return blank;
}

// A literal "BLANK PAGE" banner, read straight from the raw content stream —
// no pdf.js, no fonts, no native binary. Text-showing operators write plain
// ASCII inside parentheses (`(BLANK PAGE) Tj`, or split across a kerned array
// like `[(BLANK)-250(PAGE)]TJ`), so concatenating every parenthesized literal
// on the page and stripping whitespace before searching catches the banner
// regardless of how the words got split into operators.
//
// isBlankPage's byte-size threshold already catches most literal BLANK PAGE
// separators, but not the closing acknowledgements page — that one carries
// substantial real text (the UCLES permissions paragraph) alongside its own
// "BLANK PAGE" banner further down, so its stream is well over
// BLANK_PAGE_MAX_STREAM. This is what actually catches that page: reading the
// stream directly, with no dependency on the pdf.js/canvas machinery that
// proved unreliable in the serverless runtime (missing standard fonts,
// missing native canvas — see hasBlankPageBanner and its history).
function pageHasBlankPageText(cache, srcDoc, pageIndex) {
  let perDoc = cache.blankText.get(srcDoc);
  if (!perDoc) cache.blankText.set(srcDoc, (perDoc = new Map()));
  if (perDoc.has(pageIndex)) return perDoc.get(pageIndex);

  let found = false;
  try {
    let contents = srcDoc.getPage(pageIndex).node.Contents();
    if (contents instanceof PDFArray) contents = contents.lookup(0);
    const bytes = decodePDFRawStream(contents).decode();
    const stream = Buffer.from(bytes).toString('latin1');
    const literals = [...stream.matchAll(/\(([^()\\]*)\)/g)].map((m) => m[1]).join('');
    found = literals.toUpperCase().replace(/\s+/g, '').includes('BLANKPAGE');
  } catch {
    found = false; // unreadable stream → never drop content on a guess
  }
  perDoc.set(pageIndex, found);
  return found;
}

async function loadIndex(cache, loader, paperNum, kind) {
  const key = `${paperNum}/${kind}`;
  if (cache.indexes.has(key)) return cache.indexes.get(key);

  const raw = await loader.loadIndex(paperNum, kind);

  const idx = new Map();
  for (const [stem, entry] of Object.entries(raw)) {
    // Keyed by String: 0455 Paper 2 numbers its records "2(a)", everything else
    // uses integers, and questions_metadata now returns both as text.
    const byQ = new Map();
    const posOf = new Map();
    entry.questions.forEach((q, i) => {
      byQ.set(String(q.q), q);
      posOf.set(String(q.q), i);
    });
    idx.set(stem, { meta: entry.meta, byQ, posOf, questions: entry.questions });
  }
  cache.indexes.set(key, idx);
  return idx;
}

async function loadSourcePdf(cache, loader, paperNum, kind, stem) {
  const cacheKey = `${paperNum}/${kind}/${stem}`;
  if (cache.pdfs.has(cacheKey)) return cache.pdfs.get(cacheKey);
  const bytes = await loader.loadPdfBytes(paperNum, kind, stem);
  const pdf = await PDFDocument.load(bytes);
  cache.pdfs.set(cacheKey, pdf);
  // Kept for the content test, which needs a text layer pdf-lib cannot give it.
  // `PDFDocument.load` copies, so these bytes stay intact.
  cache.bytes.set(pdf, { key: cacheKey, bytes });
  return pdf;
}

// Wall time is dominated by fetching one multi-megabyte source PDF per distinct
// exam, not by the question count — and a "every chapter" selection scatters its
// questions across most of the syllabus's exams (0606 has 82 per component, the
// most of any subject; 80 questions there touch ~50 exams). Fetched one after
// another that is 50-75s, past the 60s serverless limit, so the function is
// killed and the user gets nothing back. The fetches are independent, so warm
// them concurrently before rendering; the render loop then reads the cache.
//
// Failures are swallowed here on purpose — the sequential path re-requests and
// raises the real error in context.
const SOURCE_FETCH_CONCURRENCY = 8;

async function prefetchSources(cache, loader, sections, kind) {
  const pending = sections.filter((s) => !cache.pdfs.has(`${s.paperNum}/${kind}/${s.stem}`));
  let next = 0;
  const worker = async () => {
    while (next < pending.length) {
      const s = pending[next++];
      try {
        await loadSourcePdf(cache, loader, s.paperNum, kind, s.stem);
      } catch {
        /* retried, and reported, by the render loop */
      }
    }
  };
  await Promise.all(
    Array.from({ length: Math.min(SOURCE_FETCH_CONCURRENCY, pending.length) }, worker),
  );
}

// The suffix in "P2-Q081" is a serial number (sorted-CSV index), NOT the
// question number within the paper. The in-paper question number lives in
// questions_metadata.question_number.
export function parsePaperNum(id) {
  const m = id.match(/^P(\d+)-Q\d+$/);
  if (!m) throw new Error(`Invalid question id: ${id}`);
  return parseInt(m[1], 10);
}

// CSV "June-2014-1" + paperNum 2 → stem "June2014-21".
export function makeStem(paperField, paperNum) {
  const parts = paperField.split('-');
  if (parts.length !== 3) {
    throw new Error(`Unexpected paper format: ${paperField}`);
  }
  const [month, year, tz] = parts;
  return `${month}${year}-${paperNum}${tz}`;
}

const MONTH_ORDER = { March: 0, June: 1, November: 2 };
export function paperSortKey(meta) {
  return [meta.year, MONTH_ORDER[meta.month] ?? 99, meta.timezone];
}

// "oldest" → June 2014 first (how the prebuilt topical PDFs are ordered).
// "newest" → November 2025 first. Only the paper sections flip; question
// numbers within one exam always ascend.
export const PAPER_ORDERS = ['oldest', 'newest'];

// Crop spec computation — mirrors `_page_specs` in _build_topicals.py.
// Returns [{page, yTop, yBot}] in TOP-origin coordinates (PDF points from top).
// `yBot: null` means "to the bottom of that source page".

// Every subject's `_build_topicals.py` implements the SAME algorithm; only the
// constants differ (and 0455 adds `next_boundary`). This is that algorithm.
//
// The sentinel means "the next marker is not on this page", so a record carrying
// it runs to the BOTTOM of its own page and continues on the following ones. An
// earlier version of this file instead cropped to `sentinel - headroom` (a
// coordinate that means nothing) and started continuation pages at a 45pt header
// skip, which silently truncated every multi-page question — ~136pt lost off the
// first page. On 0625 Paper 2 that ate the answer options off MCQ items, and on
// its mark schemes it dropped the answer row and left only the table header.
export function pageSpecs(qRecord, nextRecord, skippablePages, geom, kind, pageCount) {
  const { top, bottom } = geom[kind === 'questions' ? 'questions' : 'markSchemes'];
  const yTop = Math.max(0, qRecord.y_start - top);

  if (qRecord.y_end !== geom.sentinel) {
    return [
      { page: qRecord.page, yTop, yBot: Math.max(yTop + MIN_CROP_HEIGHT, qRecord.y_end - bottom) },
    ];
  }

  // Where the run stops. 0455 records `next_boundary` — the next marker of ANY
  // kind — which for a question's last sub-part is the following question's
  // *number*, above its stimulus; the next stored record would instead be that
  // question's first sub-part, and stopping there swallows the stimulus.
  let endPage = null;
  let endY = null;
  if (qRecord.next_boundary) {
    endPage = Number(qRecord.next_boundary[0]);
    endY = Number(qRecord.next_boundary[1]);
  } else if (nextRecord) {
    endPage = nextRecord.page;
    endY = Number(nextRecord.y_start);
  }

  // Only the run-on pages are marked `continuation`. The record's own page always
  // holds the question itself and is never eligible to be dropped as empty.
  const specs = [{ page: qRecord.page, yTop, yBot: null }];
  if (endPage === null) {
    for (let p = qRecord.page + 1; p <= pageCount; p++) {
      if (!skippablePages.has(p)) specs.push({ page: p, yTop: 0, yBot: null, continuation: true });
    }
    return specs;
  }
  for (let p = qRecord.page + 1; p < endPage; p++) {
    if (!skippablePages.has(p)) specs.push({ page: p, yTop: 0, yBot: null, continuation: true });
  }
  if (endPage > qRecord.page && !skippablePages.has(endPage)) {
    specs.push({
      page: endPage,
      yTop: 0,
      yBot: Math.max(MIN_CROP_HEIGHT, endY - bottom),
      continuation: true,
    });
  }
  return specs;
}

// A run-on crop that carries no question content — a BLANK PAGE separator swept
// into the span, or a sliver below the next page's header holding only the page
// number. This is `has_content` from _build_topicals.py.
//
// It is applied ONLY to `continuation` crops, never to the page a record starts
// on, and that restriction is load-bearing: a multiple-choice mark-scheme row is
// the string "1 A 1", three characters, which any sensible character threshold
// would discard. The reference works around that by dropping `min_chars` to 2
// for those subjects; scoping to continuations avoids the per-subject tuning
// altogether, because every such row sits on its own record's page.
//
// The cheap page-level check runs first so obvious BLANK PAGEs never pay for
// text extraction. When it does run, the literal "BLANK PAGE" banner (see
// hasBlankPageBanner) is checked before falling back to the char count — the
// banner text is itself 9 characters, enough to clear MIN_CONTENT_CHARS on its
// own, so a filler page whose byte stream slips past BLANK_PAGE_MAX_STREAM
// would otherwise read as real content.
// An open-ended crop (`yBot === null`) means "to the bottom of the page", which
// drags in the blank remainder and the © UCLES footer. Trim it to the last line
// of real content instead — the reference's `tighten_bottom`.
//
// This is what stops a near-empty page from taking a whole output page: a
// question that is the LAST in its paper has no next marker, so the spec sweeps
// every remaining page — the BLANK PAGE separators and the closing
// acknowledgements block — and each of those holds enough characters to pass the
// content test. Trimmed, they collapse to a thin strip instead.
//
// Questions only. The reference disables it for mark schemes because their rows
// are bounded by drawn table rules rather than by characters, so trimming to the
// last glyph would cut through the ruling.
async function tightenOpenEnd(cache, srcDoc, spec, kind) {
  if (spec.yBot !== null || kind !== 'questions') return spec;

  const source = cache.bytes.get(srcDoc);
  if (!source) return spec;
  try {
    const page = await cache.chars.pageChars(source.key, source.bytes, spec.page);
    const yBot = tightenBottom(page, spec.yTop, spec.yBot, {
      footerSkip: FOOTER_ZONE,
      pad: TIGHTEN_PAD,
    });
    if (yBot === null || !(yBot > spec.yTop)) return spec;
    return { ...spec, yBot };
  } catch {
    return spec; // untrimmed is merely ugly; guessing could clip content
  }
}

async function isEmptyContinuation(cache, srcDoc, spec) {
  if (!spec.continuation) return false;
  if (isBlankPage(cache, srcDoc, spec.page - 1)) return true;
  if (pageHasBlankPageText(cache, srcDoc, spec.page - 1)) return true;

  const source = cache.bytes.get(srcDoc);
  if (!source) return false; // no bytes retained → keep the crop
  try {
    const page = await cache.chars.pageChars(source.key, source.bytes, spec.page);
    if (hasBlankPageBanner(page)) return true;
    return !regionHasContent(page, spec.yTop, spec.yBot, {
      headerSkip: HEADER_ZONE,
      footerSkip: FOOTER_ZONE,
      minChars: MIN_CONTENT_CHARS,
    });
  } catch (err) {
    // Never drop content because the text layer could not be read.
    console.warn(`  ⚠️  Content check failed for p${spec.page}: ${err.message}`);
    return false;
  }
}

// The stimulus shares a crop convention with its parts: the same ascender
// clearance at the top, and the same shift at the bottom — without it the crop
// keeps the top slice of "(a) Define …" as a half-height ghost under every stem.
function stemSpecs(qRecord, geom, pageCount) {
  const { top, bottom } = geom.questions;
  const out = [];
  for (const spec of qRecord.stem_specs ?? []) {
    const page = Number(spec[0]);
    if (!(page >= 1 && page <= pageCount)) continue;
    let yTop = Number(spec[1]);
    let yBot = spec[2] === null || spec[2] === undefined ? null : Number(spec[2]);
    if (yTop > 0) yTop = Math.max(0, yTop - top);
    if (yBot !== null) yBot = Math.max(yTop + 10, yBot - bottom);
    out.push({ page, yTop, yBot });
  }
  return out;
}

// Vertical-flow layout on A4 — mirrors PageLayout in _build_topicals.py.
class PageLayout {
  constructor(outDoc, font, boldFont) {
    this.out = outDoc;
    this.font = font;
    this.boldFont = boldFont;
    this.page = null;
    this.cursor = CONTENT_TOP;
    this.pendingBanner = null;
  }

  _newPage() {
    this.page = this.out.addPage([PAGE_W, PAGE_H]);
    this.cursor = CONTENT_TOP;
  }

  // Queue a banner; only drawn when an actual crop follows (matches queue_banner).
  queueBanner(label, qList) {
    this.pendingBanner = { label, qList };
  }

  _flushBanner() {
    if (!this.pendingBanner) return;
    const { label, qList } = this.pendingBanner;
    this.pendingBanner = null;

    // `_place` has already guaranteed room for the banner plus its block, so
    // this is only a guard for a banner flushed outside that path.
    const blockH = BANNER_BLOCK_H;
    if (this.page === null || this.cursor - blockH < CONTENT_BOTTOM) {
      this._newPage();
    }

    this.page.drawText(label, {
      x: MARGIN,
      y: this.cursor - 13,
      size: 13,
      font: this.boldFont,
      color: rgb(0.1, 0.1, 0.15),
    });
    const sub = `${qList.length} question${qList.length === 1 ? '' : 's'}: ${qList
      .map((q) => `Q${q}`)
      .join(', ')}`;
    this.page.drawText(sub, {
      x: MARGIN,
      y: this.cursor - 27,
      size: 9,
      font: this.font,
      color: rgb(0.4, 0.4, 0.45),
    });
    this.page.drawLine({
      start: { x: MARGIN, y: this.cursor - 32 },
      end: { x: PAGE_W - MARGIN, y: this.cursor - 32 },
      thickness: 0.5,
      color: rgb(0.7, 0.7, 0.75),
    });
    this.cursor -= blockH;
  }

  // Full-page section heading (e.g. "Questions" / "Mark Scheme").
  sectionHeader(text) {
    this._newPage();
    const size = 36;
    const w = this.boldFont.widthOfTextAtSize(text, size);
    this.page.drawText(text, {
      x: (PAGE_W - w) / 2,
      y: PAGE_H / 2 + 20,
      size,
      font: this.boldFont,
      color: rgb(0.1, 0.1, 0.15),
    });
    this.page.drawLine({
      start: { x: PAGE_W / 2 - 60, y: PAGE_H / 2 + 10 },
      end: { x: PAGE_W / 2 + 60, y: PAGE_H / 2 + 10 },
      thickness: 1.5,
      color: rgb(0.3, 0.3, 0.4),
    });
    // Force next addCrop onto a fresh page.
    this.cursor = CONTENT_BOTTOM - 1;
    this.pendingBanner = null;
  }

  // `yBotFromTop === null` means "to the bottom of the source page".
  //
  // A numeric bound is passed through UNCLAMPED, deliberately. 0478's mark
  // schemes are 595pt landscape pages, shorter than the 720 sentinel, so the
  // sentinel puts the crop box below the media box — and that is what the
  // existing output was built from. Clamping it to the page height is arguably
  // more correct but silently reflows every affected 0478 crop, so the bound
  // stays as the index recorded it.
  _measure(srcDoc, pageIndex, yTopFromTop, yBotFromTop) {
    const srcPage = srcDoc.getPage(pageIndex);
    const srcW = srcPage.getWidth();
    const srcH = srcPage.getHeight();
    const pdfTop = srcH - yTopFromTop;
    const pdfBot = srcH - (yBotFromTop === null ? srcH : yBotFromTop);
    const cropH = pdfTop - pdfBot;
    if (cropH <= 0) return null;
    const scale = Math.min(1.0, CONTENT_W / srcW);
    return { srcPage, srcW, pdfTop, pdfBot, cropH, scale };
  }

  async _draw(m, scale) {
    const embedded = await this.out.embedPage(m.srcPage, {
      left: 0,
      bottom: m.pdfBot,
      right: m.srcW,
      top: m.pdfTop,
    });
    const drawW = m.srcW * scale;
    const drawH = m.cropH * scale;
    const x = MARGIN + (CONTENT_W - drawW) / 2;
    const y = this.cursor - drawH;
    this.page.drawPage(embedded, { x, y, width: drawW, height: drawH });
    return y;
  }

  // Place crops as one unbreakable block, so a 0455 stimulus is never split from
  // the sub-part it introduces.
  //
  // A pending banner is costed into the fit BEFORE anything is drawn, and the
  // block is scaled to fit a fresh page rather than split. Both matter: the old
  // code reserved room for the crop alone, drew the banner, then re-checked — so
  // a crop that no longer fit pushed itself to a new page and left the banner
  // stranded on an otherwise blank one. A crop too tall for any page did it
  // twice and left a page with nothing on it at all. Those were the blank pages
  // in 0455 Paper 2; deciding everything up front means a page is only ever
  // started when something is about to be drawn on it.
  async _place(measured) {
    if (measured.length === 0) return;

    const bannerH = this.pendingBanner ? BANNER_BLOCK_H : 0;
    const gaps = INTRA_GROUP_GAP * (measured.length - 1);
    const scales = measured.map((m) => m.scale);
    const heightOf = () => measured.reduce((sum, m, i) => sum + m.cropH * scales[i], 0) + gaps;

    let blockH = heightOf();
    const freshAvail = CONTENT_TOP - CONTENT_BOTTOM - bannerH;
    if (blockH > freshAvail) {
      const shrink = (freshAvail - gaps) / Math.max(1e-6, blockH - gaps);
      for (let i = 0; i < scales.length; i++) scales[i] *= shrink;
      blockH = heightOf();
    }

    if (this.page === null || this.cursor - (bannerH + blockH) < CONTENT_BOTTOM) {
      this._newPage();
    }
    this._flushBanner();

    for (let i = 0; i < measured.length; i++) {
      if (i) this.cursor -= INTRA_GROUP_GAP;
      const y = await this._draw(measured[i], scales[i]);
      this.cursor = y;
    }
    this.cursor -= 8;
  }

  async addCrop(srcDoc, pageIndex, yTopFromTop, yBotFromTop) {
    const m = this._measure(srcDoc, pageIndex, yTopFromTop, yBotFromTop);
    return this._place(m ? [m] : []);
  }

  async addGroup(crops) {
    const measured = [];
    for (const c of crops) {
      const m = this._measure(c.doc, c.pageIndex, c.yTop, c.yBot);
      if (m) measured.push(m);
    }
    return this._place(measured);
  }
}

async function renderSection(layout, cache, items, kind, loader, order, geom) {
  // Group by (paperNum, stem).
  const grouped = new Map();
  for (const it of items) {
    const stem = makeStem(it.paper, it.paperNum);
    const key = `${it.paperNum}/${stem}`;
    if (!grouped.has(key)) {
      grouped.set(key, { paperNum: it.paperNum, stem, qNums: [] });
    }
    grouped.get(key).qNums.push(it.qNum);
  }

  // Preload indexes once per (paperNum, kind).
  const indexesByPaperNum = new Map();
  for (const { paperNum } of grouped.values()) {
    if (!indexesByPaperNum.has(paperNum)) {
      indexesByPaperNum.set(paperNum, await loadIndex(cache, loader, paperNum, kind));
    }
  }

  const sections = [];
  for (const { paperNum, stem, qNums } of grouped.values()) {
    const idx = indexesByPaperNum.get(paperNum);
    const entry = idx.get(stem);
    if (!entry) {
      console.warn(`  ⚠️  No ${kind} index for stem ${stem}`);
      continue;
    }
    sections.push({
      paperNum,
      stem,
      qNums: qNums.sort(compareQ),
      entry,
    });
  }

  // Order paper sections by (year, month, timezone) — ascending matches Phase 3.
  const direction = order === 'newest' ? -1 : 1;
  sections.sort((a, b) => {
    const ka = paperSortKey(a.entry.meta);
    const kb = paperSortKey(b.entry.meta);
    for (let i = 0; i < 3; i++) {
      if (ka[i] !== kb[i]) return direction * (ka[i] - kb[i]);
    }
    return 0;
  });

  // Pages a multi-page question may span *over*. The mark-scheme index always
  // calls them `preamble_pages`; the question index's name is subject-specific —
  // 0606/0607 embed a formula sheet (`formula_pages`), 0625 has none and instead
  // marks BLANK PAGE / "starts on the next page" / end-matter as `filler_pages`.
  // Same role either way, so accept whichever the index carries.
  const skipKeys = kind === 'questions' ? ['formula_pages', 'filler_pages'] : ['preamble_pages'];
  const withStems = geom.hasStems && kind === 'questions';

  await prefetchSources(cache, loader, sections, kind);

  for (const { paperNum, stem, qNums, entry } of sections) {
    const meta = entry.meta;
    const label = `${meta.month} ${meta.year} — Paper ${meta.paper}${meta.timezone}`;
    layout.queueBanner(label, qNums);

    const skippable = new Set(skipKeys.flatMap((k) => meta[k] ?? []));
    const srcDoc = await loadSourcePdf(cache, loader, paperNum, kind, stem);
    const pageCount = srcDoc.getPageCount();

    for (const q of qNums) {
      const key = String(q);
      const record = entry.byQ.get(key);
      if (!record) {
        console.warn(`  ⚠️  Missing ${kind} record for ${stem} Q${q}`);
        continue;
      }

      // The stop is the next record in DOCUMENT order, not question q+1 — the
      // numbering can skip, and every _build_topicals.py uses questions[i+1].
      const pos = entry.posOf.get(key);
      const nextRecord = pos === undefined ? null : entry.questions[pos + 1] ?? null;
      const specs = pageSpecs(record, nextRecord, skippable, geom, kind, pageCount);

      // The stimulus and its sub-part go down as one block so a page break can
      // never separate them; everything else is placed crop by crop.
      const onPage = [
        ...(withStems ? stemSpecs(record, geom, pageCount) : []),
        ...specs,
      ].filter((s) => s.page - 1 >= 0 && s.page - 1 < pageCount);

      const keep = await Promise.all(
        onPage.map(async (s) => !(await isEmptyContinuation(cache, srcDoc, s))),
      );
      const trimmed = await Promise.all(
        onPage.map((s) => tightenOpenEnd(cache, srcDoc, s, kind)),
      );
      const crops = trimmed
        .filter((_, i) => keep[i])
        .map((s) => ({ doc: srcDoc, pageIndex: s.page - 1, yTop: s.yTop, yBot: s.yBot ?? null }));

      if (withStems) {
        await layout.addGroup(crops);
      } else {
        for (const c of crops) await layout.addCrop(c.doc, c.pageIndex, c.yTop, c.yBot);
      }
    }
  }
}

// options:
//   includeMarkScheme — append a Mark Scheme section after the questions
//   markSchemeOnly    — emit *only* the Mark Scheme section (chapter "MS" download)
//   order             — "oldest" | "newest" (see PAPER_ORDERS)
export async function composePdf(questionIds, subject, loader, options = {}) {
  const { includeMarkScheme = true, markSchemeOnly = false, order = 'oldest' } = options;

  if (!subject) throw new Error('composePdf requires a subject');
  if (!loader) throw new Error('composePdf requires a loader');
  if (!PAPER_ORDERS.includes(order)) {
    throw new Error(`Invalid order "${order}" (expected ${PAPER_ORDERS.join(' or ')})`);
  }
  console.log(
    `📦 Composing PDF for ${questionIds.length} questions ` +
      `(subject=${subject}, MS=${includeMarkScheme}, msOnly=${markSchemeOnly}, order=${order})`,
  );

  const supabase = getSupabase();

  // Chunked: a single `.in()` over every question of a paper (~1200 ids) comes
  // back truncated at 1000 rows, silently dropping questions from the PDF.
  let rows;
  try {
    rows = await fetchRowsByIds(
      (ids) =>
        supabase
          .from('questions_metadata')
          .select('id, paper, question_number')
          .eq('subject', subject)
          .in('id', ids),
      questionIds,
    );
  } catch (err) {
    throw new Error(`Supabase fetch failed: ${err.message}`);
  }
  if (rows.length === 0) throw new Error('No metadata found for selected questions');

  const byId = new Map(rows.map((r) => [r.id, r]));
  const items = [];
  for (const id of questionIds) {
    const row = byId.get(id);
    if (!row) {
      console.warn(`  ⚠️  Missing metadata for ${id}`);
      continue;
    }
    items.push({
      paperNum: parsePaperNum(id),
      qNum: row.question_number,
      paper: row.paper,
    });
  }
  if (items.length === 0) throw new Error('No valid items to compose');

  const cache = makeCache();
  const geom = geometryFor(subject);
  const outDoc = await PDFDocument.create();
  const font = await outDoc.embedFont(StandardFonts.Helvetica);
  const boldFont = await outDoc.embedFont(StandardFonts.HelveticaBold);
  const layout = new PageLayout(outDoc, font, boldFont);

  // Section 1 — Questions
  if (!markSchemeOnly) {
    layout.sectionHeader('Questions');
    await renderSection(layout, cache, items, 'questions', loader, order, geom);
  }

  // Section 2 — Mark Scheme (only questions the mark-scheme index actually covers)
  let msCount = 0;
  if (markSchemeOnly || includeMarkScheme) {
    // loadIndex memoizes into `cache.indexes` under the same keys renderSection
    // uses, so preloading here costs no extra I/O.
    const msIdxByPaper = new Map();
    for (const paperNum of new Set(items.map((it) => it.paperNum))) {
      msIdxByPaper.set(paperNum, await loadIndex(cache, loader, paperNum, 'mark_schemes'));
    }
    const msItems = items.filter((it) => {
      const entry = msIdxByPaper.get(it.paperNum).get(makeStem(it.paper, it.paperNum));
      return entry ? entry.byQ.has(String(it.qNum)) : false;
    });
    if (msItems.length > 0) {
      layout.sectionHeader('Mark Scheme');
      await renderSection(layout, cache, msItems, 'mark_schemes', loader, order, geom);
      msCount = msItems.length;
    } else if (markSchemeOnly) {
      throw new Error('No mark schemes are indexed for the selected questions');
    }
  }

  const bytes = await outDoc.save();
  console.log(`✅ PDF composed: ${(bytes.length / 1024).toFixed(1)} KB, ${outDoc.getPageCount()} pages`);

  return {
    bytes,
    metadata: {
      totalQuestions: markSchemeOnly ? 0 : items.length,
      totalMarkSchemes: msCount,
      totalPages: outDoc.getPageCount(),
      includeMarkScheme,
      markSchemeOnly,
      order,
    },
  };
}
