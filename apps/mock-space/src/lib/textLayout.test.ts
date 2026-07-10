import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { beforeAll, describe, expect, it } from "vitest";
import { PDFDocument, type PDFFont } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import { createMetrics, LINE_HEIGHT_RATIO, type Metrics } from "./metrics";
import {
  addStrike,
  isRangeStruck,
  isStruck,
  layoutText,
  prefixWidths,
  segmentLine,
  widthOf,
  wordAt,
} from "./textLayout";

const require = createRequire(import.meta.url);
const TTF_PATH = require.resolve("dejavu-fonts-ttf/ttf/DejaVuSans.ttf");

let font: PDFFont;
let metrics: Metrics;

beforeAll(async () => {
  const doc = await PDFDocument.create();
  doc.registerFontkit(fontkit);
  font = await doc.embedFont(readFileSync(TTF_PATH), { subset: true });
  metrics = createMetrics(font);
});

// The whole design rests on these two properties of pdf-lib. If a pdf-lib upgrade
// breaks either one, the export silently stops matching the screen — so assert
// them rather than trusting them.
describe("pdf-lib measurement invariants", () => {
  it("sums advance widths without kerning or ligatures", () => {
    for (const word of ["AV", "To", "Wa", "fi", "mitochondria"]) {
      const whole = font.widthOfTextAtSize(word, 12);
      const sum = [...word].reduce((a, c) => a + font.widthOfTextAtSize(c, 12), 0);
      expect(whole).toBeCloseTo(sum, 10);
    }
  });

  it("exposes fontkit vertical metrics through the embedder", () => {
    expect(() => metrics.baselineOffset(12)).not.toThrow();
    // DejaVu Sans: ascent 1901, descent -483, unitsPerEm 2048.
    const content = ((1901 + 483) / 2048) * 12;
    const expected = (12 * LINE_HEIGHT_RATIO - content) / 2 + (1901 / 2048) * 12;
    expect(metrics.baselineOffset(12)).toBeCloseTo(expected, 10);
  });

  it("covers every glyph in the symbol palette", () => {
    const palette = "°±×÷→≤≥≈²³½¼¾ΔαβγθλμπσΩ∴√∞∫Σ−·⁻⇌↔∝∠⊥∈∅";
    for (const ch of palette) {
      expect(metrics.charWidth(ch, 12), `missing glyph ${ch}`).toBeGreaterThan(0);
    }
  });
});

describe("prefixWidths", () => {
  it("is exact and monotonic", () => {
    const text = "the enzyme denatures";
    const prefix = prefixWidths(text, 11, metrics);
    expect(prefix).toHaveLength(text.length + 1);
    expect(prefix[0]).toBe(0);
    expect(prefix[text.length]).toBeCloseTo(font.widthOfTextAtSize(text, 11), 10);
    for (let i = 1; i < prefix.length; i++) expect(prefix[i]).toBeGreaterThanOrEqual(prefix[i - 1]);
  });

  it("agrees with pdf-lib for arbitrary substrings", () => {
    const text = "above 40°C the rate falls";
    const prefix = prefixWidths(text, 11, metrics);
    for (const [a, b] of [[0, 5], [6, 10], [4, 20], [0, text.length]]) {
      expect(widthOf(prefix, a, b)).toBeCloseTo(font.widthOfTextAtSize(text.slice(a, b), 11), 10);
    }
  });
});

describe("layoutText", () => {
  const fit = (text: string, maxWidth: number) => {
    const l = layoutText(text, 11, maxWidth, metrics);
    return l.lines.map((r) => text.slice(r.start, r.end));
  };

  it("returns a single empty line for empty text, so the caret has somewhere to sit", () => {
    const l = layoutText("", 11, 200, metrics);
    expect(l.lines).toEqual([{ start: 0, end: 0 }]);
  });

  it("does not wrap text that fits", () => {
    expect(fit("short answer", 500)).toEqual(["short answer"]);
  });

  it("breaks after a space, keeping the space on the line it ends", () => {
    const width = font.widthOfTextAtSize("hello ", 11) + 1;
    expect(fit("hello world", width)).toEqual(["hello ", "world"]);
  });

  it("honours hard newlines and drops the newline character", () => {
    expect(fit("a\nb", 500)).toEqual(["a", "b"]);
    expect(fit("a\n\nb", 500)).toEqual(["a", "", "b"]);
  });

  it("emits a trailing empty line for trailing newline", () => {
    expect(fit("a\n", 500)).toEqual(["a", ""]);
  });

  it("hard-breaks a single word wider than the box", () => {
    const lines = fit("supercalifragilistic", font.widthOfTextAtSize("super", 11) + 0.5);
    expect(lines.length).toBeGreaterThan(1);
    expect(lines.join("")).toBe("supercalifragilistic");
  });

  it("never produces a line wider than the box, ignoring trailing spaces", () => {
    const text =
      "The mitochondrion is the powerhouse of the cell and denatures above forty degrees";
    const maxWidth = 120;
    const l = layoutText(text, 11, maxWidth, metrics);
    for (const line of l.lines) {
      const trimmedEnd = text.slice(line.start, line.end).replace(/ +$/, "").length + line.start;
      expect(widthOf(l.prefix, line.start, trimmedEnd)).toBeLessThanOrEqual(maxWidth + 1e-9);
    }
  });

  it("loses no characters other than newlines", () => {
    const text = "alpha beta gamma delta epsilon zeta eta theta";
    const l = layoutText(text, 11, 90, metrics);
    expect(l.lines.map((r) => text.slice(r.start, r.end)).join("")).toBe(text);
  });
});

describe("addStrike", () => {
  it("inserts in order", () => {
    let s = addStrike([], 5, 8);
    s = addStrike(s, 0, 2);
    expect(s).toEqual([{ start: 0, end: 2 }, { start: 5, end: 8 }]);
  });

  it("merges overlapping ranges", () => {
    let s = addStrike([], 0, 5);
    s = addStrike(s, 3, 9);
    expect(s).toEqual([{ start: 0, end: 9 }]);
  });

  it("coalesces touching ranges", () => {
    let s = addStrike([], 0, 4);
    s = addStrike(s, 4, 7);
    expect(s).toEqual([{ start: 0, end: 7 }]);
  });

  it("swallows ranges it spans", () => {
    let s = addStrike([], 2, 3);
    s = addStrike(s, 6, 7);
    s = addStrike(s, 0, 10);
    expect(s).toEqual([{ start: 0, end: 10 }]);
  });

  it("ignores empty ranges", () => {
    expect(addStrike([], 4, 4)).toEqual([]);
  });
});

describe("isStruck / segmentLine", () => {
  it("reports membership on half-open ranges", () => {
    const s = [{ start: 2, end: 5 }];
    expect([0, 1, 2, 3, 4, 5, 6].map((i) => isStruck(s, i))).toEqual([
      false, false, true, true, true, false, false,
    ]);
  });

  it("splits a line into maximal runs", () => {
    const runs = segmentLine({ start: 0, end: 8 }, [{ start: 2, end: 5 }]);
    expect(runs).toEqual([
      { start: 0, end: 2, struck: false, selected: false },
      { start: 2, end: 5, struck: true, selected: false },
      { start: 5, end: 8, struck: false, selected: false },
    ]);
  });

  it("returns one run when nothing is struck", () => {
    expect(segmentLine({ start: 0, end: 4 }, [])).toEqual([
      { start: 0, end: 4, struck: false, selected: false },
    ]);
  });

  it("returns nothing for an empty line", () => {
    expect(segmentLine({ start: 3, end: 3 }, [])).toEqual([]);
  });

  it("clips strike ranges to the line", () => {
    const runs = segmentLine({ start: 4, end: 8 }, [{ start: 0, end: 6 }]);
    expect(runs).toEqual([
      { start: 4, end: 6, struck: true, selected: false },
      { start: 6, end: 8, struck: false, selected: false },
    ]);
  });

  it("splits on selection boundaries as well as strike boundaries", () => {
    const runs = segmentLine({ start: 0, end: 6 }, [{ start: 0, end: 3 }], { start: 2, end: 4 });
    expect(runs).toEqual([
      { start: 0, end: 2, struck: true, selected: false },
      { start: 2, end: 3, struck: true, selected: true },
      { start: 3, end: 4, struck: false, selected: true },
      { start: 4, end: 6, struck: false, selected: false },
    ]);
  });
});

describe("isRangeStruck", () => {
  it("is true only when every character is struck", () => {
    expect(isRangeStruck([{ start: 0, end: 5 }], 1, 4)).toBe(true);
    expect(isRangeStruck([{ start: 0, end: 3 }], 1, 4)).toBe(false);
    expect(isRangeStruck([], 0, 2)).toBe(false);
  });

  it("is false for an empty range", () => {
    expect(isRangeStruck([{ start: 0, end: 5 }], 2, 2)).toBe(false);
  });
});

describe("wordAt", () => {
  //          0123456789...
  const text = "the mitochondira is"; // "mitochondira" is [4,16), "is" is [17,19)
  it("expands to whitespace-delimited words", () => {
    expect(wordAt(text, 6)).toEqual({ start: 4, end: 16 });
    expect(wordAt(text, 0)).toEqual({ start: 0, end: 3 });
    expect(wordAt(text, 18)).toEqual({ start: 17, end: 19 });
  });

  it("returns null on whitespace and out of range", () => {
    expect(wordAt(text, 3)).toBeNull();
    expect(wordAt(text, 16)).toBeNull();
    expect(wordAt(text, -1)).toBeNull();
    expect(wordAt(text, text.length)).toBeNull();
  });
});
