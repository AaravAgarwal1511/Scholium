import { describe, expect, it } from "vitest";
import { subjectDisplayName, isSubjectDisabled, parseFileName, paperNumOf } from "./papers";
// scripts/build-subject-pages.js duplicates these — see its header comment for
// why (it's a plain Node ESM script; papers.ts is TS with a browser-coupled
// Supabase client import at module scope, so this repo has no runtime that
// can `import` both). This test is what keeps the duplication honest: it
// imports the real script (its `main()` only runs when invoked directly, see
// the `isMain` guard at the bottom of the file, so importing it here is
// side-effect-free) and asserts both implementations agree on every input
// that matters. Same pattern as
// apps/mock-space/src/lib/paperRetention.test.ts for api/prune-papers.js.
import * as buildScript from "../../scripts/build-subject-pages.js";

const KNOWN_SUBJECT_CODES = ["0455", "0478", "0606", "0607", "0610", "0620", "0625"];

describe("build-subject-pages.js agrees with src/lib/papers.ts", () => {
  it("resolves the same display name for every known subject, and the same unknown-code fallback", () => {
    for (const code of [...KNOWN_SUBJECT_CODES, "9999"]) {
      expect(buildScript.subjectDisplayName(code)).toBe(subjectDisplayName(code));
    }
  });

  it("agrees on which subjects are disabled", () => {
    for (const code of KNOWN_SUBJECT_CODES) {
      expect(buildScript.isSubjectDisabled(code)).toBe(isSubjectDisabled(code));
    }
  });

  it("parses filenames identically, including the QP/MS and multi-hyphen-name cases", () => {
    const samples = [
      "3-Number-and-Algebra-QP.pdf",
      "3-Number-and-Algebra-MS.pdf",
      "12-Forces-and-Motion-QP.pdf",
      "not-a-pdf.txt",
      "no-type-suffix.pdf",
      "1-Cell Biology-QP.pdf",
    ];
    for (const name of samples) {
      expect(buildScript.parseFileName(name)).toEqual(parseFileName(name));
    }
  });

  it("extracts the same paper number from a component label", () => {
    for (const component of ["Paper 1", "Paper 2", "Paper 10", "No Digits Here"]) {
      expect(buildScript.paperNumOf(component)).toBe(paperNumOf(component));
    }
  });
});

describe("buildCatalog", () => {
  it("groups rows into subject → component → chapter, dropping components with no parseable chapters", () => {
    const rows = [
      { subject: "0610", component: "Paper 2", file_name: "1-Cell Biology-QP.pdf" },
      { subject: "0610", component: "Paper 2", file_name: "1-Cell Biology-MS.pdf" },
      { subject: "0610", component: "Paper 2", file_name: "2-Homeostasis-QP.pdf" },
      { subject: "0610", component: "Paper 1", file_name: "not-a-pdf.txt" }, // no parseable chapters
      { subject: "0625", component: "Paper 3", file_name: "1-Forces-QP.pdf" },
    ];
    const catalog = buildScript.buildCatalog(rows);

    expect(catalog.map((s) => s.code)).toEqual(["0610", "0625"]);
    const biology = catalog.find((s) => s.code === "0610")!;
    expect(biology.displayName).toBe("Biology");
    // Paper 1 dropped: it had a file, but nothing parseFileName could read as a chapter.
    expect(biology.components.map((c) => c.raw)).toEqual(["Paper 2"]);
    expect(biology.components[0].chapters).toEqual([
      { number: 1, name: "Cell Biology" },
      { number: 2, name: "Homeostasis" },
    ]);
  });

  it("slugifies component labels for use in URLs", () => {
    const rows = [{ subject: "0620", component: "Paper 2", file_name: "1-Atoms-QP.pdf" }];
    const catalog = buildScript.buildCatalog(rows);
    expect(catalog[0].components[0].slug).toBe("paper-2");
  });
});
