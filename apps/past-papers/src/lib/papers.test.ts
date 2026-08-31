import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  parseFileName,
  paperNumOf,
  subjectDisplayName,
  estimateGenerationSeconds,
  MAX_GENERATED_QUESTIONS,
} from "./papers";

describe("parseFileName", () => {
  // Convention: {chapter}-{name}-{QP|MS}.pdf, where the name may itself contain
  // hyphens. Anything that does not match is skipped rather than guessed at.

  it("parses the documented shape", () => {
    expect(parseFileName("3-Number-and-Algebra-QP.pdf")).toEqual({
      chapterNumber: 3,
      chapterName: "Number and Algebra",
      type: "QP",
      fileName: "3-Number-and-Algebra-QP.pdf",
    });
  });

  it("reads mark schemes as well as question papers", () => {
    expect(parseFileName("7-Trigonometry-MS.pdf")?.type).toBe("MS");
  });

  it("accepts a lowercase extension and type suffix", () => {
    expect(parseFileName("2-Algebra-qp.pdf")?.type).toBe("QP");
    expect(parseFileName("2-Algebra-ms.PDF")?.type).toBe("MS");
  });

  it("collapses runs of hyphens in the chapter name", () => {
    expect(parseFileName("4-Sets--and---Probability-QP.pdf")?.chapterName).toBe(
      "Sets and Probability",
    );
  });

  it("rejects anything that is not a PDF", () => {
    expect(parseFileName("3-Number-QP.txt")).toBeNull();
    expect(parseFileName("3-Number-QP")).toBeNull();
  });

  it("rejects a missing or unknown type suffix", () => {
    expect(parseFileName("3-Number.pdf")).toBeNull();
    expect(parseFileName("3-Number-XX.pdf")).toBeNull();
  });

  it("rejects a name with no chapter separator", () => {
    expect(parseFileName("Number-QP.pdf")).toBeNull();
  });

  it("rejects an empty chapter name", () => {
    expect(parseFileName("3--QP.pdf")).toBeNull();
  });

  it("rejects a non-numeric chapter number", () => {
    expect(parseFileName("three-Number-QP.pdf")).toBeNull();
  });

  it("coerces the chapter number with Number(), quirks and all", () => {
    // Pinned rather than endorsed: the parser uses Number(), so exponent and hex
    // literals are accepted as chapter numbers. Harmless today because the
    // indexer only ever writes plain integers, but worth failing loudly if a
    // future rename starts producing names like these.
    expect(parseFileName("1e3-Number-QP.pdf")?.chapterNumber).toBe(1000);
    expect(parseFileName("0x10-Number-QP.pdf")?.chapterNumber).toBe(16);
  });
});

describe("paperNumOf", () => {
  it("reads the digits out of a component label", () => {
    expect(paperNumOf("Paper 2")).toBe(2);
    expect(paperNumOf("Paper 12")).toBe(12);
  });

  it("falls back to 0 when the label carries no number", () => {
    expect(paperNumOf("Core")).toBe(0);
    expect(paperNumOf("")).toBe(0);
  });
});

describe("subjectDisplayName", () => {
  it("maps a known subject code to its friendly name", () => {
    expect(subjectDisplayName("0607")).toBe("International Mathematics");
    expect(subjectDisplayName("0606")).toBe("Additional Mathematics");
    expect(subjectDisplayName("0580")).toBe("Mathematics");
  });

  it("passes an unknown code straight through, so a new subject still renders", () => {
    expect(subjectDisplayName("9999")).toBe("9999");
  });
});

describe("estimateGenerationSeconds", () => {
  // Only drives the progress bar, so being wrong is cosmetic — but being
  // non-monotonic or negative would show the user a countdown that goes up.

  it("has a fixed floor for an empty selection", () => {
    expect(estimateGenerationSeconds(0)).toBe(2);
  });

  it("never returns less than the floor for a negative count", () => {
    expect(estimateGenerationSeconds(-5)).toBe(2);
  });

  it("rises with the question count", () => {
    const points = [1, 5, 10, 20, 40, 80, 120].map(estimateGenerationSeconds);
    const ascending = [...points].sort((a, b) => a - b);
    expect(points).toEqual(ascending);
  });

  it("stays in the region the measurements came from", () => {
    // Measured against the live bucket: 10 questions ≈ 10.5s, 80 ≈ 91.2s.
    expect(estimateGenerationSeconds(10)).toBeCloseTo(14, 0);
    expect(estimateGenerationSeconds(80)).toBeCloseTo(94, 0);
  });
});

describe("the question cap is duplicated and must not drift", () => {
  // MAX_GENERATED_QUESTIONS only exists so the page can head the user off before
  // spending a minute on a request the server will refuse. The limit that
  // actually enforces it is MAX_QUESTIONS in server/compose-handler.js, which
  // cannot be imported here — it runs outside Vite. Same trick as
  // mock-space/src/lib/paperRetention.test.ts: read the source and compare.

  // Resolved from the package root (vitest's cwd) rather than from
  // import.meta.url: this project runs in jsdom, where Vite rewrites
  // import.meta.url to an http:// dev-server URL that node:fs cannot read.
  const handlerSource = readFileSync(
    resolve(process.cwd(), "server/compose-handler.js"),
    "utf8",
  );

  it("agrees with the server's enforced limit", () => {
    const match = handlerSource.match(/MAX_QUESTIONS\s*=\s*(\d+)/);
    expect(match, "MAX_QUESTIONS not found in server/compose-handler.js").not.toBeNull();
    expect(Number(match![1])).toBe(MAX_GENERATED_QUESTIONS);
  });

  it("is the limit the server actually rejects on", () => {
    expect(handlerSource).toMatch(/orderedIds\.length\s*>\s*MAX_QUESTIONS/);
  });
});
