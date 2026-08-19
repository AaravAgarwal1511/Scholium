import { describe, it, expect } from "vitest";
import { mergeLines, hasBlankPageBanner, marksInRegion } from "./page-chars.js";

describe("mergeLines", () => {
  it("merges items on the same baseline into one left-to-right line", () => {
    const lines = mergeLines([
      { y: 60, x: 300, xEnd: 340, text: "PAGE" },
      { y: 60, x: 250, xEnd: 295, text: "BLANK" },
    ]);
    expect(lines).toEqual([
      { y: 60, text: "BLANK PAGE", xCenter: (250 + 340) / 2 },
    ]);
  });

  it("keeps items on different baselines as separate lines", () => {
    const lines = mergeLines([
      { y: 60, x: 250, xEnd: 340, text: "BLANK PAGE" },
      { y: 120, x: 250, xEnd: 300, text: "Some other line" },
    ]);
    expect(lines).toHaveLength(2);
  });
});

describe("hasBlankPageBanner", () => {
  const PAGE_WIDTH = 595.276;
  const CENTER = PAGE_WIDTH / 2;

  it("detects the banner near the top, centered", () => {
    const page = {
      width: PAGE_WIDTH,
      lines: [{ y: 60, text: "BLANK PAGE", xCenter: CENTER }],
    };
    expect(hasBlankPageBanner(page)).toBe(true);
  });

  it("is case-insensitive", () => {
    const page = {
      width: PAGE_WIDTH,
      lines: [{ y: 60, text: "Blank Page", xCenter: CENTER }],
    };
    expect(hasBlankPageBanner(page)).toBe(true);
  });

  it("ignores matching text that isn't near the top of the page", () => {
    const page = {
      width: PAGE_WIDTH,
      lines: [{ y: 400, text: "BLANK PAGE", xCenter: CENTER }],
    };
    expect(hasBlankPageBanner(page)).toBe(false);
  });

  it("ignores matching text that isn't horizontally centered", () => {
    const page = {
      width: PAGE_WIDTH,
      lines: [{ y: 60, text: "BLANK PAGE", xCenter: 40 }],
    };
    expect(hasBlankPageBanner(page)).toBe(false);
  });

  it("does not fire on real content that merely mentions the phrase in passing", () => {
    const page = {
      width: PAGE_WIDTH,
      lines: [{ y: 60, text: "This BLANK PAGE reference is part of a sentence", xCenter: CENTER }],
    };
    expect(hasBlankPageBanner(page)).toBe(false);
  });

  it("returns false when the page has no text at all", () => {
    const page = { width: PAGE_WIDTH, lines: [] };
    expect(hasBlankPageBanner(page)).toBe(false);
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
