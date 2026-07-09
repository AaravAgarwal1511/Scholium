import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { createClient } from '@supabase/supabase-js';

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
const FRACTION_HEADROOM = 14;       // question pipeline
const MS_HEADROOM = 2;              // mark-scheme pipeline
const BOTTOM_FOOTER_SENTINEL = 720.0;
const HEADER_SKIP = 45;             // continuation pages

// Source PDF + index cache (per request, so a single composition reuses I/O).
function makeCache() {
  return {
    pdfs: new Map(),     // `${paperNum}/${kind}/${stem}` → PDFDocument
    indexes: new Map(),  // `${paperNum}/${kind}` → Map<stem, {meta, byQ, questions}>
  };
}

async function loadIndex(cache, loader, paperNum, kind) {
  const key = `${paperNum}/${kind}`;
  if (cache.indexes.has(key)) return cache.indexes.get(key);

  const raw = await loader.loadIndex(paperNum, kind);

  const idx = new Map();
  for (const [stem, entry] of Object.entries(raw)) {
    const byQ = new Map();
    for (const q of entry.questions) byQ.set(q.q, q);
    idx.set(stem, { meta: entry.meta, byQ, questions: entry.questions });
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
  return pdf;
}

// The suffix in "P2-Q081" is a serial number (sorted-CSV index), NOT the
// question number within the paper. The in-paper question number lives in
// questions_metadata.question_number.
function parsePaperNum(id) {
  const m = id.match(/^P(\d+)-Q\d+$/);
  if (!m) throw new Error(`Invalid question id: ${id}`);
  return parseInt(m[1], 10);
}

// CSV "June-2014-1" + paperNum 2 → stem "June2014-21".
function makeStem(paperField, paperNum) {
  const parts = paperField.split('-');
  if (parts.length !== 3) {
    throw new Error(`Unexpected paper format: ${paperField}`);
  }
  const [month, year, tz] = parts;
  return `${month}${year}-${paperNum}${tz}`;
}

const MONTH_ORDER = { March: 0, June: 1, November: 2 };
function paperSortKey(meta) {
  return [meta.year, MONTH_ORDER[meta.month] ?? 99, meta.timezone];
}

// Crop spec computation — mirrors `_page_specs` in _build_topicals.py.
// Returns [{page, yTop, yBot}] in TOP-origin coordinates (PDF points from top).
function pageSpecs(qRecord, byQ, skippablePages, headroom) {
  const specs = [];
  const yStart = Math.max(0, qRecord.y_start - headroom);
  const yEnd = qRecord.y_end - headroom;
  specs.push({ page: qRecord.page, yTop: yStart, yBot: yEnd });

  if (qRecord.y_end !== BOTTOM_FOOTER_SENTINEL) return specs;

  const next = byQ.get(qRecord.q + 1);
  let cur = qRecord.page + 1;
  const guard = cur + 40;
  while (cur < guard) {
    if (next && cur === next.page) {
      const nextTop = Math.max(0, next.y_start - headroom);
      if (nextTop > HEADER_SKIP) {
        specs.push({ page: cur, yTop: HEADER_SKIP, yBot: nextTop });
      }
      return specs;
    }
    if (skippablePages.has(cur)) {
      cur += 1;
      continue;
    }
    if (!next) {
      specs.push({ page: cur, yTop: HEADER_SKIP, yBot: BOTTOM_FOOTER_SENTINEL });
      return specs;
    }
    specs.push({ page: cur, yTop: HEADER_SKIP, yBot: BOTTOM_FOOTER_SENTINEL });
    cur += 1;
  }
  return specs;
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

    const blockH = 36;
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

  async addCrop(srcDoc, pageIndex, yTopFromTop, yBotFromTop) {
    const srcPage = srcDoc.getPage(pageIndex);
    const srcW = srcPage.getWidth();
    const srcH = srcPage.getHeight();

    // Convert top-origin Y → pdf-lib bottom-origin Y.
    const pdfTop = srcH - yTopFromTop;
    const pdfBot = srcH - yBotFromTop;
    const cropH = pdfTop - pdfBot;
    if (cropH <= 0) return;

    const embedded = await this.out.embedPage(srcPage, {
      left: 0,
      bottom: pdfBot,
      right: srcW,
      top: pdfTop,
    });

    const scale = Math.min(1.0, CONTENT_W / srcW);
    const drawW = srcW * scale;
    const drawH = cropH * scale;

    if (this.page === null || this.cursor - drawH < CONTENT_BOTTOM) {
      this._newPage();
    }
    this._flushBanner();
    if (this.cursor - drawH < CONTENT_BOTTOM) {
      this._newPage();
    }

    const x = MARGIN + (CONTENT_W - drawW) / 2;
    const y = this.cursor - drawH;
    this.page.drawPage(embedded, { x, y, width: drawW, height: drawH });
    this.cursor = y - 8;
  }
}

async function renderSection(layout, cache, items, kind, loader) {
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
      qNums: qNums.sort((a, b) => a - b),
      entry,
    });
  }

  // Order paper sections by (year, month, timezone) — matches Phase 3.
  sections.sort((a, b) => {
    const ka = paperSortKey(a.entry.meta);
    const kb = paperSortKey(b.entry.meta);
    for (let i = 0; i < 3; i++) {
      if (ka[i] !== kb[i]) return ka[i] - kb[i];
    }
    return 0;
  });

  const headroom = kind === 'questions' ? FRACTION_HEADROOM : MS_HEADROOM;
  const skipKey = kind === 'questions' ? 'formula_pages' : 'preamble_pages';

  for (const { paperNum, stem, qNums, entry } of sections) {
    const meta = entry.meta;
    const label = `${meta.month} ${meta.year} — Paper ${meta.paper}${meta.timezone}`;
    layout.queueBanner(label, qNums);

    const skippable = new Set(meta[skipKey] ?? []);
    const srcDoc = await loadSourcePdf(cache, loader, paperNum, kind, stem);

    for (const q of qNums) {
      const record = entry.byQ.get(q);
      if (!record) {
        console.warn(`  ⚠️  Missing ${kind} record for ${stem} Q${q}`);
        continue;
      }
      const specs = pageSpecs(record, entry.byQ, skippable, headroom);
      for (const spec of specs) {
        const pageIdx = spec.page - 1;
        if (pageIdx < 0 || pageIdx >= srcDoc.getPageCount()) continue;
        await layout.addCrop(srcDoc, pageIdx, spec.yTop, spec.yBot);
      }
    }
  }
}

export async function composePdf(questionIds, includeMarkScheme = true, subject, loader) {
  if (!subject) throw new Error('composePdf requires a subject');
  if (!loader) throw new Error('composePdf requires a loader');
  console.log(`📦 Composing PDF for ${questionIds.length} questions (subject=${subject}, MS=${includeMarkScheme})`);

  const supabase = getSupabase();

  const { data: rows, error } = await supabase
    .from('questions_metadata')
    .select('id, paper, question_number')
    .eq('subject', subject)
    .in('id', questionIds);
  if (error) throw new Error(`Supabase fetch failed: ${error.message}`);
  if (!rows || rows.length === 0) throw new Error('No metadata found for selected questions');

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
  const outDoc = await PDFDocument.create();
  const font = await outDoc.embedFont(StandardFonts.Helvetica);
  const boldFont = await outDoc.embedFont(StandardFonts.HelveticaBold);
  const layout = new PageLayout(outDoc, font, boldFont);

  // Section 1 — Questions
  layout.sectionHeader('Questions');
  await renderSection(layout, cache, items, 'questions', loader);

  // Section 2 — Mark Scheme (only questions the mark-scheme index actually covers)
  let msCount = 0;
  if (includeMarkScheme) {
    // loadIndex memoizes into `cache.indexes` under the same keys renderSection
    // uses, so preloading here costs no extra I/O.
    const msIdxByPaper = new Map();
    for (const paperNum of new Set(items.map((it) => it.paperNum))) {
      msIdxByPaper.set(paperNum, await loadIndex(cache, loader, paperNum, 'mark_schemes'));
    }
    const msItems = items.filter((it) => {
      const entry = msIdxByPaper.get(it.paperNum).get(makeStem(it.paper, it.paperNum));
      return entry ? entry.byQ.has(it.qNum) : false;
    });
    if (msItems.length > 0) {
      layout.sectionHeader('Mark Scheme');
      await renderSection(layout, cache, msItems, 'mark_schemes', loader);
      msCount = msItems.length;
    }
  }

  const bytes = await outDoc.save();
  const pdfBase64 = Buffer.from(bytes).toString('base64');
  console.log(`✅ PDF composed: ${(bytes.length / 1024).toFixed(1)} KB, ${outDoc.getPageCount()} pages`);

  return {
    pdfBase64,
    metadata: {
      totalQuestions: items.length,
      totalMarkSchemes: msCount,
      totalPages: outDoc.getPageCount(),
      includeMarkScheme,
    },
  };
}
