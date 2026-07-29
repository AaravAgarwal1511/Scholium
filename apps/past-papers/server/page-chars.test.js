import { describe, it, expect } from "vitest";
import { mergeLines, hasBlankPageBanner } from "./page-chars.js";

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
