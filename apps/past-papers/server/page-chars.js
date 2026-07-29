// Glyph positions for one source page, used to answer "does this crop region
// hold any actual content?".
//
// This is the JS half of `has_content` in _build_topicals.py, which counts the
// characters whose vertical midpoint falls inside the crop band and treats a
// region with too few as blank. pdf-lib has no text layer, so the count comes
// from pdf.js — the same engine mock-space already relies on.
//
// Only pages reached by a *continuation* crop are ever parsed, so on a typical
// composition this touches a small fraction of the source pages.

import { createRequire } from 'module';
import path from 'path';
import { fileURLToPath } from 'url';

// pdf.js's legacy Node build needs `DOMMatrix`/`ImageData`/`Path2D` for some
// embedded-font glyph handling inside getTextContent() itself, not just for
// actual rendering. It tries to polyfill them from `@napi-rs/canvas` — but
// only as ITS OWN internal optional dependency, reached through a require()
// buried inside a try/catch several layers deep in pdfjs-dist's own code.
// That's exactly the shape of dependency serverless bundlers are known to
// drop (there is no static import for them to trace), and that's what
// happened here: the package was silently missing at runtime, every
// getTextContent() call threw `DOMMatrix is not defined`, and every text-based
// blank-page check (regionHasContent, hasBlankPageBanner) silently failed
// closed to "keep the crop" — so pages that should have been dropped as empty
// were kept, full page height, and grouped-crop questions (0455) shrank to fit
// them, making real content look tiny next to blank space.
//
// Depending on it directly here — a plain top-level dependency behind a single
// require(), same shape as e.g. `sharp` on Vercel — is a dependency bundlers
// reliably trace. Setting these globals before pdfjs-dist's own internal
// check (`if (!globalThis.DOMMatrix) { ... }`) means it sees them already
// defined and never needs its own fragile fallback at all.
try {
  const require = createRequire(import.meta.url);
  const canvas = require('@napi-rs/canvas');
  globalThis.DOMMatrix ??= canvas.DOMMatrix;
  globalThis.ImageData ??= canvas.ImageData;
  globalThis.Path2D ??= canvas.Path2D;
} catch {
  // Falls through to pdfjs-dist's own attempt, which warns and degrades the
  // same way this codebase has always tolerated a missing text layer.
}

// pdf.js ships an ESM build that expects a browser; the legacy build is the one
// that runs under Node (and inside a Vercel function).
let pdfjsPromise;
function getPdfjs() {
  pdfjsPromise ??= import('pdfjs-dist/legacy/build/pdf.mjs');
  return pdfjsPromise;
}

// Without this pdf.js raises "Ensure that the `standardFontDataUrl` API
// parameter is provided" for any PDF relying on one of the 14 standard fonts,
// and the glyphs of the affected runs go missing from getTextContent(). That
// would undercount a region and make a page with real content look blank.
//
// This used to resolve pdfjs-dist's own standard_fonts/ via require.resolve,
// but that directory is only ever reached dynamically (never a static
// import), which Vercel's function bundler can't trace — the files silently
// didn't make it into the deployed function. Forcing them in via
// vercel.json's includeFiles then failed a different way: pnpm installs
// pdfjs-dist as a symlink, and copying through a symlinked path during the
// build produced `ENOTDIR: not a directory, mkdir '.../node_modules/pdfjs-dist'`.
// Vendoring the (14-font, ~800KB, effectively-static) directory straight into
// this package sidesteps both problems — it's a plain path relative to this
// file, no node_modules resolution or symlink involved.
const fontDirUrl =
  path.join(path.dirname(fileURLToPath(import.meta.url)), 'pdfjs-standard-fonts') + path.sep;

// `getDocument({data})` TRANSFERS the buffer and leaves the original detached —
// the same trap mock-space documents. compose-pdf.js hands these bytes to
// pdf-lib as well, so always give pdf.js a copy.
async function openDoc(bytes) {
  const pdfjs = await getPdfjs();
  const copy = new Uint8Array(bytes.length);
  copy.set(bytes);
  return pdfjs.getDocument({
    data: copy,
    isEvalSupported: false,
    standardFontDataUrl: fontDirUrl,
  }).promise;
}

// Text runs on a page, in top-origin points: `y` is the baseline (what the
// reference filters on), `bottom` approximates the glyph box's lower edge so a
// crop trimmed to it does not clip descenders, and `n` is the character count.
//
// `lines` groups the same items by baseline (pdf.js sometimes splits one
// printed line across multiple items) and keeps their text + horizontal
// center, which plain char-counting throws away — needed to recognize the
// literal "BLANK PAGE" banner (see hasBlankPageBanner).
async function pageRuns(doc, pageNum) {
  const page = await doc.getPage(pageNum);
  const viewport = page.getViewport({ scale: 1 });
  const content = await page.getTextContent();
  const runs = [];
  const parts = [];
  for (const item of content.items) {
    const text = item.str.trim();
    const n = item.str.replace(/\s/g, '').length;
    if (!n) continue;
    const y = viewport.height - item.transform[5];
    const descender = Math.max(2, (item.height || 0) * 0.3);
    runs.push({ y, bottom: y + descender, n });
    if (text) {
      const x = item.transform[4];
      parts.push({ y, x, xEnd: x + (item.width || 0), text });
    }
  }
  return { runs, lines: mergeLines(parts), height: viewport.height, width: viewport.width };
}

// Groups text items sitting on the same baseline (within LINE_TOL) into one
// logical line, ordered left-to-right, so a banner split across items (e.g.
// "BLANK" and "PAGE" drawn as separate runs) still reads as one string.
const LINE_TOL = 2;
export function mergeLines(parts) {
  const lines = [];
  for (const part of parts) {
    const line = lines.find((l) => Math.abs(l.y - part.y) <= LINE_TOL);
    if (line) line.parts.push(part);
    else lines.push({ y: part.y, parts: [part] });
  }
  return lines.map(({ y, parts: lineParts }) => {
    const ordered = [...lineParts].sort((a, b) => a.x - b.x);
    return {
      y,
      text: ordered
        .map((p) => p.text)
        .join(' ')
        .replace(/\s+/g, ' ')
        .trim(),
      xCenter: (Math.min(...ordered.map((p) => p.x)) + Math.max(...ordered.map((p) => p.xEnd))) / 2,
    };
  });
}

// One entry per source PDF; pages are parsed on first use.
export function createCharIndex() {
  const docs = new Map();  // key -> { doc, pages: Map<pageNum, {ys, height}> }

  return {
    async pageChars(key, bytes, pageNum) {
      let entry = docs.get(key);
      if (!entry) {
        entry = { doc: await openDoc(bytes), pages: new Map() };
        docs.set(key, entry);
      }
      if (entry.pages.has(pageNum)) return entry.pages.get(pageNum);
      const result =
        pageNum >= 1 && pageNum <= entry.doc.numPages
          ? await pageRuns(entry.doc, pageNum)
          : { runs: [], height: 0 };
      entry.pages.set(pageNum, result);
      return result;
    },
  };
}

// Mirrors `has_content`: count glyphs inside the band, ignoring the header strip
// at the top and the footer strip at the bottom, and call the region blank below
// `minChars`. Returns true when the region carries real content.
export function regionHasContent(
  { runs, height },
  yTop,
  yBot,
  { headerSkip, footerSkip, minChars },
) {
  const regionTop = Math.max(0, yTop);
  const regionBot = yBot === null ? height : Math.min(height, yBot);
  const testTop = Math.max(regionTop, headerSkip);
  const testBot = Math.min(regionBot, height - footerSkip);
  if (testTop >= testBot) return false;

  let count = 0;
  for (const run of runs) {
    if (run.y >= testTop && run.y <= testBot) {
      count += run.n;
      if (count >= minChars) return true;
    }
  }
  return false;
}

// A literal "BLANK PAGE" banner, printed top-center on the physical filler
// pages Cambridge inserts between real content. This is a stronger signal than
// isBlankPage's byte-stream size or regionHasContent's char count — both are
// proxies for "this page carries no real content," but "BLANK PAGE" itself is
// 9 non-whitespace characters, so a filler page whose content stream happens
// to land above the byte threshold would otherwise clear MIN_CONTENT_CHARS on
// the strength of the banner text alone. Reading the phrase directly closes
// that gap instead of tuning the proxies further.
const BLANK_PAGE_TOP_ZONE = 150;     // banner sits well above any body text
const BLANK_PAGE_CENTER_TOL = 0.15;  // fraction of page width either side of center

export function hasBlankPageBanner({ lines, width }) {
  const centerX = width / 2;
  const tol = width * BLANK_PAGE_CENTER_TOL;
  return lines.some(
    (line) =>
      line.y <= BLANK_PAGE_TOP_ZONE &&
      line.text.toUpperCase() === 'BLANK PAGE' &&
      Math.abs(line.xCenter - centerX) <= tol,
  );
}

// `tighten_bottom` from _build_topicals.py: pull a crop's lower bound up to the
// last line of real content.
//
// A record that is the last on its page carries the sentinel, so its crop runs
// to the physical bottom of the page — dragging in the blank remainder and the
// © UCLES footer. That is what makes a near-empty page occupy a whole output
// page: the "BLANK PAGE" separator and the closing acknowledgements block both
// hold enough characters to pass the content test, so only trimming keeps them
// from spreading over a full page. Returns `yBot` unchanged when the region
// holds no text.
export function tightenBottom({ runs, height }, yTop, yBot, { footerSkip, pad }) {
  const hardBottom = yBot === null ? height : Math.min(height, yBot);
  const cap = Math.min(hardBottom, height - footerSkip);

  let deepest = null;
  for (const run of runs) {
    if (run.y >= yTop && run.y <= cap) {
      if (deepest === null || run.bottom > deepest) deepest = run.bottom;
    }
  }
  if (deepest === null) return yBot;
  return Math.min(hardBottom, deepest + pad);
}
