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

import path from 'path';
import { fileURLToPath } from 'url';

// pdfjs-dist's legacy Node build has `const SCALE_MATRIX = new DOMMatrix();`
// at its own MODULE TOP LEVEL — so without a global DOMMatrix, importing
// pdfjs-dist throws immediately, before any of our code runs, and every
// later call reuses that same failure ("DOMMatrix is not defined" on every
// pageChars() call). That's what silently broke text-based blank-page
// detection in prod: regionHasContent/hasBlankPageBanner always threw,
// isEmptyContinuation's catch-all failed closed to "keep the crop", and a
// question's page group (0455 groups a stimulus with all its page crops as
// one unbreakable block) could include a full, untrimmed acknowledgements/
// "BLANK PAGE" page — which forces the whole group to shrink to fit one
// page, making the real question tiny next to blank space.
//
// pdfjs-dist tries to source DOMMatrix/ImageData/Path2D from @napi-rs/canvas,
// a native binary. Depending on that directly (even as an explicit, direct
// dependency — tried and confirmed still missing at runtime in prod) puts
// correctness at the mercy of Vercel's bundler tracing a native module
// through pdfjs-dist's own dynamic, try/catch-wrapped require. A pure-JS
// polyfill has no such dependency — it's not a separate file the bundler can
// fail to include.
//
// It only needs to be correct for what getTextContent() actually reaches:
// every OTHER DOMMatrix/Path2D use in pdfjs-dist (paintChar, showType3Text,
// pattern/gradient fills) lives in CanvasGraphics, the rendering path, which
// only runs from page.render() — never called anywhere in this codebase.
class DOMMatrixPolyfill {
  constructor(init) {
    this.a = 1;
    this.b = 0;
    this.c = 0;
    this.d = 1;
    this.e = 0;
    this.f = 0;
    if (Array.isArray(init)) {
      if (init.length === 6) [this.a, this.b, this.c, this.d, this.e, this.f] = init;
      else if (init.length === 16) {
        this.a = init[0];
        this.b = init[1];
        this.c = init[4];
        this.d = init[5];
        this.e = init[12];
        this.f = init[13];
      }
    } else if (init && typeof init === 'object') {
      this.a = init.a ?? 1;
      this.b = init.b ?? 0;
      this.c = init.c ?? 0;
      this.d = init.d ?? 1;
      this.e = init.e ?? 0;
      this.f = init.f ?? 0;
    }
  }
  multiplySelf(m) {
    const { a, b, c, d, e, f } = this;
    this.a = a * m.a + c * m.b;
    this.b = b * m.a + d * m.b;
    this.c = a * m.c + c * m.d;
    this.d = b * m.c + d * m.d;
    this.e = a * m.e + c * m.f + e;
    this.f = b * m.e + d * m.f + f;
    return this;
  }
  preMultiplySelf(m) {
    const result = new DOMMatrixPolyfill(m).multiplySelf(this);
    Object.assign(this, result);
    return this;
  }
  multiply(m) {
    return new DOMMatrixPolyfill(this).multiplySelf(m);
  }
  translateSelf(tx = 0, ty = 0) {
    return this.multiplySelf({ a: 1, b: 0, c: 0, d: 1, e: tx, f: ty });
  }
  translate(tx = 0, ty = 0) {
    return new DOMMatrixPolyfill(this).translateSelf(tx, ty);
  }
  scaleSelf(sx = 1, sy = sx) {
    return this.multiplySelf({ a: sx, b: 0, c: 0, d: sy, e: 0, f: 0 });
  }
  scale(sx = 1, sy = sx) {
    return new DOMMatrixPolyfill(this).scaleSelf(sx, sy);
  }
  invertSelf() {
    const { a, b, c, d, e, f } = this;
    const det = a * d - b * c;
    if (!det) {
      this.a = this.b = this.c = this.d = this.e = this.f = NaN;
      return this;
    }
    this.a = d / det;
    this.b = -b / det;
    this.c = -c / det;
    this.d = a / det;
    this.e = -(this.a * e + this.c * f);
    this.f = -(this.b * e + this.d * f);
    return this;
  }
  inverse() {
    return new DOMMatrixPolyfill(this).invertSelf();
  }
}

// Rendering-only in pdfjs-dist (canvas pixel buffers, clip-path geometry) —
// never read by getTextContent(), so a shape that just doesn't throw is enough.
class ImageDataPolyfill {
  constructor(dataOrWidth, widthOrHeight, height) {
    if (dataOrWidth instanceof Uint8ClampedArray) {
      this.data = dataOrWidth;
      this.width = widthOrHeight;
      this.height = height;
    } else {
      this.width = dataOrWidth;
      this.height = widthOrHeight;
      this.data = new Uint8ClampedArray(this.width * this.height * 4);
    }
  }
}
class Path2DPolyfill {
  addPath() {}
  moveTo() {}
  lineTo() {}
  bezierCurveTo() {}
  quadraticCurveTo() {}
  closePath() {}
  rect() {}
  arc() {}
  ellipse() {}
}

globalThis.DOMMatrix ??= DOMMatrixPolyfill;
globalThis.ImageData ??= ImageDataPolyfill;
globalThis.Path2D ??= Path2DPolyfill;

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
  const { Util } = await getPdfjs();
  const runs = [];
  const parts = [];
  for (const item of content.items) {
    const text = item.str.trim();
    const n = item.str.replace(/\s/g, '').length;
    if (!n) continue;
    // `item.transform` is in the page's raw content space; only
    // `viewport.transform` bakes in `/Rotate`. Composing the two (the same
    // thing pdf.js's own text layer does) is what makes this correct for a
    // rotated page — the 2018–2024 0625/0610 Paper 4 & 6 mark schemes are
    // `/Rotate 90`. The old `viewport.height − item.transform[5]` shortcut
    // only happens to work at rotation 0 (there it reduces to the same flip);
    // on a rotated page it read glyphs at nonsensical/negative y — verified
    // against June2018-41.pdf p5, where the repeated "Question | Answer |
    // Marks" header (Cambridge prints it around y≈70) came back around y≈535.
    const tx = Util.transform(viewport.transform, item.transform);
    const x = tx[4];
    const y = tx[5];
    const descender = Math.max(2, (item.height || 0) * 0.3);
    runs.push({ y, bottom: y + descender, n });
    if (text) {
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
