import { describe, it, expect } from "vitest";
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
} from "./compose-pdf.js";

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
// crops are actually worth, read straight off the source PDF's own "[n]" text
// (see marksInRegion in page-chars.js) since questions_metadata carries no
// marks column at all.
describe("collectQuestionMarks — per-question mark aggregation", () => {
  // A minimal stand-in for makeCache()'s `{ bytes, chars }` pair: `pages` maps
  // page number → the {lines, height} shape marksInRegion reads, keyed exactly
  // as cache.chars.pageChars(key, bytes, pageNum) would resolve it.
  function fakeCache(pages, { throws = false } = {}) {
    const srcDoc = {};
    const cache = {
      bytes: new Map([[srcDoc, { key: "stem", bytes: null }]]),
      chars: {
        async pageChars(_key, _bytes, pageNum) {
          if (throws) throw new Error("pdf.js blew up");
          return pages[pageNum] ?? { lines: [], height: 842 };
        },
      },
    };
    return { cache, srcDoc };
  }

  it("sums the [n] tokens found across a question's kept crops", async () => {
    const { cache, srcDoc } = fakeCache({
      2: { height: 842, lines: [{ y: 300, text: "(a) [2]" }] },
      3: { height: 842, lines: [{ y: 100, text: "(b) [4]" }] },
    });
    const collector = { total: 0, seen: new Set(), unreadable: false };
    await collectQuestionMarks(
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

  it("falls back to 1 mark for a question with no readable token (the MCQ convention)", async () => {
    const { cache, srcDoc } = fakeCache({
      5: { height: 842, lines: [{ y: 200, text: "1 A" }] },
    });
    const collector = { total: 0, seen: new Set(), unreadable: false };
    await collectQuestionMarks(cache, srcDoc, [{ page: 5, yTop: 0, yBot: null }], collector);
    expect(collector.total).toBe(1);
  });

  it("dedupes a token seen through two overlapping crops (e.g. a stem crop and its sub-part)", async () => {
    const { cache, srcDoc } = fakeCache({
      4: { height: 842, lines: [{ y: 150, text: "(a) [3]" }] },
    });
    const collector = { total: 0, seen: new Set(), unreadable: false };
    // Two specs on the same page whose y-ranges both cover y=150 — the stem crop
    // (0..842) and a narrower sub-part crop (100..300) both "see" the same line.
    await collectQuestionMarks(
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

  it("accumulates across repeated calls, as renderSection does across a whole section", async () => {
    const { cache, srcDoc } = fakeCache({
      1: { height: 842, lines: [{ y: 90, text: "[5]" }] },
      2: { height: 842, lines: [{ y: 90, text: "[7]" }] },
    });
    const collector = { total: 0, seen: new Set(), unreadable: false };
    await collectQuestionMarks(cache, srcDoc, [{ page: 1, yTop: 0, yBot: null }], collector);
    await collectQuestionMarks(cache, srcDoc, [{ page: 2, yTop: 0, yBot: null }], collector);
    expect(collector.total).toBe(12);
  });

  it("marks the collector unreadable, rather than guessing, when the text layer throws", async () => {
    const { cache, srcDoc } = fakeCache({}, { throws: true });
    const collector = { total: 0, seen: new Set(), unreadable: false };
    await collectQuestionMarks(cache, srcDoc, [{ page: 1, yTop: 0, yBot: null }], collector);
    expect(collector.unreadable).toBe(true);
    expect(collector.total).toBe(0);
  });

  it("marks the collector unreadable when the source bytes were never cached for this doc", async () => {
    const collector = { total: 0, seen: new Set(), unreadable: false };
    await collectQuestionMarks({ bytes: new Map() }, {}, [{ page: 1, yTop: 0, yBot: null }], collector);
    expect(collector.unreadable).toBe(true);
  });
});
