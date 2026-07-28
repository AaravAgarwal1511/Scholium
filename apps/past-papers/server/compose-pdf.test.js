import { describe, it, expect } from "vitest";
import {
  parsePaperNum,
  makeStem,
  paperSortKey,
  pageSpecs,
  PAPER_ORDERS,
  BOTTOM_FOOTER_SENTINEL,
  HEADER_SKIP,
} from "./compose-pdf.js";

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

describe("pageSpecs — cropping a question off its source page", () => {
  // Records are top-origin PDF points. A question that ends before the footer
  // sentinel is a single crop; one that runs to the sentinel continues onto the
  // following page(s) until the next question or the paper ends.

  it("crops a single self-contained question, applying headroom", () => {
    const q = { q: 1, page: 3, y_start: 100, y_end: 300 };
    const specs = pageSpecs(q, new Map(), new Set(), 14);
    expect(specs).toEqual([{ page: 3, yTop: 86, yBot: 286 }]); // y − headroom
  });

  it("never lets headroom push the top above the page origin", () => {
    const q = { q: 1, page: 1, y_start: 5, y_end: 300 };
    const specs = pageSpecs(q, new Map(), new Set(), 14);
    expect(specs[0].yTop).toBe(0); // max(0, 5 − 14)
  });

  it("continues onto the next page up to where the next question starts", () => {
    // q1 runs to the footer sentinel on page 2; q2 starts partway down page 3.
    const q1 = { q: 1, page: 2, y_start: 400, y_end: BOTTOM_FOOTER_SENTINEL };
    const q2 = { q: 2, page: 3, y_start: 250, y_end: 400 };
    const byQ = new Map([[2, q2]]);
    const specs = pageSpecs(q1, byQ, new Set(), 14);
    expect(specs).toEqual([
      // The FIRST crop applies headroom to y_end too, so the sentinel becomes 706.
      { page: 2, yTop: 386, yBot: BOTTOM_FOOTER_SENTINEL - 14 },
      // Continuation full pages use the raw sentinel for yBot.
      { page: 3, yTop: HEADER_SKIP, yBot: 236 }, // header-skip → next question top
    ]);
  });

  it("runs a trailing question to the footer when nothing follows", () => {
    const q = { q: 5, page: 4, y_start: 400, y_end: BOTTOM_FOOTER_SENTINEL };
    const specs = pageSpecs(q, new Map(), new Set(), 14);
    expect(specs).toEqual([
      { page: 4, yTop: 386, yBot: BOTTOM_FOOTER_SENTINEL - 14 },
      { page: 5, yTop: HEADER_SKIP, yBot: BOTTOM_FOOTER_SENTINEL },
    ]);
  });

  it("skips blank/ignored pages while continuing", () => {
    // q1 spills off page 1; page 2 is skippable; q2 sits on page 3.
    const q1 = { q: 1, page: 1, y_start: 500, y_end: BOTTOM_FOOTER_SENTINEL };
    const q2 = { q: 2, page: 3, y_start: 200, y_end: 400 };
    const specs = pageSpecs(q1, new Map([[2, q2]]), new Set([2]), 14);
    expect(specs).toEqual([
      { page: 1, yTop: 486, yBot: BOTTOM_FOOTER_SENTINEL - 14 },
      { page: 3, yTop: HEADER_SKIP, yBot: 186 },
    ]);
  });

  it("omits the continuation slice when the next question starts at the very top", () => {
    // next.y_start − headroom ≤ HEADER_SKIP means there is nothing above it to show.
    const q1 = { q: 1, page: 1, y_start: 500, y_end: BOTTOM_FOOTER_SENTINEL };
    const q2 = { q: 2, page: 2, y_start: HEADER_SKIP + 5, y_end: 300 };
    const specs = pageSpecs(q1, new Map([[2, q2]]), new Set(), 14);
    expect(specs).toEqual([{ page: 1, yTop: 486, yBot: BOTTOM_FOOTER_SENTINEL - 14 }]);
  });
});
