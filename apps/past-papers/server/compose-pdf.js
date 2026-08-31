import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  PDFDocument,
  PDFArray,
  PDFDict,
  PDFName,
  PDFRawStream,
  StandardFonts,
  decodePDFRawStream,
  rgb,
  degrees,
} from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';
import { createClient } from '@supabase/supabase-js';
import { fetchRowsByIds } from './supabase-rows.js';
import {
  createCharIndex,
  regionHasContent,
  tightenBottom,
  hasBlankPageBanner,
  marksInRegion,
} from './page-chars.js';
import { answerInRegion } from './mcqAnswers.js';

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
export const CONTENT_TOP = PAGE_H - MARGIN;
const CONTENT_BOTTOM = MARGIN;

// Brand mark on every composed page. It sits in the free top margin band —
// everything the layout draws starts at CONTENT_TOP and works down — so adding
// it reflows nothing. Just the wordmark + domain: the composed pages carry
// Cambridge's own © footer and a copyright line would be wrong on both counts.
// Color is the suite's own primary indigo/blue token (--primary in
// packages/ui/src/tokens.css, #4F46E5), so the PDF reads as the same brand as
// the site rather than an arbitrary blue.
export const BRAND_HEADER = {
  text: 'Scholium at thescholium.com',
  x: MARGIN,
  y: PAGE_H - 24,
  size: 14,
  color: rgb(0x4f / 255, 0x46 / 255, 0xe5 / 255),
};

// Poppins is vendored locally under server/fonts/ (downloaded from Google
// Fonts' OFL-licensed source — see fonts/LICENSE_POPPINS) instead of pulled
// from a CDN at request time, the same reasoning as server/pdfjs-standard-
// fonts: this composer runs in a serverless function and dev server alike,
// and neither should depend on a third-party host being reachable just to
// stamp a page.
const FONTS_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), 'fonts');

// Read once per process and reused across composePdf() calls — the file never
// changes at runtime, so re-reading it from disk on every request is wasted
// I/O on a hot function.
let brandFontBytesPromise;
function loadBrandFontBytes() {
  return (brandFontBytesPromise ??= fs.readFile(path.join(FONTS_DIR, 'Poppins-Bold.ttf')));
}

export async function embedBrandFont(doc) {
  doc.registerFontkit(fontkit);
  return doc.embedFont(await loadBrandFontBytes(), { subset: true });
}

// Phase 3 crop knobs (see BUILD.md → Stage 3, Stage 5).
const MIN_CROP_HEIGHT = 20;         // floor every pipeline applies
const INTRA_GROUP_GAP = 4;          // between a stimulus and its sub-part
const BANNER_BLOCK_H = 36;          // inline paper banner (label + q list + rule)
const TOTAL_BLOCK_H = 46;           // centred "Total: N marks" block (rule + text + rule)
const HEADER_ZONE = 45;             // page number / paper code / © line live above this
// Mark-scheme continuation pages repeat the "Question | Answer | Marks" column
// header at their own top (BUILD.md's `spillover_header_skip`, ~y 70 in the
// corpus) — well below HEADER_ZONE, so isEmptyContinuation would otherwise
// count that header as real content and keep an otherwise-empty page. Applies
// only to mark_schemes continuations; the question pipeline has no such
// repeating header and keeps using HEADER_ZONE.
const MS_HEADER_ZONE = 95;
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
  // Ported from the 0625 pipeline (see 0610's BUILD.md) with identical geometry
  // constants — BOTTOM_FOOTER_SENTINEL, MARKER_HEADROOM, and no stem_specs.
  '0610': {
    sentinel: 720.0,
    questions: { top: 8, bottom: 8 },   // MARKER_HEADROOM
    markSchemes: { top: 2, bottom: 2 },
    hasStems: false,
  },
  // Same pipeline as 0625/0610 — verified against Chemistry's own
  // _build_topicals.py (BOTTOM_FOOTER_SENTINEL = 720.0, MARKER_HEADROOM = 8.0).
  '0620': {
    sentinel: 720.0,
    questions: { top: 8, bottom: 8 },   // MARKER_HEADROOM
    markSchemes: { top: 2, bottom: 2 },
    hasStems: false,
  },
};

export function geometryFor(subject) {
  return SUBJECT_GEOMETRY[subject] ?? DEFAULT_GEOMETRY;
}

// Components whose questions are multiple-choice — verified against the live
// R2 corpus (May/June 2018 mark schemes), not guessed from the syllabus: for
// each entry below, every question's mark-scheme row reads "<label> <letter>
// <marks>" (e.g. "1 A 1"), the shape answerInRegion looks for. The sciences
// (0610/0620/0625) index only their Extended-tier components in this corpus —
// Paper 2 (MCQ), Paper 4 (Theory) and Paper 6 (Alternative to Practical) —
// there is no indexed Paper 1/3/5 Core tier to include. 0455 Economics
// indexes both Paper 1 and Paper 2; only Paper 1 is MCQ, Paper 2 is
// structured. 0478, 0606 and 0607 have no MCQ component in the corpus at all.
//
// Extraction below is still the authority, not this map: getting an entry
// wrong here only means a real MCQ paper composes as an ordinary one (or vice
// versa gets probed and silently falls back) — see extractMcqAnswers.
const MCQ_COMPONENTS = {
  '0455': [1], // Economics — Paper 1
  '0610': [2], // Biology — Paper 2
  '0620': [2], // Chemistry — Paper 2
  '0625': [2], // Physics — Paper 2
};

export function isMcqComponent(subject, paperNum) {
  return (MCQ_COMPONENTS[subject] ?? []).includes(paperNum);
}

// Mirrors SUBJECT_DISPLAY_NAMES in src/lib/papers.ts — that copy is what the
// browse UI shows, this one titles the composed PDF itself, and the two need
// to move together when a subject is added.
const SUBJECT_DISPLAY_NAMES = {
  '0455': 'Economics',
  '0478': 'Computer Science',
  '0580': 'Mathematics',
  '0606': 'Additional Mathematics',
  '0607': 'International Mathematics',
  '0610': 'Biology',
  '0620': 'Chemistry',
  '0625': 'Physics',
};

export function subjectDisplayName(code) {
  return SUBJECT_DISPLAY_NAMES[code] ?? code;
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
    streamLines: new Map(), // PDFDocument → Map<pageIndex, {lines, height}> (marks, no pdf.js)
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

// --- Mark-token extraction, read straight off the raw content stream -------
//
// pdf.js's getTextContent() has repeatedly proven unreliable in the Vercel
// serverless runtime for this app — three separate fixes (vendoring
// pdfjs-dist's standard fonts in 6e87153, dropping @napi-rs/canvas for a pure
// DOMMatrix polyfill in 96381f1/d8a1b55) still left it failing in prod while
// working perfectly locally, which is why 7b5e419 stopped depending on it for
// blank-page detection (pageHasBlankPageText, above) and reads the raw stream
// instead. The "[n]" mark allocation is the same kind of literal ASCII text —
// Cambridge draws it as one self-contained string per part (`( [1] )Tj`), not
// split across a kerned TJ array (verified against the corpus) — so it reads
// the same way pageHasBlankPageText does, with one addition: this needs the
// token's Y position, not just a yes/no match, to know which question's crop
// it falls inside. That means tracking the text line matrix through
// Tm/Td/TD/T*, the same composition every PDF viewer performs, rather than
// just concatenating literals.
//
// Verified against the corpus: Cambridge's content streams never wrap page
// text in a non-identity `cm` (CTM) — `cm` only ever appears around answer-box
// tick images (`q ... cm /ImN Do Q`), never around a BT/ET block — so page
// user space can be treated as text space directly.

// PDF matrix composition in the row-vector convention the spec itself uses to
// define Td: "Tlm = [1 0 0 1 tx ty] × Tlm". `a` is applied first, then `b`.
function composeMatrix(a, b) {
  return [
    a[0] * b[0] + a[1] * b[2],
    a[0] * b[1] + a[1] * b[3],
    a[2] * b[0] + a[3] * b[2],
    a[2] * b[1] + a[3] * b[3],
    a[4] * b[0] + a[5] * b[2] + b[4],
    a[4] * b[1] + a[5] * b[3] + b[5],
  ];
}

const IDENTITY_MATRIX = [1, 0, 0, 1, 0, 0];

// A minimal content-stream tokenizer — just enough of the PDF operator
// grammar to walk text-positioning and text-showing operators without
// mistaking operands inside a `[...]` TJ array or a `(...)` string literal
// for operators. Everything this doesn't specifically need (images, paths,
// color, graphics state) still tokenizes correctly as opaque operators or
// operands; the interpreter below simply ignores any operator it doesn't
// recognize, discarding whatever operands preceded it — exactly how a real
// content-stream interpreter treats operators it consumes but doesn't act on.
export function tokenizeContentStream(stream) {
  const tokens = [];
  const n = stream.length;
  let i = 0;

  while (i < n) {
    const c = stream[i];

    if (c === '%') {
      while (i < n && stream[i] !== '\n' && stream[i] !== '\r') i++;
      continue;
    }
    if (c === ' ' || c === '\t' || c === '\r' || c === '\n' || c === '\f' || c === '\0') {
      i++;
      continue;
    }
    if (c === '(') {
      // Balanced, escape-aware string literal. PDF string escapes: \n \r \t
      // \b \f map to their control character, \( \) \\ map to the literal
      // char (and — crucially — do NOT affect paren-depth balancing), a
      // trailing \<EOL> is a line-continuation (no character emitted), and
      // \ddd is a 1–3 digit octal character code. Getting this escape
      // handling right is what keeps a "©" (`\251`) in a footer from
      // desyncing the whole rest of the tokenizer.
      let depth = 1;
      let j = i + 1;
      let buf = '';
      while (j < n && depth > 0) {
        const ch = stream[j];
        if (ch === '\\') {
          const next = stream[j + 1];
          if (next === undefined) {
            j++;
            continue;
          }
          if (next >= '0' && next <= '7') {
            let oct = next;
            let k = j + 2;
            for (let count = 0; count < 2 && stream[k] >= '0' && stream[k] <= '7'; count++, k++) {
              oct += stream[k];
            }
            buf += String.fromCharCode(parseInt(oct, 8) & 0xff);
            j = k;
            continue;
          }
          if (next === '\n') {
            j += 2;
            continue;
          }
          if (next === '\r') {
            j += stream[j + 2] === '\n' ? 3 : 2;
            continue;
          }
          const escapeMap = { n: '\n', r: '\r', t: '\t', b: '\b', f: '\f' };
          buf += escapeMap[next] ?? next;
          j += 2;
          continue;
        }
        if (ch === '(') {
          depth++;
          buf += ch;
          j++;
          continue;
        }
        if (ch === ')') {
          depth--;
          j++;
          if (depth > 0) buf += ch;
          continue;
        }
        buf += ch;
        j++;
      }
      tokens.push({ type: 'str', value: buf });
      i = j;
      continue;
    }
    if (c === '<') {
      if (stream[i + 1] === '<') {
        // Inline dict (e.g. a BDC property list) — skip the balanced pair,
        // no text ever lives inside one.
        let depth = 1;
        let j = i + 2;
        while (j < n && depth > 0) {
          if (stream[j] === '<' && stream[j + 1] === '<') {
            depth++;
            j += 2;
            continue;
          }
          if (stream[j] === '>' && stream[j + 1] === '>') {
            depth--;
            j += 2;
            continue;
          }
          j++;
        }
        i = j;
        continue;
      }
      // Hex string. Some pages show text with `<0003>Tj` instead of a
      // parenthesized literal (verified against the corpus — 0620 Paper 4
      // June2018-41.pdf draws marks tokens exactly this way), so this must
      // decode to the same raw-byte representation `(...)` strings do — an
      // odd digit count pads a trailing 0 per the PDF spec — and come out as
      // an ordinary `str` token so every downstream consumer (showOperand,
      // decodeShownBytes) needs no separate hex-string path at all.
      let j = i + 1;
      while (j < n && stream[j] !== '>') j++;
      let hex = stream.slice(i + 1, j).replace(/\s+/g, '');
      if (hex.length % 2 !== 0) hex += '0';
      let bytes = '';
      for (let k = 0; k < hex.length; k += 2) {
        bytes += String.fromCharCode(parseInt(hex.slice(k, k + 2), 16) || 0);
      }
      tokens.push({ type: 'str', value: bytes });
      i = j + 1;
      continue;
    }
    if (c === '[') {
      tokens.push({ type: 'arrstart' });
      i++;
      continue;
    }
    if (c === ']') {
      tokens.push({ type: 'arrend' });
      i++;
      continue;
    }
    if (c === '/') {
      let j = i + 1;
      while (j < n && !/[\s()<>[\]{}/%]/.test(stream[j])) j++;
      tokens.push({ type: 'name', value: stream.slice(i, j) });
      i = j;
      continue;
    }
    if (c === '{' || c === '}') {
      i++; // PostScript calculator functions — not used in content streams.
      continue;
    }
    if (c === '-' || c === '+' || c === '.' || (c >= '0' && c <= '9')) {
      let j = i + 1;
      while (j < n && /[-+.0-9eE]/.test(stream[j])) j++;
      const num = parseFloat(stream.slice(i, j));
      tokens.push({ type: 'num', value: Number.isFinite(num) ? num : 0 });
      i = j;
      continue;
    }
    if (c === "'" || c === '"') {
      tokens.push({ type: 'op', value: c });
      i++;
      continue;
    }
    if (/[A-Za-z*]/.test(c)) {
      let j = i + 1;
      while (j < n && /[A-Za-z0-9*]/.test(stream[j])) j++;
      tokens.push({ type: 'op', value: stream.slice(i, j) });
      i = j;
      continue;
    }
    i++; // stray byte between tokens — skip rather than risk misreading it as one.
  }

  return tokens;
}

// A run of text shown by a composite (Type0) font is not ASCII bytes — it's a
// sequence of 2-byte CIDs (glyph indices), meaningless without that specific
// font's own `/ToUnicode` CMap. Verified against the corpus: 0607 Paper 4
// draws a question's own "[2]" mark allocation through exactly such a font
// (`/C2_0`, `[(\000>\000\025\000@)] TJ`) — the bytes 0x003E/0x0015/0x0040 are
// not '[' '2' ']' in any byte encoding; only that font's ToUnicode CMap says
// so. `beginbfchar`/`beginbfrange` is a small, fully self-contained format
// (PDF spec §9.10.3) — no font-program parsing needed, just this text block.
export function parseToUnicodeCMap(cmapText) {
  const map = new Map();
  const hexToCode = (hex) => parseInt(hex, 16);
  // A `dst` is hex-encoded UTF-16BE; almost always one BMP code point (4 hex
  // digits) for the glyphs a mark token is drawn with, but decode in general.
  const hexToText = (hex) => {
    let text = '';
    for (let i = 0; i + 4 <= hex.length; i += 4) {
      text += String.fromCharCode(parseInt(hex.slice(i, i + 4), 16));
    }
    return text;
  };

  for (const block of cmapText.matchAll(/beginbfchar([\s\S]*?)endbfchar/g)) {
    for (const m of block[1].matchAll(/<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]+)>/g)) {
      map.set(hexToCode(m[1]), hexToText(m[2]));
    }
  }

  for (const block of cmapText.matchAll(/beginbfrange([\s\S]*?)endbfrange/g)) {
    // One pass handling both range forms — <lo> <hi> [<d0> <d1> ...] (explicit
    // per-code destinations) and <lo> <hi> <dst> (dst increments per code) —
    // as alternatives of the same match, so the array form's own bracketed
    // <..> entries are consumed as part of that match and never separately
    // misread as the start of a <lo> <hi> <dst> triple.
    const re = /<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]+)>\s*(?:\[([\s\S]*?)\]|<([0-9A-Fa-f]+)>)/g;
    for (const m of block[1].matchAll(re)) {
      const lo = hexToCode(m[1]);
      if (m[3] !== undefined) {
        const items = [...m[3].matchAll(/<([0-9A-Fa-f]+)>/g)].map((x) => hexToText(x[1]));
        items.forEach((text, i) => map.set(lo + i, text));
      } else {
        const hi = hexToCode(m[2]);
        const dstCode = hexToCode(m[4]);
        for (let c = lo; c <= hi; c++) map.set(c, String.fromCharCode(dstCode + (c - lo)));
      }
    }
  }

  return map;
}

// Decodes one shown string's raw bytes into text, given what's known about the
// font that drew it. A simple font (Type1/TrueType/Type3 — everything this
// corpus uses outside the occasional composite math/symbol run) is one byte
// per character and those bytes are already the right Latin-1/ASCII codes for
// every character a mark token or its surrounding words use — verified
// against 7 of 8 sampled subjects matching their official totals exactly with
// no decoding at all. A composite (Type0) font is 2-byte CIDs that only its
// own ToUnicode map can resolve; a code with no entry contributes nothing
// (never a guess).
function decodeShownBytes(rawBytes, fontInfo) {
  if (!fontInfo || !fontInfo.composite) return rawBytes;
  if (!fontInfo.toUnicode) return '';
  let text = '';
  for (let i = 0; i + 1 < rawBytes.length; i += 2) {
    const code = (rawBytes.charCodeAt(i) << 8) | rawBytes.charCodeAt(i + 1);
    text += fontInfo.toUnicode.get(code) ?? '';
  }
  return text;
}

// A Form XObject can invoke another Form XObject; guard against a cyclic or
// pathologically deep reference chain (never observed in the corpus, but this
// is untrusted-ish PDF structure) rather than recursing without bound.
const MAX_XOBJECT_DEPTH = 8;

// Interprets the text-positioning/showing subset of the operator stream, plus
// enough of the graphics-state subset (q/Q/cm/Do) to follow a page's content
// out into any Form XObjects it invokes, to recover each show-text
// operation's line in TOP-origin points (matching every other y-coordinate
// this composer works with — see pageSpecs).
//
// Every position is read as the `f` component of Tm∘CTM — the mapping of the
// text-space origin through both the current text matrix AND the current
// graphics-state transform. Tracking CTM at all (via q/Q/cm) exists for one
// reason: Cambridge's newest export pipeline (November 2025 papers, verified
// against the corpus) wraps a page's entire real content in one Form XObject
// invoked via `cm ... /R Do` — a flat page-content-stream reader sees nothing
// but that one `Do` call and reports zero marks on an otherwise normal paper.
// Recursing into that XObject needs its invocation's CTM (and its own
// `/Matrix`) composed in, or text drawn inside would be positioned as if the
// XObject were never transformed at all.
//
// `opts.resolveFont(name)` — optional — looks up `{composite, toUnicode}` for
// a font named by `Tf` (see decodeShownBytes). `opts.resolveXObject(name)` —
// optional — looks up `{subtype, content, matrix, resolveFont,
// resolveXObject}` for a name used by `Do`; only `subtype === 'Form'` is
// followed (an Image XObject carries no text). Omitting either treats that
// operator as a no-op, which is what every test predating XObject support
// exercises and keeps this function's behavior unchanged without them.
//
// Returns one *unmerged* part per show-text operation — `{x, y, text}`, in
// TOP-origin points. Grouping same-baseline parts into logical lines is a
// separate step (see mergeMarkParts) done once, after XObject recursion has
// flattened everything for the whole page: Cambridge's own generator
// routinely splits a single printed run across several Tj/TJ calls with zero
// actual gap between them (a bracket in one font, a digit in another; a
// kerning nudge that happens to have ty=0) — verified against the corpus,
// e.g. 0620 Paper 4's own "[3]" mark allocation is drawn as two adjacent
// calls, "[" then "3]" — so nothing about *this* function's job (walking
// operators, tracking state) should also be deciding where a "line" ends.
export function partsFromContentStreamTokens(tokens, height, opts = {}) {
  const { resolveFont, resolveXObject, ctm: initialCtm = IDENTITY_MATRIX, depth = 0 } = opts;
  const parts = [];
  let tlm = IDENTITY_MATRIX;
  let ctm = initialCtm;
  let currentFont = null;
  // Font selection (Tf) is a graphics-state parameter, not a text-object one —
  // it is saved/restored by q/Q exactly like CTM (PDF spec §8.4, §9.3). Real
  // corpus bug this fixes: a q…Tf…Q block that only ever *temporarily*
  // switches font (a superscript/subscript run in a different size, say) was
  // leaking its font selection past the Q, so a mark token shown afterward
  // with no intervening Tf of its own was decoded under the wrong font
  // entirely — silently producing garbage instead of "[3]".
  const gStateStack = [];
  let leading = 0;
  const operands = [];

  const numAt = (offsetFromEnd) => {
    const t = operands[operands.length + offsetFromEnd];
    return t && t.type === 'num' ? t.value : 0;
  };
  const currentPoint = () => {
    const m = composeMatrix(tlm, ctm);
    return { x: m[4], y: height - m[5] };
  };
  const moveTo = (tx, ty) => {
    tlm = composeMatrix([1, 0, 0, 1, tx, ty], tlm);
  };
  const showString = (rawBytes) => {
    const fontInfo = resolveFont && currentFont ? resolveFont(currentFont) : null;
    const text = decodeShownBytes(rawBytes, fontInfo);
    // An empty decode happens for a genuinely empty PDF string and for a
    // composite-font run with no ToUnicode entry for its code(s) — neither
    // carries anything marksInRegion could match.
    if (!text) return;
    const { x, y } = currentPoint();
    parts.push({ x, y, text });
  };

  for (const tok of tokens) {
    if (tok.type === 'num' || tok.type === 'str' || tok.type === 'name') {
      operands.push(tok);
      continue;
    }
    if (tok.type === 'arrstart') {
      operands.push({ type: 'arrstart' });
      continue;
    }
    if (tok.type === 'arrend') {
      const items = [];
      let x = operands.pop();
      while (x && x.type !== 'arrstart') {
        items.unshift(x);
        x = operands.pop();
      }
      operands.push({ type: 'arr', items });
      continue;
    }
    if (tok.type !== 'op') continue;

    switch (tok.value) {
      case 'q':
        gStateStack.push({ ctm, font: currentFont });
        break;
      case 'Q':
        if (gStateStack.length) {
          const restored = gStateStack.pop();
          ctm = restored.ctm;
          currentFont = restored.font;
        }
        break;
      case 'cm': {
        const m = [numAt(-6), numAt(-5), numAt(-4), numAt(-3), numAt(-2), numAt(-1)];
        ctm = composeMatrix(m, ctm);
        break;
      }
      case 'Do': {
        const nameTok = operands[operands.length - 1];
        if (nameTok?.type === 'name' && resolveXObject && depth < MAX_XOBJECT_DEPTH) {
          const xobj = resolveXObject(nameTok.value.slice(1));
          if (xobj?.subtype === 'Form') {
            const childCtm = composeMatrix(xobj.matrix ?? IDENTITY_MATRIX, ctm);
            const childParts = partsFromContentStreamTokens(
              tokenizeContentStream(xobj.content),
              height,
              {
                resolveFont: xobj.resolveFont,
                resolveXObject: xobj.resolveXObject,
                ctm: childCtm,
                depth: depth + 1,
              },
            );
            parts.push(...childParts);
          }
        }
        break;
      }
      case 'BT':
        tlm = IDENTITY_MATRIX;
        leading = 0;
        break;
      case 'Td':
        moveTo(numAt(-2), numAt(-1));
        break;
      case 'TD':
        leading = -numAt(-1);
        moveTo(numAt(-2), numAt(-1));
        break;
      case 'Tm':
        tlm = [numAt(-6), numAt(-5), numAt(-4), numAt(-3), numAt(-2), numAt(-1)];
        break;
      case 'T*':
        moveTo(0, -leading);
        break;
      case 'TL':
        leading = numAt(-1);
        break;
      case 'Tf': {
        const nameTok = operands[operands.length - 2];
        if (nameTok && nameTok.type === 'name') currentFont = nameTok.value.slice(1);
        break;
      }
      case 'Tj': {
        const s = operands[operands.length - 1];
        if (s && s.type === 'str') showString(s.value);
        break;
      }
      case "'": {
        // Move-to-next-line-then-show, per the spec definition of `'`.
        moveTo(0, -leading);
        const s = operands[operands.length - 1];
        if (s && s.type === 'str') showString(s.value);
        break;
      }
      case '"': {
        // `aw ac string "` — same move as `'`; the leading two operands are
        // word/char spacing, irrelevant to position.
        moveTo(0, -leading);
        const s = operands[operands.length - 1];
        if (s && s.type === 'str') showString(s.value);
        break;
      }
      case 'TJ': {
        const arr = operands[operands.length - 1];
        if (arr && arr.type === 'arr') {
          for (const item of arr.items) {
            if (item.type === 'str') showString(item.value);
          }
        }
        break;
      }
      default:
        break;
    }
    operands.length = 0;
  }

  return parts;
}

// Groups same-baseline parts into one line, ordered left-to-right, joined
// with NO separator — deliberately unlike page-chars.js's mergeLines, which
// joins with a space (right for reassembling a word-boundary banner like
// "BLANK PAGE" out of separate items). Cambridge's generator draws a mark
// allocation's bracket and digit as directly-adjacent separate Tj/TJ calls
// with zero real gap (see partsFromContentStreamTokens); a space-joining
// merge would put a space inside "[3]" and break marksInRegion's match. The
// opposite failure — losing a real space between two unrelated words — is
// harmless here: nothing this composer looks for spans a word boundary.
const MARK_LINE_TOL = 2;
function mergeMarkParts(parts) {
  const lines = [];
  for (const part of parts) {
    const line = lines.find((l) => Math.abs(l.y - part.y) <= MARK_LINE_TOL);
    if (line) line.parts.push(part);
    else lines.push({ y: part.y, parts: [part] });
  }
  return lines.map(({ y, parts: lineParts }) => ({
    y,
    text: [...lineParts]
      .sort((a, b) => a.x - b.x)
      .map((p) => p.text)
      .join(''),
  }));
}

export function contentStreamTextLines(stream, height, opts) {
  return mergeMarkParts(partsFromContentStreamTokens(tokenizeContentStream(stream), height, opts));
}

// Resolves the font and Form-XObject names a content stream can reference via
// `Tf`/`Do` against one /Resources dict — a page's own, or a Form XObject's
// own (a Form only falls back to the invoking scope's resources when it omits
// `/Resources` entirely, which the spec allows but this corpus's own XObjects
// never do). Recursing into a nested Form XObject calls this again against
// *its* Resources, so a font named "/F0" inside one XObject can never resolve
// against a same-named-but-different font in the page or another XObject.
//
// Failing to resolve anything (missing Resources, unknown name, no
// ToUnicode) is not an error — it just means that text can't be decoded or
// that XObject can't be followed, same fallback quality as a genuinely
// undecodable code point.
export function makeResourceResolver(srcDoc, resourcesDict) {
  const fontMemo = new Map();
  const xobjMemo = new Map();

  const resolveFont = (fontName) => {
    if (fontMemo.has(fontName)) return fontMemo.get(fontName);
    let info = { composite: false, toUnicode: null };
    try {
      const fontDict = resourcesDict?.lookup(PDFName.of('Font'), PDFDict);
      const ref = fontDict?.get(PDFName.of(fontName));
      if (ref) {
        const dict = srcDoc.context.lookup(ref, PDFDict);
        const subtype = dict.get(PDFName.of('Subtype'));
        if (subtype?.encodedName === '/Type0') {
          info.composite = true;
          const toUniRef = dict.get(PDFName.of('ToUnicode'));
          if (toUniRef) {
            const stream = srcDoc.context.lookup(toUniRef, PDFRawStream);
            const text = Buffer.from(decodePDFRawStream(stream).decode()).toString('latin1');
            info.toUnicode = parseToUnicodeCMap(text);
          }
        }
      }
    } catch {
      info = { composite: false, toUnicode: null };
    }
    fontMemo.set(fontName, info);
    return info;
  };

  const resolveXObject = (xobjName) => {
    if (xobjMemo.has(xobjName)) return xobjMemo.get(xobjName);
    let info = null;
    try {
      const xobjDict = resourcesDict?.lookup(PDFName.of('XObject'), PDFDict);
      const ref = xobjDict?.get(PDFName.of(xobjName));
      if (ref) {
        const stream = srcDoc.context.lookup(ref, PDFRawStream);
        const subtype = stream.dict.get(PDFName.of('Subtype'));
        if (subtype?.encodedName === '/Form') {
          const matrixArr = stream.dict.get(PDFName.of('Matrix'));
          const matrix = matrixArr ? matrixArr.asArray() : IDENTITY_MATRIX;
          const ownResRef = stream.dict.get(PDFName.of('Resources'));
          const ownRes = ownResRef ? srcDoc.context.lookup(ownResRef, PDFDict) : resourcesDict;
          const content = Buffer.from(decodePDFRawStream(stream).decode()).toString('latin1');
          const child = makeResourceResolver(srcDoc, ownRes);
          info = { subtype: 'Form', content, matrix, ...child };
        }
      }
    } catch {
      info = null;
    }
    xobjMemo.set(xobjName, info);
    return info;
  };

  return { resolveFont, resolveXObject };
}

// Cached per (srcDoc, pageIndex), same pattern as isBlankPage/
// pageHasBlankPageText. Fails safe to an empty page — the caller's fallback
// (1 mark for a question with no token found) already covers "this page's
// text couldn't be read" exactly as it covers "this is a multiple-choice
// question that never prints one".
function pageMarkLines(cache, srcDoc, pageIndex) {
  let perDoc = cache.streamLines.get(srcDoc);
  if (!perDoc) cache.streamLines.set(srcDoc, (perDoc = new Map()));
  if (perDoc.has(pageIndex)) return perDoc.get(pageIndex);

  let page = { lines: [], height: 0 };
  try {
    const srcPage = srcDoc.getPage(pageIndex);
    let contents = srcPage.node.Contents();
    if (contents instanceof PDFArray) contents = contents.lookup(0);
    const bytes = decodePDFRawStream(contents).decode();
    const stream = Buffer.from(bytes).toString('latin1');
    const height = srcPage.getHeight();
    const { resolveFont, resolveXObject } = makeResourceResolver(srcDoc, srcPage.node.Resources());
    page = { lines: contentStreamTextLines(stream, height, { resolveFont, resolveXObject }), height };
  } catch (err) {
    console.warn(`  ⚠️  Content-stream text read failed: ${err.message}`);
  }
  perDoc.set(pageIndex, page);
  return page;
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

async function isEmptyContinuation(cache, srcDoc, spec, kind) {
  if (!spec.continuation) return false;
  if (isBlankPage(cache, srcDoc, spec.page - 1)) return true;
  if (pageHasBlankPageText(cache, srcDoc, spec.page - 1)) return true;

  const source = cache.bytes.get(srcDoc);
  if (!source) return false; // no bytes retained → keep the crop
  try {
    const page = await cache.chars.pageChars(source.key, source.bytes, spec.page);
    if (hasBlankPageBanner(page)) return true;
    return !regionHasContent(page, spec.yTop, spec.yBot, {
      headerSkip: kind === 'mark_schemes' ? MS_HEADER_ZONE : HEADER_ZONE,
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

// The 2018–2024 Physics (0625) and Biology (0610) Paper 4 / Paper 6 mark-scheme
// source PDFs are landscape pages stored as a portrait MediaBox (595 × 842)
// plus `/Rotate 90` — see BUILD.md's "Rotation normalisation" section (ported
// identically between the two subjects). Every y-coordinate in
// `_mark_schemes.json` comes from pdfplumber, which honours `/Rotate` and so
// reports coordinates in VISUAL (rotated) space — but pdf-lib's
// `PDFPage.getWidth()/getHeight()` report the raw, un-rotated MediaBox and
// `embedPage()`'s bounding box is interpreted in that same raw space. Applying
// a visual-space crop rectangle straight to the raw content therefore lands on
// the wrong axis entirely: it pulls in whatever unrelated content occupies the
// swapped region (extra rows from neighbouring questions bleeding in) while
// cutting off the real content, and draws what remains sideways. This mirrors
// what `transfer_rotation_to_content()` does for the prebuilt topicals — bake
// the rotation into the crop box and the draw transform instead of trusting
// pdf-lib to do it.
//
// Only 0° and 90° are observed anywhere in the corpus (2025-era mark schemes
// are natively landscape with `/Rotate 0`), so other angles are refused rather
// than guessed at — a wrong guess here silently mis-renders exam content.
export function rotatedCropBox(rawW, rawH, rotation, yTopFromTop, yBotFromTop) {
  const rot = ((rotation % 360) + 360) % 360;

  if (rot === 0) {
    const yBot = yBotFromTop === null ? rawH : yBotFromTop;
    return {
      rotation: 0,
      visW: rawW,
      cropH: yBot - yTopFromTop,
      box: { left: 0, right: rawW, bottom: rawH - yBot, top: rawH - yTopFromTop },
    };
  }

  if (rot === 90) {
    // Visual space is rawH wide × rawW tall (dimensions swap under a
    // quarter turn). A page-relative top-origin y-coordinate maps directly
    // onto the raw x-axis for a 90° rotation — see BUILD.md-adjacent notes in
    // the fix-mark-scheme worktree history for the full corner-mapping
    // derivation; empirically verified against the real June2018-41 source.
    const visH = rawW;
    const yBot = yBotFromTop === null ? visH : yBotFromTop;
    return {
      rotation: 90,
      visW: rawH,
      cropH: yBot - yTopFromTop,
      box: { left: yTopFromTop, right: yBot, bottom: 0, top: rawH },
    };
  }

  throw new Error(`Unsupported source page rotation ${rot}° (only 0° and 90° are handled)`);
}

// Applied once at the end rather than from _newPage() so no page can be missed —
// section dividers and content pages go through different creation paths.
// `brandFont` is the embedded Poppins face from embedBrandFont() — a distinct
// font from the Helvetica used for the rest of the document, so the brand mark
// reads clearly at a glance rather than blending into body text.
export function stampBrandHeader(doc, brandFont) {
  for (const page of doc.getPages()) {
    page.drawText(BRAND_HEADER.text, {
      x: BRAND_HEADER.x,
      y: BRAND_HEADER.y,
      size: BRAND_HEADER.size,
      font: brandFont,
      color: BRAND_HEADER.color,
    });
  }
}

// Vertical-flow layout on A4 — mirrors PageLayout in _build_topicals.py.
// Exported for compose-pdf.test.js's MCQ placement-recording coverage, which
// drives it directly against a small real pdf-lib fixture rather than the
// full composePdf() pipeline — see that file's own note on why composePdf()
// itself stays out of the unit suite.
export class PageLayout {
  constructor(outDoc, font, boldFont) {
    this.out = outDoc;
    this.font = font;
    this.boldFont = boldFont;
    this.page = null;
    this.cursor = CONTENT_TOP;
    this.pendingBanner = null;
    // 0-based index of `this.page` within the output document, kept in step
    // with `_newPage()` so MCQ band recording (see beginQuestion/_place) can
    // say which output page a question landed on without asking pdf-lib.
    this.pageIndex = -1;
    // The question currently being placed, or null when renderSection isn't
    // tracking MCQ placement (the default — most compositions never call
    // beginQuestion at all) or while placing a Mark Scheme crop, which MCQ
    // mode never shows. Set by beginQuestion(), read and appended to by
    // _place(), read back by endQuestion().
    this._question = null;
  }

  _newPage() {
    this.page = this.out.addPage([PAGE_W, PAGE_H]);
    this.cursor = CONTENT_TOP;
    this.pageIndex += 1;
  }

  // Starts tracking where the next question's crop(s) land, for an MCQ paper's
  // answer-key metadata. `meta` is `{ seq, label, answer }` — or null, meaning
  // "don't track this one" (a non-MCQ composition, or the Mark Scheme
  // section). renderSection calls this once per question, wrapping every
  // addCrop/addGroup call that question makes.
  beginQuestion(meta) {
    this._question = meta ? { ...meta, bands: [] } : null;
  }

  // Ends tracking and hands back the finished record (or null), so the
  // caller — not PageLayout — decides whether the composition is MCQ at all.
  endQuestion() {
    const q = this._question;
    this._question = null;
    return q;
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

  // Full-page section heading (e.g. "Questions" / "Mark Scheme"). `coverTitle`
  // is passed only for the section landing on the document's actual first
  // page, so the subject + paper title is printed once, never on a later
  // "Mark Scheme" divider that follows a "Questions" section.
  sectionHeader(text, coverTitle = null) {
    this._newPage();

    if (coverTitle) {
      const titleSize = 20;
      const tw = this.boldFont.widthOfTextAtSize(coverTitle, titleSize);
      this.page.drawText(coverTitle, {
        x: (PAGE_W - tw) / 2,
        y: PAGE_H / 2 + 70,
        size: titleSize,
        font: this.boldFont,
        color: rgb(0.25, 0.25, 0.32),
      });
    }

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

  // Centred "Total: N marks" block — a thin rule, the bold total, another thin
  // rule — echoing how Cambridge itself closes off a paper. Flows through the
  // cursor like any other content (so it lands directly under the last crop),
  // only starting a fresh page when it would not otherwise fit.
  totalMarks(marks) {
    if (this.page === null || this.cursor - TOTAL_BLOCK_H < CONTENT_BOTTOM) {
      this._newPage();
    }
    this._flushBanner();

    const ruleY = this.cursor - 8;
    this.page.drawLine({
      start: { x: PAGE_W / 2 - 90, y: ruleY },
      end: { x: PAGE_W / 2 + 90, y: ruleY },
      thickness: 1,
      color: rgb(0.3, 0.3, 0.4),
    });

    const label = `Total: ${marks} mark${marks === 1 ? '' : 's'}`;
    const size = 13;
    const w = this.boldFont.widthOfTextAtSize(label, size);
    this.page.drawText(label, {
      x: (PAGE_W - w) / 2,
      y: ruleY - 20,
      size,
      font: this.boldFont,
      color: rgb(0.1, 0.1, 0.15),
    });

    const rule2Y = ruleY - 30;
    this.page.drawLine({
      start: { x: PAGE_W / 2 - 90, y: rule2Y },
      end: { x: PAGE_W / 2 + 90, y: rule2Y },
      thickness: 1,
      color: rgb(0.3, 0.3, 0.4),
    });

    this.cursor -= TOTAL_BLOCK_H;
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
    const rawW = srcPage.getWidth();
    const rawH = srcPage.getHeight();
    const rotation = srcPage.getRotation().angle;
    const { visW, cropH, box, rotation: rot } = rotatedCropBox(
      rawW,
      rawH,
      rotation,
      yTopFromTop,
      yBotFromTop,
    );
    if (cropH <= 0) return null;
    const scale = Math.min(1.0, CONTENT_W / visW);
    return { srcPage, box, visW, cropH, scale, rotation: rot };
  }

  async _draw(m, scale) {
    const embedded = await this.out.embedPage(m.srcPage, m.box);
    const drawW = m.visW * scale;
    const drawH = m.cropH * scale;
    const x = MARGIN + (CONTENT_W - drawW) / 2;

    if (m.rotation === 90) {
      // The embedded form's own width/height axes (spanning the crop box) are
      // swapped relative to the un-rotated case, and `(x, y)` now anchors the
      // TOP-LEFT corner of the drawn box rather than the bottom-left — see
      // rotatedCropBox's derivation notes.
      const y = this.cursor;
      this.page.drawPage(embedded, { x, y, width: drawH, height: drawW, rotate: degrees(-90) });
      return y - drawH;
    }

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

    // Top of this block, in top-origin points (mock-space's model space) —
    // captured after the page break and banner are resolved, so a question
    // that starts a fresh page or immediately follows a paper banner records
    // where its own crop actually begins, not where the page started.
    const bandTop = this.cursor;

    for (let i = 0; i < measured.length; i++) {
      if (i) this.cursor -= INTRA_GROUP_GAP;
      const y = await this._draw(measured[i], scales[i]);
      this.cursor = y;
    }

    if (this._question) {
      this._question.bands.push({
        page: this.pageIndex,
        yTopPt: PAGE_H - bandTop,
        yBotPt: PAGE_H - this.cursor,
      });
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

// Sums the "[n]" mark tokens (see marksInRegion, fed by pageMarkLines above —
// deliberately not the pdf.js-backed cache.chars, per the history at
// pageHasBlankPageText) whose baseline falls inside the crops actually kept
// for one question, deduped so a stem crop overlapping its own sub-part crop
// cannot double-count a token both see. Falls back to 1 mark when the
// question yields no token at all — multiple-choice papers never print one.
// `collector.total` accumulates across the whole section; `collector.seen` is
// keyed per srcDoc (not just page number + position) since a Questions
// section spans many distinct exam PDFs that each restart their own page
// numbering, so "page 3" alone cannot disambiguate them.
export function collectQuestionMarks(cache, srcDoc, specs, collector) {
  let seenForDoc = collector.seen.get(srcDoc);
  if (!seenForDoc) collector.seen.set(srcDoc, (seenForDoc = new Set()));

  let total = 0;
  try {
    for (const spec of specs) {
      const page = pageMarkLines(cache, srcDoc, spec.page - 1);
      for (const hit of marksInRegion(page, spec.yTop, spec.yBot)) {
        const dedupeKey = `${spec.page}:${hit.y.toFixed(1)}:${hit.i}`;
        if (seenForDoc.has(dedupeKey)) continue;
        seenForDoc.add(dedupeKey);
        total += hit.marks;
      }
    }
  } catch (err) {
    console.warn(`  ⚠️  Marks extraction failed: ${err.message}`);
    collector.unreadable = true;
    return;
  }
  collector.total += total || 1;
}

// Builds a `{paperNum}/{stem}/{qNum} -> "A".."D"` answer key by reading each
// item's mark-scheme row directly — the same source material the Mark Scheme
// section itself would render, whether or not this composition is actually
// including one (`includeMarkScheme` only controls what gets PRINTED; MCQ
// extraction always needs the mark scheme, because that's the only place the
// answer exists as data anywhere in this app — see mcqAnswers.js).
//
// Mirrors renderSection's own (paperNum, stem) grouping and pageSpecs/
// nextRecord derivation for kind: 'mark_schemes', so the keys this produces
// are exactly the keys renderSection looks up while placing the Questions
// section (see beginQuestion's caller below).
//
// Returns null — never a partial map — the instant any item fails to
// resolve: a missing index, a missing record, or a row that doesn't read as
// a lone A–D. isMcqComponent() is an editorial hint, not ground truth, and
// this is where that gets checked: composePdf treats null exactly like "this
// paper isn't MCQ" and composes it as an ordinary one.
async function extractMcqAnswers(cache, loader, items, geom) {
  const grouped = new Map();
  for (const it of items) {
    const stem = makeStem(it.paper, it.paperNum);
    const key = `${it.paperNum}/${stem}`;
    if (!grouped.has(key)) grouped.set(key, { paperNum: it.paperNum, stem, qNums: [] });
    grouped.get(key).qNums.push(it.qNum);
  }

  const answers = new Map();
  for (const { paperNum, stem, qNums } of grouped.values()) {
    let idx;
    try {
      idx = await loadIndex(cache, loader, paperNum, 'mark_schemes');
    } catch (err) {
      console.warn(`  ⚠️  MCQ: mark-scheme index unavailable for paper ${paperNum}: ${err.message}`);
      return null;
    }
    const entry = idx.get(stem);
    if (!entry) return null;

    let srcDoc;
    try {
      srcDoc = await loadSourcePdf(cache, loader, paperNum, 'mark_schemes', stem);
    } catch (err) {
      console.warn(`  ⚠️  MCQ: mark-scheme PDF unavailable for ${stem}: ${err.message}`);
      return null;
    }
    const pageCount = srcDoc.getPageCount();
    const skippable = new Set(entry.meta.preamble_pages ?? []);

    for (const q of qNums) {
      const qKey = String(q);
      const record = entry.byQ.get(qKey);
      if (!record) return null;

      const pos = entry.posOf.get(qKey);
      const nextRecord = pos === undefined ? null : entry.questions[pos + 1] ?? null;
      const specs = pageSpecs(record, nextRecord, skippable, geom, 'mark_schemes', pageCount).filter(
        (s) => s.page - 1 >= 0 && s.page - 1 < pageCount,
      );

      let answer = null;
      for (const s of specs) {
        const page = pageMarkLines(cache, srcDoc, s.page - 1);
        answer = answerInRegion(page, s.yTop, s.yBot, qKey);
        if (answer) break;
      }
      if (!answer) return null;

      answers.set(`${paperNum}/${stem}/${qKey}`, answer);
    }
  }
  return answers;
}

// `mcqCollector`, when given, is `{ answers: Map<"paperNum/stem/qNum", letter>,
// questions: [] }` — see extractMcqAnswers. Only consulted for kind ===
// 'questions': an MCQ attempt in mock-space never shows the Mark Scheme
// section, so there is nothing to record while rendering it.
async function renderSection(
  layout,
  cache,
  items,
  kind,
  loader,
  order,
  geom,
  marksCollector = null,
  mcqCollector = null,
) {
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
        onPage.map(async (s) => !(await isEmptyContinuation(cache, srcDoc, s, kind))),
      );
      const trimmed = await Promise.all(
        onPage.map((s) => tightenOpenEnd(cache, srcDoc, s, kind)),
      );
      const keptSpecs = trimmed.filter((_, i) => keep[i]);
      const crops = keptSpecs.map((s) => ({
        doc: srcDoc,
        pageIndex: s.page - 1,
        yTop: s.yTop,
        yBot: s.yBot ?? null,
      }));

      if (marksCollector && kind === 'questions') {
        collectQuestionMarks(cache, srcDoc, keptSpecs, marksCollector);
      }

      let mcqMeta = null;
      if (mcqCollector && kind === 'questions') {
        const answer = mcqCollector.answers.get(`${paperNum}/${stem}/${key}`);
        // extractMcqAnswers already required every item to resolve before
        // mcqCollector was ever built, so a miss here would mean this
        // question wasn't part of that extraction pass at all — composePdf
        // checks question/band counts match afterwards and drops the whole
        // answer key rather than publish a partial one.
        if (answer) {
          mcqMeta = {
            seq: mcqCollector.questions.length + 1,
            label: `${meta.month} ${meta.year} Q${q}`,
            answer,
          };
        }
      }
      layout.beginQuestion(mcqMeta);

      if (withStems) {
        await layout.addGroup(crops);
      } else {
        for (const c of crops) await layout.addCrop(c.doc, c.pageIndex, c.yTop, c.yBot);
      }

      // A question can in principle end up with zero bands (every crop it
      // produced got dropped as an empty continuation) — that would leave
      // mock-space nothing to show for it, so it does not count as placed.
      // The items.length check in composePdf then sees the shortfall and
      // discards the whole answer key, the same as any other extraction gap.
      const finishedQuestion = layout.endQuestion();
      if (finishedQuestion && finishedQuestion.bands.length > 0) {
        mcqCollector.questions.push(finishedQuestion);
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
  const brandFont = await embedBrandFont(outDoc);
  const layout = new PageLayout(outDoc, font, boldFont);

  // Every item shares one paper component — GeneratePaperPage locks the
  // selection to a single component before chapters can be picked, and chapter
  // downloads scope by the `P<n>-` id prefix — so the first item's paper number
  // titles the whole document.
  const coverTitle = `${subjectDisplayName(subject)} — Paper ${items[0].paperNum}`;
  let coverDrawn = false;

  // Which questions the mark-scheme index actually covers — computed up front
  // (loadIndex memoizes into `cache.indexes` under the same keys renderSection
  // uses, so this costs no extra I/O either way) because the Questions section
  // needs to know, before it renders, whether a Mark Scheme section is actually
  // going to follow: the total-marks footer is only drawn when both are present.
  let msItems = [];
  if (markSchemeOnly || includeMarkScheme) {
    const msIdxByPaper = new Map();
    for (const paperNum of new Set(items.map((it) => it.paperNum))) {
      msIdxByPaper.set(paperNum, await loadIndex(cache, loader, paperNum, 'mark_schemes'));
    }
    msItems = items.filter((it) => {
      const entry = msIdxByPaper.get(it.paperNum).get(makeStem(it.paper, it.paperNum));
      return entry ? entry.byQ.has(String(it.qNum)) : false;
    });
    if (msItems.length === 0 && markSchemeOnly) {
      throw new Error('No mark schemes are indexed for the selected questions');
    }
  }
  const willDrawTotal = !markSchemeOnly && includeMarkScheme && msItems.length > 0;

  // MCQ answer-key extraction — independent of includeMarkScheme/msItems
  // above: mock-space's MCQ mode needs the answer regardless of whether the
  // *composed PDF* prints a Mark Scheme section, and a markSchemeOnly request
  // (the chapter "MS" download) has no Questions section to attach bands to
  // in the first place. `mcqAnswers` is null unless every item resolved.
  const mcqAnswers =
    !markSchemeOnly && isMcqComponent(subject, items[0].paperNum)
      ? await extractMcqAnswers(cache, loader, items, geom)
      : null;
  const mcqCollector = mcqAnswers ? { answers: mcqAnswers, questions: [] } : null;

  // Section 1 — Questions
  const marksCollector = willDrawTotal ? { total: 0, seen: new Map(), unreadable: false } : null;
  if (!markSchemeOnly) {
    layout.sectionHeader('Questions', coverTitle);
    coverDrawn = true;
    await renderSection(
      layout,
      cache,
      items,
      'questions',
      loader,
      order,
      geom,
      marksCollector,
      mcqCollector,
    );
    if (willDrawTotal && !marksCollector.unreadable) {
      layout.totalMarks(marksCollector.total);
    }
  }

  // Every extracted answer must have found a home in the rendered output, or
  // the placement data mock-space would receive doesn't cover every question
  // it thinks it can show. A mismatch here would mean a question rendering
  // dropped an item extraction kept (or vice versa) — treat that exactly like
  // extraction failing outright, rather than publish a partial answer key.
  const mcqComplete = Boolean(mcqCollector) && mcqCollector.questions.length === items.length;

  // Section 2 — Mark Scheme
  let msCount = 0;
  if (msItems.length > 0) {
    layout.sectionHeader('Mark Scheme', coverDrawn ? null : coverTitle);
    coverDrawn = true;
    await renderSection(layout, cache, msItems, 'mark_schemes', loader, order, geom);
    msCount = msItems.length;
    if (willDrawTotal && !marksCollector.unreadable) {
      layout.totalMarks(marksCollector.total);
    }
  }

  stampBrandHeader(outDoc, brandFont);
  const bytes = await outDoc.save();
  console.log(`✅ PDF composed: ${(bytes.length / 1024).toFixed(1)} KB, ${outDoc.getPageCount()} pages`);

  return {
    bytes,
    metadata: {
      totalQuestions: markSchemeOnly ? 0 : items.length,
      totalMarkSchemes: msCount,
      totalPages: outDoc.getPageCount(),
      totalMarks: willDrawTotal && !marksCollector.unreadable ? marksCollector.total : null,
      includeMarkScheme,
      markSchemeOnly,
      order,
      // null for an ordinary (or extraction-incomplete) composition. Bands are
      // top-origin PDF points into the OUTPUT document — exactly mock-space's
      // own model space (see pdfRender.ts / coords.ts) — so no flip is needed
      // on the receiving end.
      mcq: mcqComplete
        ? {
            subject,
            component: `Paper ${items[0].paperNum}`,
            questions: mcqCollector.questions,
          }
        : null,
    },
  };
}
