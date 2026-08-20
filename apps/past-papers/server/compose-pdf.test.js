import { describe, it, expect } from "vitest";
import { PDFDocument, PDFArray, PDFDict, PDFName, decodePDFRawStream } from "pdf-lib";
import {
  parsePaperNum,
  makeStem,
  paperSortKey,
  pageSpecs,
  geometryFor,
  compareQ,
  PAPER_ORDERS,
  rotatedCropBox,
  collectQuestionMarks,
  contentStreamTextLines,
  parseToUnicodeCMap,
  stampBrandHeader,
  embedBrandFont,
  BRAND_HEADER,
  CONTENT_TOP,
} from "./compose-pdf.js";
import { marksInRegion } from "./page-chars.js";

// Recovers the text a page's single Tj call actually drew, from a *reloaded*
// document (so this reads the saved bytes pdf-lib produced, not the live
// object graph). Two encodings show up here:
//  - a standard font (WinAnsi) writes single-byte codes that equal the
//    character's Latin-1 code point, whether as a literal `(...)` or a hex
//    string `<...>` — hasBlankPageBanner reads *source* PDFs the same way.
//  - a custom embedded font (Poppins, subset-embedded via fontkit) is always
//    CID-keyed: the hex string holds 2-byte glyph ids, not character codes,
//    so it only decodes through the ToUnicode CMap pdf-lib attaches for
//    copy/paste — verified by dumping an actual saved stream.
function drawnText(reloadedDoc, page) {
  let contents = page.node.Contents();
  if (contents instanceof PDFArray) contents = contents.lookup(0);
  const stream = Buffer.from(decodePDFRawStream(contents).decode()).toString("latin1");

  const fontsDict = page.node.Resources().lookup(PDFName.of("Font"), PDFDict);
  for (const [, ref] of fontsDict.entries()) {
    const fontDict = reloadedDoc.context.lookup(ref, PDFDict);
    const toUnicodeRef = fontDict.get(PDFName.of("ToUnicode"));
    if (!toUnicodeRef) continue;
    const cmapText = Buffer.from(
      decodePDFRawStream(reloadedDoc.context.lookup(toUnicodeRef)).decode(),
    ).toString("latin1");
    const cmap = new Map();
    for (const m of cmapText.matchAll(/<([0-9A-Fa-f]{4})>\s*<([0-9A-Fa-f]+)>/g)) {
      const units = m[2].match(/.{4}/g) ?? [];
      cmap.set(m[1].toUpperCase(), units.map((u) => String.fromCharCode(parseInt(u, 16))).join(""));
    }
    const hex = stream.match(/<([0-9A-Fa-f]+)>\s*Tj/)?.[1] ?? "";
    return (hex.match(/.{4}/g) ?? []).map((cid) => cmap.get(cid.toUpperCase()) ?? "?").join("");
  }

  const literals = [...stream.matchAll(/\(([^()\\]*)\)/g)].map((m) => m[1]);
  const hexRuns = [...stream.matchAll(/<([0-9A-Fa-f]+)>/g)].map((m) =>
    Buffer.from(m[1], "hex").toString("latin1"),
  );
  return [...literals, ...hexRuns].join("");
}

// Crop geometry is per subject now (the extraction pipelines diverged), so the
// sentinel comes from the profile rather than a single module-level constant.
const DEFAULT = geometryFor("0607"); // sentinel 720, questions 14/14
const ECONOMICS = geometryFor("0455"); // sentinel 760, questions 10/6
const SENTINEL = DEFAULT.sentinel;

/**
 * The paper-composition engine's pure helpers. composePdf() itself renders real
 * PDFs and needs pdf-lib fixtures + a loader; these cover the logic that decides
 * which slices of which source pages end up in a student's compiled paper —
 * getting this wrong drops or duplicates exam content.
 */

describe("parsePaperNum", () => {
  it("reads the paper number out of a question id", () => {
    expect(parsePaperNum("P2-Q3")).toBe(2);
    expect(parsePaperNum("P4-Q17")).toBe(4);
  });

  it("throws on a malformed id rather than guessing", () => {
    expect(() => parsePaperNum("Q3")).toThrow(/Invalid question id/);
    expect(() => parsePaperNum("P2-3")).toThrow(/Invalid question id/);
    expect(() => parsePaperNum("P2-Q3-extra")).toThrow(/Invalid question id/);
    expect(() => parsePaperNum("")).toThrow(/Invalid question id/);
  });
});

describe("makeStem", () => {
  it("builds the source-file stem from the paper field and number", () => {
    // "June-2014-1" + paper 2 → "June2014-21" (month+year, then paperNum+timezone).
    expect(makeStem("June-2014-1", 2)).toBe("June2014-21");
    expect(makeStem("November-2025-3", 4)).toBe("November2025-43");
  });

  it("throws on a paper field that is not three parts", () => {
    expect(() => makeStem("June-2014", 2)).toThrow(/Unexpected paper format/);
    expect(() => makeStem("2014", 2)).toThrow(/Unexpected paper format/);
  });
});

describe("paperSortKey", () => {
  it("orders by year, then month (Mar<Jun<Nov), then timezone", () => {
    expect(paperSortKey({ year: 2014, month: "June", timezone: 1 })).toEqual([2014, 1, 1]);
    expect(paperSortKey({ year: 2020, month: "March", timezone: 2 })).toEqual([2020, 0, 2]);
    expect(paperSortKey({ year: 2020, month: "November", timezone: 3 })).toEqual([2020, 2, 3]);
  });

  it("sends an unknown month to the back", () => {
    expect(paperSortKey({ year: 2020, month: "Frimaire", timezone: 1 })[1]).toBe(99);
  });

  it("sorts a mixed list oldest-first when used as the comparator key", () => {
    const metas = [
      { year: 2020, month: "November", timezone: 1 },
      { year: 2014, month: "June", timezone: 1 },
      { year: 2020, month: "March", timezone: 1 },
      { year: 2014, month: "June", timezone: 2 },
    ];
    const sorted = [...metas].sort((a, b) => {
      const ka = paperSortKey(a);
      const kb = paperSortKey(b);
      return ka[0] - kb[0] || ka[1] - kb[1] || ka[2] - kb[2];
    });
    expect(sorted.map((m) => `${m.month}${m.year}-${m.timezone}`)).toEqual([
      "June2014-1",
      "June2014-2",
      "March2020-1",
      "November2020-1",
    ]);
  });
});

describe("PAPER_ORDERS", () => {
  it("is exactly the two supported orderings", () => {
    expect(PAPER_ORDERS).toEqual(["oldest", "newest"]);
  });
});

describe("compareQ", () => {
  it("orders plain question numbers numerically, not lexically", () => {
    expect(["10", "9", "1"].sort(compareQ)).toEqual(["1", "9", "10"]);
  });

  it("orders a structured paper's sub-parts within their question", () => {
    expect(["3(a)", "2(b)", "2(a)", "10(a)"].sort(compareQ)).toEqual([
      "2(a)",
      "2(b)",
      "3(a)",
      "10(a)",
    ]);
  });
});

describe("pageSpecs — cropping a question off its source page", () => {
  // Records are top-origin PDF points. A question ending before the sentinel is
  // one crop; one that reaches the sentinel runs to the BOTTOM of its own page
  // (yBot: null) and continues on the following pages. `yBot: null` means "to
  // the bottom of that source page" and is resolved at draw time.
  //
  // These assertions mirror `_page_specs` in _build_topicals.py, which is the
  // source of truth — it produced the prebuilt topical PDFs. An earlier version
  // of this file asserted the composer's own behaviour instead, and so locked in
  // a bug: it cropped the first page at `sentinel - headroom` (a meaningless
  // coordinate, ~136pt of content lost) and started continuation pages at a 45pt
  // header skip instead of 0. That truncation is what removed answer options
  // from 0625 Paper 2 MCQs.

  it("crops a single self-contained question, applying headroom", () => {
    const q = { q: 1, page: 3, y_start: 100, y_end: 300 };
    const specs = pageSpecs(q, null, new Set(), DEFAULT, "questions", 10);
    expect(specs).toEqual([{ page: 3, yTop: 86, yBot: 286 }]); // y − headroom
  });

  it("never lets headroom push the top above the page origin", () => {
    const q = { q: 1, page: 1, y_start: 5, y_end: 300 };
    const specs = pageSpecs(q, null, new Set(), DEFAULT, "questions", 10);
    expect(specs[0].yTop).toBe(0); // max(0, 5 − 14)
  });

  it("applies the minimum crop height rather than emitting a sliver", () => {
    const q = { q: 1, page: 1, y_start: 100, y_end: 104 };
    const specs = pageSpecs(q, null, new Set(), DEFAULT, "questions", 10);
    expect(specs).toEqual([{ page: 1, yTop: 86, yBot: 86 + 20 }]);
  });

  it("runs the first page to its bottom, then stops where the next question starts", () => {
    const q1 = { q: 1, page: 2, y_start: 400, y_end: SENTINEL };
    const q2 = { q: 2, page: 3, y_start: 250, y_end: 400 };
    const specs = pageSpecs(q1, q2, new Set(), DEFAULT, "questions", 10);
    expect(specs).toEqual([
      // To the bottom of the page — NOT `sentinel - headroom`.
      { page: 2, yTop: 386, yBot: null },
      // Continuation starts at the page origin, not a header skip.
      { page: 3, yTop: 0, yBot: 236, continuation: true },
    ]);
  });

  it("sweeps to the end of the paper when nothing follows", () => {
    // The last question in a paper has no next record, so it runs to the end —
    // which is how BLANK PAGE separators and the closing acknowledgements block
    // get pulled in, and why the content test and tighten_bottom exist.
    const q = { q: 5, page: 4, y_start: 400, y_end: SENTINEL };
    const specs = pageSpecs(q, null, new Set(), DEFAULT, "questions", 6);
    expect(specs).toEqual([
      { page: 4, yTop: 386, yBot: null },
      { page: 5, yTop: 0, yBot: null, continuation: true },
      { page: 6, yTop: 0, yBot: null, continuation: true },
    ]);
  });

  it("skips blank/ignored pages while continuing", () => {
    const q1 = { q: 1, page: 1, y_start: 500, y_end: SENTINEL };
    const q2 = { q: 2, page: 3, y_start: 200, y_end: 400 };
    const specs = pageSpecs(q1, q2, new Set([2]), DEFAULT, "questions", 10);
    expect(specs).toEqual([
      { page: 1, yTop: 486, yBot: null },
      { page: 3, yTop: 0, yBot: 186, continuation: true },
    ]);
  });

  it("marks only run-on pages as continuations, never the question's own page", () => {
    const q1 = { q: 1, page: 1, y_start: 500, y_end: SENTINEL };
    const q2 = { q: 2, page: 3, y_start: 200, y_end: 400 };
    const specs = pageSpecs(q1, q2, new Set(), DEFAULT, "questions", 10);
    // Only continuation crops are eligible to be dropped as empty; a record's
    // own page must never be, or a short MCQ mark-scheme row ("1 A 1") vanishes.
    expect(specs.map((s) => Boolean(s.continuation))).toEqual([false, true, true]);
  });

  it("prefers next_boundary over the next record, so a stimulus is not swallowed", () => {
    // 0455: the next record is the following question's first sub-part, which
    // sits BELOW its stimulus; next_boundary is that question's number marker,
    // which sits above it. Stopping at the record would eat the stimulus.
    const q = { q: "7(d)", page: 3, y_start: 400, y_end: ECONOMICS.sentinel, next_boundary: [4, 120] };
    const nextRecord = { q: "8(a)", page: 4, y_start: 300, y_end: 500 };
    const specs = pageSpecs(q, nextRecord, new Set(), ECONOMICS, "questions", 10);
    expect(specs).toEqual([
      { page: 3, yTop: 390, yBot: null }, // 400 − top(10)
      { page: 4, yTop: 0, yBot: 114, continuation: true }, // 120 − bottom(6)
    ]);
  });

  it("uses each subject's own headroom and sentinel", () => {
    // 0625 shifts by 8, and 720 is its sentinel; 0455 shifts the top by 10 and
    // treats 720 as an ordinary coordinate because its sentinel is 760.
    const physics = geometryFor("0625");
    expect(pageSpecs({ q: 1, page: 1, y_start: 100, y_end: 300 }, null, new Set(), physics, "questions", 5))
      .toEqual([{ page: 1, yTop: 92, yBot: 292 }]);
    expect(pageSpecs({ q: 1, page: 1, y_start: 100, y_end: 720 }, null, new Set(), ECONOMICS, "questions", 5))
      .toEqual([{ page: 1, yTop: 90, yBot: 714 }]);
  });

  it("uses the mark-scheme headroom for mark schemes", () => {
    const q = { q: 1, page: 2, y_start: 100, y_end: 300 };
    const specs = pageSpecs(q, null, new Set(), DEFAULT, "mark_schemes", 5);
    expect(specs).toEqual([{ page: 2, yTop: 98, yBot: 298 }]); // shift of 2, not 14
  });
});

describe("rotatedCropBox — placing a crop on a rotated source page", () => {
  // pdf-lib's PDFPage.getWidth()/getHeight() report the raw, un-rotated
  // MediaBox; embedPage()'s bounding box is interpreted in that same raw
  // space. `_mark_schemes.json` coordinates come from pdfplumber, which DOES
  // honour `/Rotate` — so every coordinate handed to this function is in
  // VISUAL (rotated) space and must be translated into the page's raw space
  // before it can be used as an embedPage boundingBox.
  //
  // 0625/0610 Papers 4 & 6 (2018–2024): portrait MediaBox 595×842 + /Rotate 90
  // → visual page is 842 wide × 595 tall. These numbers are exercised against
  // the real June2018-41.pdf source in the fix-mark-scheme investigation (see
  // conversation history) — rendering the resulting crop reproduced the
  // prebuilt topical's Q2 content exactly, sideways-free and with no
  // neighbouring-question bleed.

  it("rotation 0 — behaves exactly like an un-rotated crop (no regression)", () => {
    const result = rotatedCropBox(595, 842, 0, 100, 300);
    expect(result).toEqual({
      rotation: 0,
      visW: 595,
      cropH: 200, // 300 - 100
      box: { left: 0, right: 595, bottom: 542, top: 742 }, // 842-300, 842-100
    });
  });

  it("rotation 0 — a null yBot runs to the raw page height", () => {
    const result = rotatedCropBox(595, 842, 0, 100, null);
    expect(result.box).toEqual({ left: 0, right: 595, bottom: 0, top: 742 });
    expect(result.cropH).toBe(742); // 842 - 100
  });

  it("rotation 90 — swaps visual width/height and maps top-origin y directly onto raw x", () => {
    // June2018-41 p4, Q2: y_start 329.98 minus the MS headroom (2) = 327.98.
    const result = rotatedCropBox(595, 842, 90, 327.98, 595);
    expect(result.rotation).toBe(90);
    expect(result.visW).toBe(842); // = raw height
    expect(result.cropH).toBeCloseTo(267.02); // 595 - 327.98
    expect(result.box).toEqual({ left: 327.98, right: 595, bottom: 0, top: 842 });
  });

  it("rotation 90 — a null yBot runs to the visual page height, not the raw one", () => {
    // The bug this guards: using the raw height (842) here instead of the
    // visual height (595, = raw width) swept in the next question's entire
    // table row — the "irrelevant mark-scheme content" symptom.
    const result = rotatedCropBox(595, 842, 90, 100, null);
    expect(result.box.right).toBe(595); // visual height, i.e. raw width — NOT 842
    expect(result.cropH).toBe(495); // 595 - 100
  });

  it("rotation 90 — a normalized-rotation source (270 rotation) still round-trips through modulo", () => {
    // getRotation().angle is documented as always one of 0/90/180/270, but the
    // normalisation (`((r % 360) + 360) % 360`) is defensive against a
    // negative angle rather than assuming the library never hands one back.
    expect(() => rotatedCropBox(595, 842, -270, 100, 300)).not.toThrow();
    expect(rotatedCropBox(595, 842, -270, 100, 300)).toEqual(rotatedCropBox(595, 842, 90, 100, 300));
  });

  it("refuses 180°/270° rather than silently mis-rendering", () => {
    // Never observed in the corpus (2025-era mark schemes are natively
    // landscape with /Rotate 0), so there's no verified transform for them —
    // guessing risks the exact "mis-cropped, sideways" bug this fixes.
    expect(() => rotatedCropBox(595, 842, 180, 100, 300)).toThrow(/Unsupported source page rotation/);
    expect(() => rotatedCropBox(595, 842, 270, 100, 300)).toThrow(/Unsupported source page rotation/);
  });
});

// The total-marks footer's aggregation step: how many marks one question's kept
// crops are actually worth, read straight off the source PDF's own "[n]" text.
// Deliberately NOT backed by pdf.js (cache.chars) — see the comment above
// pageMarkLines in compose-pdf.js for why: getTextContent() has repeatedly
// proven unreliable in the Vercel serverless runtime for this exact codebase,
// so marks are read from the raw content stream via pageMarkLines instead,
// same as blank-page detection already does.
describe("collectQuestionMarks — per-question mark aggregation", () => {
  // A minimal stand-in for makeCache()'s streamLines cache: `pages` maps a
  // 0-based page index (pdf-lib's own convention — collectQuestionMarks
  // converts spec.page, which is 1-based) to the {lines, height} shape
  // marksInRegion reads. Pre-seeding cache.streamLines means
  // collectQuestionMarks never touches pdf-lib at all, so `srcDoc` only ever
  // needs to work as a Map key.
  function fakeCache(pagesByIndex) {
    const srcDoc = {};
    const perDoc = new Map(Object.entries(pagesByIndex).map(([k, v]) => [Number(k), v]));
    const cache = { streamLines: new Map([[srcDoc, perDoc]]) };
    return { cache, srcDoc };
  }

  it("sums the [n] tokens found across a question's kept crops", () => {
    const { cache, srcDoc } = fakeCache({
      1: { height: 842, lines: [{ y: 300, text: "(a) [2]" }] }, // page 2
      2: { height: 842, lines: [{ y: 100, text: "(b) [4]" }] }, // page 3
    });
    const collector = { total: 0, seen: new Map(), unreadable: false };
    collectQuestionMarks(
      cache,
      srcDoc,
      [
        { page: 2, yTop: 0, yBot: null },
        { page: 3, yTop: 0, yBot: null },
      ],
      collector,
    );
    expect(collector.total).toBe(6);
    expect(collector.unreadable).toBe(false);
  });

  it("falls back to 1 mark for a question with no readable token (the MCQ convention)", () => {
    const { cache, srcDoc } = fakeCache({
      4: { height: 842, lines: [{ y: 200, text: "1 A" }] }, // page 5
    });
    const collector = { total: 0, seen: new Map(), unreadable: false };
    collectQuestionMarks(cache, srcDoc, [{ page: 5, yTop: 0, yBot: null }], collector);
    expect(collector.total).toBe(1);
  });

  it("dedupes a token seen through two overlapping crops (e.g. a stem crop and its sub-part)", () => {
    const { cache, srcDoc } = fakeCache({
      3: { height: 842, lines: [{ y: 150, text: "(a) [3]" }] }, // page 4
    });
    const collector = { total: 0, seen: new Map(), unreadable: false };
    // Two specs on the same page whose y-ranges both cover y=150 — the stem crop
    // (0..842) and a narrower sub-part crop (100..300) both "see" the same line.
    collectQuestionMarks(
      cache,
      srcDoc,
      [
        { page: 4, yTop: 0, yBot: null },
        { page: 4, yTop: 100, yBot: 300 },
      ],
      collector,
    );
    expect(collector.total).toBe(3);
  });

  it("accumulates across repeated calls, as renderSection does across a whole section", () => {
    const { cache, srcDoc } = fakeCache({
      0: { height: 842, lines: [{ y: 90, text: "[5]" }] }, // page 1
      1: { height: 842, lines: [{ y: 90, text: "[7]" }] }, // page 2
    });
    const collector = { total: 0, seen: new Map(), unreadable: false };
    collectQuestionMarks(cache, srcDoc, [{ page: 1, yTop: 0, yBot: null }], collector);
    collectQuestionMarks(cache, srcDoc, [{ page: 2, yTop: 0, yBot: null }], collector);
    expect(collector.total).toBe(12);
  });

  it("does not let two different exam PDFs sharing a page number collide in the dedupe set", () => {
    // A Questions section spans many distinct exam PDFs, each restarting its
    // own page numbering — "page 2" alone must not be treated as the same
    // slot across two different srcDocs.
    const { cache, srcDoc: srcDocA } = fakeCache({
      1: { height: 842, lines: [{ y: 300, text: "[2]" }] },
    });
    const srcDocB = {};
    cache.streamLines.set(
      srcDocB,
      new Map([[1, { height: 842, lines: [{ y: 300, text: "[5]" }] }]]),
    );
    const collector = { total: 0, seen: new Map(), unreadable: false };
    collectQuestionMarks(cache, srcDocA, [{ page: 2, yTop: 0, yBot: null }], collector);
    collectQuestionMarks(cache, srcDocB, [{ page: 2, yTop: 0, yBot: null }], collector);
    expect(collector.total).toBe(7);
  });

  it("marks the collector unreadable, rather than guessing, if extraction throws unexpectedly", () => {
    const collector = { total: 0, seen: new Map(), unreadable: false };
    // No `streamLines` map at all — the same shape a genuinely broken cache
    // would produce, forcing collectQuestionMarks's own defensive try/catch.
    collectQuestionMarks({}, {}, [{ page: 1, yTop: 0, yBot: null }], collector);
    expect(collector.unreadable).toBe(true);
    expect(collector.total).toBe(0);
  });
});

// The content-stream interpreter behind pageMarkLines: recovering each
// show-text operation's Y position by tracking the text line matrix through
// Tm/Td/TD/T*, exactly as a PDF viewer would, but without pdf.js.
describe("parseToUnicodeCMap — decoding a composite font's ToUnicode CMap", () => {
  it("parses a bfchar block (the real 0607 Paper 4 fixture)", () => {
    const map = parseToUnicodeCMap(`
      1 begincodespacerange
      <0000> <FFFF>
      endcodespacerange
      7 beginbfchar
      <0003> <0008>
      <000F> <002C>
      <0011> <002E>
      <0015> <0032>
      <003E> <005B>
      <0040> <005D>
      <0BD8> <200A>
      endbfchar
    `);
    expect(map.get(0x003e)).toBe("["); // U+005B
    expect(map.get(0x0015)).toBe("2"); // U+0032
    expect(map.get(0x0040)).toBe("]"); // U+005D
    expect(map.get(0x0bd8)).toBe(" ");
    expect(map.has(0x1234)).toBe(false);
  });

  it("parses a bfrange block in incrementing-destination form", () => {
    const map = parseToUnicodeCMap(`
      1 beginbfrange
      <0020> <0024> <0030>
      endbfrange
    `);
    expect(map.get(0x0020)).toBe("0");
    expect(map.get(0x0021)).toBe("1");
    expect(map.get(0x0024)).toBe("4");
  });

  it("parses a bfrange block in explicit-array form without misreading its contents as a new range", () => {
    const map = parseToUnicodeCMap(`
      1 beginbfrange
      <0010> <0012> [<0041> <0042> <0043>]
      endbfrange
    `);
    expect(map.get(0x0010)).toBe("A");
    expect(map.get(0x0011)).toBe("B");
    expect(map.get(0x0012)).toBe("C");
    expect(map.size).toBe(3); // the array's own entries never seed a spurious 4th mapping
  });

  it("decodes a multi-code-unit dst as a UTF-16BE surrogate pair", () => {
    const map = parseToUnicodeCMap(`
      1 beginbfchar
      <0099> <D83DDE00>
      endbfchar
    `);
    expect(map.get(0x0099)).toBe("😀"); // 😀, as two UTF-16 code units
  });

  it("returns an empty map for a CMap with neither block", () => {
    expect(parseToUnicodeCMap("/CIDInit /ProcSet findresource begin").size).toBe(0);
  });
});

describe("contentStreamTextLines — text position from the raw content stream", () => {
  const HEIGHT = 842;

  it("reads a Tm-positioned Tj literal, converting to top-origin", () => {
    // Tm sets f=690.87691 directly (bottom-origin) → top-origin y = height - f.
    const stream = "BT\n10.9984 0 0 10.9984 522.79379 690.87691 Tm\n( [1] )Tj\nET";
    const lines = contentStreamTextLines(stream, HEIGHT);
    expect(lines).toHaveLength(1);
    expect(lines[0].text).toBe(" [1] ");
    expect(lines[0].y).toBeCloseTo(HEIGHT - 690.87691, 4);
  });

  it("scales a Td offset by the current text matrix, not by 1:1", () => {
    // Real corpus pattern: Tm establishes scale 10.9984, then a bare
    // "0 -1.14951 TD" line-break moves down by ty * scale, not by ty alone.
    const stream = [
      "BT",
      "10.9984 0 0 10.9984 241.7386 769.25481 Tm",
      "(line one)Tj",
      "0 -1.14951 TD",
      "(line two)Tj",
      "ET",
    ].join("\n");
    const lines = contentStreamTextLines(stream, HEIGHT);
    expect(lines).toHaveLength(2);
    expect(lines[0].text).toBe("line one");
    expect(lines[1].text).toBe("line two");
    const expectedSecondF = 769.25481 + -1.14951 * 10.9984;
    expect(lines[1].y).toBeCloseTo(HEIGHT - expectedSecondF, 3);
  });

  it("reassembles a TJ kerning array into one run of text", () => {
    const stream = "BT\n1 0 0 1 100 700 Tm\n[(Answer)-250(\\(b\\))-10( )]TJ\nET";
    const lines = contentStreamTextLines(stream, HEIGHT);
    expect(lines).toHaveLength(1);
    expect(lines[0].text).toBe("Answer(b) ");
  });

  it("T* moves down by the current leading set via TL", () => {
    const stream = "BT\n1 0 0 1 50 800 Tm\n12 TL\n(first)Tj\nT*\n(second)Tj\nET";
    const lines = contentStreamTextLines(stream, HEIGHT);
    expect(lines).toHaveLength(2);
    expect(lines[1].y).toBeCloseTo(HEIGHT - (800 - 12), 4);
  });

  it("TD both moves and sets the leading used by a later T*", () => {
    const stream = "BT\n1 0 0 1 50 800 Tm\n0 -20 TD\n(a)Tj\nT*\n(b)Tj\nET";
    const lines = contentStreamTextLines(stream, HEIGHT);
    expect(lines).toHaveLength(2);
    expect(lines[0].y).toBeCloseTo(HEIGHT - 780, 4);
    expect(lines[1].y).toBeCloseTo(HEIGHT - 760, 4); // TD's -20 set leading=20, T* repeats it
  });

  it("' shows text after a T*-style move, \" after setting spacing first", () => {
    const stream = [
      "BT",
      "1 0 0 1 50 800 Tm",
      "10 TL",
      "(first)Tj",
      "(second)'",
      "0 0 (third)\"",
      "ET",
    ].join("\n");
    const lines = contentStreamTextLines(stream, HEIGHT);
    expect(lines.map((l) => l.text)).toEqual(["first", "second", "third"]);
    expect(lines[1].y).toBeCloseTo(HEIGHT - 790, 4);
    expect(lines[2].y).toBeCloseTo(HEIGHT - 780, 4);
  });

  it("BT resets the text matrix, so a later block doesn't inherit the earlier position", () => {
    const stream = [
      "BT\n1 0 0 1 50 800 Tm\n(first)Tj\nET",
      "q 1 0 0 1 0 0 cm Q", // unrelated graphics op between text blocks
      "BT\n1 0 0 1 50 500 Tm\n(second)Tj\nET",
    ].join("\n");
    const lines = contentStreamTextLines(stream, HEIGHT);
    expect(lines.map((l) => l.y)).toEqual([HEIGHT - 800, HEIGHT - 500]);
  });

  it("handles escaped parens and octal escapes without desyncing the tokenizer", () => {
    // "\(b\)" must not be read as closing the string early, and "\251" (©)
    // must consume all three octal digits, not just one.
    const stream = "BT\n1 0 0 1 0 700 Tm\n(\\251 UCLES \\(2014\\) [3])Tj\nET";
    const lines = contentStreamTextLines(stream, HEIGHT);
    expect(lines).toHaveLength(1);
    expect(lines[0].text).toBe("© UCLES (2014) [3]");
  });

  it("ignores non-text operators and their operands entirely", () => {
    const stream = [
      "0 g",
      "1 i",
      "q 3.12 0 0 1.474 337.0394 688.4958 cm /Im0 Do Q",
      "BT\n1 0 0 1 0 700 Tm\n(kept)Tj\nET",
    ].join("\n");
    const lines = contentStreamTextLines(stream, HEIGHT);
    expect(lines).toEqual([{ y: HEIGHT - 700, text: "kept" }]);
  });

  it("returns no lines for a stream with no text-showing operators", () => {
    expect(contentStreamTextLines("q 1 0 0 1 0 0 cm Q", HEIGHT)).toEqual([]);
  });

  it("joins a mark token split across two adjacent Tj calls with NO inserted space", () => {
    // Real bug, real fixture: 0620 Paper 4 June2018-41.pdf and
    // November2019-42.pdf draw "[3]" as two separate Tj calls at the exact
    // same baseline — "  [" then "3]" — with zero actual gap between them
    // (verified: no Td/Tm moves the pen in between, just two consecutive
    // show-text operations). A merge that inserts a space between runs (the
    // right call for reassembling a word-boundary banner) would turn this
    // into "[ 3]" and marksInRegion would never match it.
    const stream = "BT\n1 0 0 1 100 700 Tm\n(  [)Tj\n(3])Tj\nET";
    const lines = contentStreamTextLines(stream, HEIGHT);
    expect(lines).toEqual([{ y: HEIGHT - 700, text: "  [3]" }]);
  });

  it("reads a hex string literal the same as a parenthesized one", () => {
    // Real corpus pattern (0620 Paper 4 June2018-41.pdf): some runs show text
    // as `<0003>Tj` instead of `(...)Tj`. 0x00 0x03 as raw bytes is "\x00\x03"
    // — this must come out identical to an equivalent (...) literal, not be
    // silently dropped as an unhandled token type.
    const stream = "BT\n1 0 0 1 0 700 Tm\n<48656C6C6F>Tj\nET"; // "Hello" in hex
    const lines = contentStreamTextLines(stream, HEIGHT);
    expect(lines).toEqual([{ y: HEIGHT - 700, text: "Hello" }]);
  });

  it("pads an odd-length hex string with a trailing zero nibble, per the PDF spec", () => {
    const stream = "BT\n1 0 0 1 0 700 Tm\n<412>Tj\nET"; // 0x41, 0x20 (padded)
    const lines = contentStreamTextLines(stream, HEIGHT);
    expect(lines).toEqual([{ y: HEIGHT - 700, text: "A " }]);
  });

  it("decodes a composite font's hex-string TJ token via resolveFont, same as a parenthesized one", () => {
    const toUnicode = new Map([[0x0003, "["], [0x0014, "N"], [0x0011, "]"]]);
    const resolveFont = (name) =>
      name === "C2_0" ? { composite: true, toUnicode } : { composite: false, toUnicode: null };
    const stream = "BT\n/C2_0 1 Tf\n1 0 0 1 0 700 Tm\n[<000300140011>]TJ\nET";
    const lines = contentStreamTextLines(stream, HEIGHT, { resolveFont });
    expect(lines).toEqual([{ y: HEIGHT - 700, text: "[N]" }]);
  });

  it("decodes a composite (Type0) font's 2-byte codes via an injected resolveFont", () => {
    // Real bug, real fixture: 0607 Paper 4 (March2023-42.pdf, page 10) draws
    // its "[2]" mark allocation through composite font /C2_0 as
    // `[(\000>\000\025\000@)] TJ` — raw bytes 0x00 0x3E 0x00 0x15 0x00 0x40,
    // i.e. CIDs 0x003E, 0x0015, 0x0040 — which are NOT '[' '2' ']' in any byte
    // encoding; only that font's own ToUnicode CMap (below, extracted
    // verbatim from the same PDF) says so. Reading this raw-Latin1 (as every
    // simple font on this page correctly is) silently dropped the token
    // entirely — this is the exact case that motivated resolveFont existing.
    const toUnicode = parseToUnicodeCMap(`
      1 begincodespacerange
      <0000> <FFFF>
      endcodespacerange
      7 beginbfchar
      <0003> <0008>
      <000F> <002C>
      <0011> <002E>
      <0015> <0032>
      <003E> <005B>
      <0040> <005D>
      <0BD8> <200A>
      endbfchar
    `);
    const resolveFont = (name) =>
      name === "C2_0" ? { composite: true, toUnicode } : { composite: false, toUnicode: null };

    const stream = [
      "BT",
      "/C2_0 11.5 Tf",
      "11.5 0 0 11.5 532.2626 288.0196 Tm",
      "[(\x00\x3E\x00\x15\x00\x40)] TJ",
      "ET",
    ].join("\n");
    const lines = contentStreamTextLines(stream, 841.89, { resolveFont });
    expect(lines).toHaveLength(1);
    expect(lines[0].text).toBe("[2]");
  });

  it("a composite font with no ToUnicode contributes nothing, rather than garbage bytes", () => {
    const resolveFont = () => ({ composite: true, toUnicode: null });
    const stream = "BT\n/C2_0 11.5 Tf\n1 0 0 1 0 700 Tm\n(\x00\x3E\x00\x15)Tj\nET";
    const lines = contentStreamTextLines(stream, 841.89, { resolveFont });
    expect(lines).toEqual([]); // empty decoded text never gets pushed as a line
  });

  it("switching Tf mid-stream applies the right decode to each run", () => {
    const toUnicode = new Map([[0x41, "Z"]]);
    const resolveFont = (name) =>
      name === "Composite" ? { composite: true, toUnicode } : { composite: false, toUnicode: null };
    const stream = [
      "BT",
      "/Simple 10 Tf",
      "1 0 0 1 0 700 Tm",
      "(plain)Tj",
      "/Composite 10 Tf",
      "0 -20 Td",
      "(\x00\x41)Tj",
      "ET",
    ].join("\n");
    const lines = contentStreamTextLines(stream, 841.89, { resolveFont });
    expect(lines.map((l) => l.text)).toEqual(["plain", "Z"]);
  });

  it("restores the font selected before a q...Q block, not whatever Tf ran last inside it", () => {
    // Real bug, real fixture: 0606 Paper 1 June2014-11.pdf draws its "[3]"
    // mark allocation with composite font /C2_0 selected *before* a
    // `q ... /T1_9 Tf ... Q` clip block (a differently-sized inline run), and
    // shows the token afterward with no Tf of its own — relying on Q to
    // restore /C2_0. Font selection is graphics state (PDF spec §8.4, §9.3)
    // and q/Q must save/restore it exactly like CTM; treating `currentFont`
    // as a plain running variable let the inner /T1_9 leak past the Q and
    // decoded the mark token as garbage 1-byte-per-char text instead.
    const toUnicode = new Map([
      [0x3e, "["],
      [0x16, "3"],
      [0x40, "]"],
    ]);
    const resolveFont = (name) =>
      name === "C2_0" ? { composite: true, toUnicode } : { composite: false, toUnicode: null };

    const stream = [
      "BT",
      "/C2_0 1 Tf", // selected here, before the q...Q block
      "ET",
      "q",
      "BT",
      "/T1_9 1 Tf", // selected only inside this q...Q scope
      "10.5 0 0 10.5 200 480 Tm",
      "(\x2A)Tj", // a simple-font byte that must NOT leak into the next run
      "ET",
      "Q",
      "BT",
      // No Tf here — must inherit whatever Q restored (C2_0), not T1_9.
      "11.5 0 0 11.5 532.26 500 Tm",
      "(\x00\x3E\x00\x16\x00\x40)Tj",
      "ET",
    ].join("\n");

    const lines = contentStreamTextLines(stream, 841.89, { resolveFont });
    expect(lines.map((l) => l.text)).toEqual(["*", "[3]"]);
  });

  it("matches the real corpus pattern for a printed mark allocation end to end", () => {
    // Extracted verbatim from 0607 Paper 2 June2014-21.pdf's raw content
    // stream (the actual "[1]" for question 1(a)) — this is the exact
    // operator sequence marksInRegion has to see a "[1]" survive.
    const stream = [
      "BT",
      "/T1_3 1 Tf",
      "10.9984 0 0 10.9984 279.2126 690.87691 Tm",
      "(A)Tj",
      "ET",
      "BT",
      "/T1_3 1 Tf",
      "10.9984 0 0 10.9984 285.93069 690.87691 Tm",
      "(nswer\\(a\\) )Tj",
      "ET",
      "BT",
      "/T1_1 1 Tf",
      "0.62891 Tw 10.9984 0 0 10.9984 522.79379 690.87691 Tm",
      "( [1] )Tj",
      "ET",
    ].join("\n");
    const lines = contentStreamTextLines(stream, HEIGHT);
    const marksLine = lines.find((l) => l.text.includes("[1]"));
    expect(marksLine).toBeDefined();
    expect(marksLine.y).toBeCloseTo(HEIGHT - 690.87691, 4);
    const hits = marksInRegion({ lines, height: HEIGHT }, marksLine.y - 5, marksLine.y + 5);
    expect(hits).toEqual([{ y: marksLine.y, i: 0, marks: 1 }]);
  });
});

describe("embedBrandFont / stampBrandHeader", () => {
  it("loads the vendored Poppins file and stamps the wordmark, with no © line, on every page", async () => {
    const doc = await PDFDocument.create();
    doc.addPage([595.276, 841.89]);
    doc.addPage([595.276, 841.89]);
    doc.addPage([595.276, 841.89]);

    const brandFont = await embedBrandFont(doc);
    stampBrandHeader(doc, brandFont);
    const reloaded = await PDFDocument.load(await doc.save());

    for (const page of reloaded.getPages()) {
      const text = drawnText(reloaded, page);
      expect(text).toBe(BRAND_HEADER.text);
      expect(text).not.toContain("©");
    }
  });

  it("fits inside the page — the domain makes the mark far longer than a bare wordmark", async () => {
    const doc = await PDFDocument.create();
    const brandFont = await embedBrandFont(doc);
    const width = brandFont.widthOfTextAtSize(BRAND_HEADER.text, BRAND_HEADER.size);
    expect(BRAND_HEADER.x + width).toBeLessThan(595.276 - 36); // must clear the right margin too
  });

  it("places the header above CONTENT_TOP, so nothing else ever draws over it", () => {
    // The whole reason stamping needs no reflow: everything else on the page
    // (_newPage, sectionHeader, _flushBanner, _draw) works downward from
    // CONTENT_TOP, so a header strictly above it can never collide.
    expect(BRAND_HEADER.y).toBeGreaterThan(CONTENT_TOP);
  });
});
