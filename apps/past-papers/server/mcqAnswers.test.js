import { describe, it, expect } from "vitest";
import { answerInRegion } from "./mcqAnswers.js";

describe("answerInRegion", () => {
  const HEIGHT = 842;

  // Real row shape, byte-for-byte, from 0625 Paper 2 June 2018 (verified
  // against the live source PDF via contentStreamTextLines) and reproduced
  // in 0455 Paper 1 / 0610 Paper 2 / 0620 Paper 2 alike.
  it("reads the answer off a real multiple-choice mark-scheme row", () => {
    const page = { height: HEIGHT, lines: [{ y: 103.14, text: "1 A 1" }] };
    expect(answerInRegion(page, 90, 120, "1")).toBe("A");
  });

  it("matches the row by its leading question number, not just any A–D row", () => {
    const page = {
      height: HEIGHT,
      lines: [
        { y: 103.14, text: "1 A 1" },
        { y: 127.62, text: "2 C 1" },
      ],
    };
    expect(answerInRegion(page, 0, HEIGHT, "2")).toBe("C");
  });

  it("handles a double-digit question number and marks value", () => {
    const page = { height: HEIGHT, lines: [{ y: 592.14, text: "27 D 12" }] };
    expect(answerInRegion(page, 580, 600, "27")).toBe("D");
  });

  it("a null yBot runs to the bottom of the page", () => {
    const page = { height: HEIGHT, lines: [{ y: 800, text: "40 B 1" }] };
    expect(answerInRegion(page, 700, null, "40")).toBe("B");
  });

  it("ignores lines outside the region", () => {
    const page = { height: HEIGHT, lines: [{ y: 100, text: "1 A 1" }] };
    expect(answerInRegion(page, 200, 300, "1")).toBeNull();
  });

  it("returns null for a bracketed mark token — the structured-paper shape", () => {
    const page = { height: HEIGHT, lines: [{ y: 254.8, text: "Answer(b) [1]" }] };
    expect(answerInRegion(page, 200, 300, "1")).toBeNull();
  });

  it("returns null for prose, even when it contains a lone A–D word mid-sentence", () => {
    const page = {
      height: HEIGHT,
      lines: [{ y: 100, text: "1 mark for each correct conversion: 3" }],
    };
    expect(answerInRegion(page, 0, HEIGHT, "1")).toBeNull();
  });

  it("returns null for a region with no lines at all", () => {
    expect(answerInRegion({ height: HEIGHT, lines: [] }, 0, HEIGHT, "1")).toBeNull();
  });

  it("returns null when two rows in the region both read as a bare letter", () => {
    // Ambiguous crop — headroom swept in a neighbouring row and the label got
    // clipped off both, so there is no way to tell which belongs to qLabel.
    const page = {
      height: HEIGHT,
      lines: [
        { y: 100, text: "A" },
        { y: 124, text: "C" },
      ],
    };
    expect(answerInRegion(page, 0, HEIGHT, "1")).toBeNull();
  });

  it("falls back to a bare letter when the label was clipped off its own row", () => {
    const page = { height: HEIGHT, lines: [{ y: 100, text: "A" }] };
    expect(answerInRegion(page, 0, HEIGHT, "1")).toBe("A");
  });

  it("rejects a row naming a letter outside A–D", () => {
    const page = { height: HEIGHT, lines: [{ y: 100, text: "1 E 1" }] };
    expect(answerInRegion(page, 0, HEIGHT, "1")).toBeNull();
  });
});
