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
// would undercount a region and make a page with real content look blank, so it
// is resolved from the installed package rather than left to chance.
let fontDirUrl;
function standardFontDataUrl() {
  if (fontDirUrl === undefined) {
    try {
      const require = createRequire(import.meta.url);
      const pkg = require.resolve('pdfjs-dist/package.json');
      // Under Node this must be a filesystem path with a trailing separator —
      // pdf.js reads it from disk. A file:// URL fails to load.
      fontDirUrl = path.join(path.dirname(pkg), 'standard_fonts') + path.sep;
    } catch {
      fontDirUrl = null;
    }
  }
  return fontDirUrl;
}

// `getDocument({data})` TRANSFERS the buffer and leaves the original detached —
// the same trap mock-space documents. compose-pdf.js hands these bytes to
// pdf-lib as well, so always give pdf.js a copy.
async function openDoc(bytes) {
  const pdfjs = await getPdfjs();
  const copy = new Uint8Array(bytes.length);
  copy.set(bytes);
  const fonts = standardFontDataUrl();
  return pdfjs.getDocument({
    data: copy,
    isEvalSupported: false,
    ...(fonts ? { standardFontDataUrl: fonts } : {}),
  }).promise;
}

// Text runs on a page, in top-origin points: `y` is the baseline (what the
// reference filters on), `bottom` approximates the glyph box's lower edge so a
// crop trimmed to it does not clip descenders, and `n` is the character count.
async function pageRuns(doc, pageNum) {
  const page = await doc.getPage(pageNum);
  const viewport = page.getViewport({ scale: 1 });
  const content = await page.getTextContent();
  const runs = [];
  for (const item of content.items) {
    const n = item.str.replace(/\s/g, '').length;
    if (!n) continue;
    const y = viewport.height - item.transform[5];
    const descender = Math.max(2, (item.height || 0) * 0.3);
    runs.push({ y, bottom: y + descender, n });
  }
  return { runs, height: viewport.height };
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
