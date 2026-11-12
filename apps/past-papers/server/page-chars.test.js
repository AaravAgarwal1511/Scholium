import { describe, it, expect } from "vitest";
import { regionHasContent, tightenBottom, marksInRegion } from "./page-chars.js";

// Real 0606 geometry: the page number sits on a ~47pt baseline, the next
// question's marker ~60pt below the top, the © footer ~805pt down an 842pt page.
const A4_HEIGHT = 841.89;
const CONTENT_OPTS = { headerSkip: 45, footerSkip: 50, minChars: 8 };

describe("regionHasContent", () => {
  it("treats a header-only sliver (page number alone) as blank", () => {
    const page = { height: A4_HEIGHT, runs: [{ y: 47, bottom: 50, n: 2 }] };
    expect(regionHasContent(page, 0, 62, CONTENT_OPTS)).toBe(false);
  });

  it("keeps a run-on crop carrying real question text", () => {
    const page = {
      height: A4_HEIGHT,
      runs: [
        { y: 47, bottom: 50, n: 2 },
        { y: 73, bottom: 76, n: 30 },
      ],
    };
    expect(regionHasContent(page, 0, 300, CONTENT_OPTS)).toBe(true);
  });

  it("ignores the © footer band", () => {
    const page = { height: A4_HEIGHT, runs: [{ y: 805, bottom: 808, n: 30 }] };
    expect(regionHasContent(page, 0, null, CONTENT_OPTS)).toBe(false);
  });
});

describe("tightenBottom", () => {
  const TIGHTEN = { footerSkip: 50, pad: 5 };

  it("pulls an open-ended crop up to the last content line, above the footer", () => {
    const page = {
      height: A4_HEIGHT,
      runs: [
        { y: 80, bottom: 83, n: 20 },
        { y: 300, bottom: 303, n: 3 },
        { y: 805, bottom: 808, n: 30 },
      ],
    };
    expect(tightenBottom(page, 60, null, TIGHTEN)).toBe(308);
  });

  it("leaves the crop alone when the region holds no text", () => {
    const page = { height: A4_HEIGHT, runs: [] };
    expect(tightenBottom(page, 60, null, TIGHTEN)).toBe(null);
  });
});

describe("marksInRegion", () => {
  const HEIGHT = 842;

  it("reads the bracketed mark allocation off a line inside the region", () => {
    const page = { height: HEIGHT, lines: [{ y: 254.8, text: "Answer(b) [1]" }] };
    expect(marksInRegion(page, 200, 300)).toEqual([{ y: 254.8, i: 0, marks: 1 }]);
  });

  it("ignores lines outside the region", () => {
    const page = { height: HEIGHT, lines: [{ y: 100, text: "Answer(a) [2]" }] };
    expect(marksInRegion(page, 200, 300)).toEqual([]);
  });

  it("a null yBot runs to the bottom of the page", () => {
    const page = { height: HEIGHT, lines: [{ y: 800, text: "Answer $ [3]" }] };
    expect(marksInRegion(page, 200, null)).toEqual([{ y: 800, i: 0, marks: 3 }]);
  });

  it("reads two tokens on the same line and orders them by position", () => {
    const page = {
      height: HEIGHT,
      lines: [{ y: 300, text: "1 (a) [2] (b) [4]" }],
    };
    expect(marksInRegion(page, 0, HEIGHT)).toEqual([
      { y: 300, i: 0, marks: 2 },
      { y: 300, i: 1, marks: 4 },
    ]);
  });

  it("ignores page furniture that carries no bracketed digits", () => {
    const page = {
      height: HEIGHT,
      lines: [
        { y: 803.6, text: "© UCLES 2014 0607/21/M/J/14 [Turn over" },
        { y: 46.4, text: "3" },
      ],
    };
    expect(marksInRegion(page, 0, HEIGHT)).toEqual([]);
  });
});
