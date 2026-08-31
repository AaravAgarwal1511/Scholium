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

const KNOWN_SUBJECT_CODES = ["0455", "0478", "0580", "0606", "0607", "0610", "0620", "0625"];

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

describe("enrichWithStats", () => {
  it("overrides the filename-derived name with the canonical one and attaches stats, for a classified chapter", () => {
    const rows = [
      { subject: "0455", component: "Paper 1", file_name: "22-Firms-Costs-Revenue-and-Objectives-QP.pdf" },
    ];
    const catalog = buildScript.buildCatalog(rows);
    const stats = {
      "0455-22": {
        canonicalName: "Firms' Costs, Revenue and Objectives",
        isUnclassified: false,
        questionCount: 166,
        yearFrom: 2018,
        yearTo: 2025,
        series: ["June", "March", "November"],
        subTopics: ["Average total cost calculation"],
      },
    };
    buildScript.enrichWithStats(catalog, stats);
    const chapter = catalog[0].components[0].chapters[0];
    expect(chapter.name).toBe("Firms' Costs, Revenue and Objectives");
    expect(chapter.stats).toEqual(stats["0455-22"]);
  });

  it("leaves the filename-derived name and sets stats to null when nothing is classified yet", () => {
    const rows = [{ subject: "0620", component: "Paper 2", file_name: "1-Atoms-QP.pdf" }];
    const catalog = buildScript.buildCatalog(rows);
    buildScript.enrichWithStats(catalog, {});
    const chapter = catalog[0].components[0].chapters[0];
    expect(chapter.name).toBe("Atoms");
    expect(chapter.stats).toBeNull();
  });

  it("never surfaces an Unclassified bucket as a real chapter's name or stats", () => {
    const rows = [{ subject: "0607", component: "Paper 2", file_name: "24-Whatever-QP.pdf" }];
    const catalog = buildScript.buildCatalog(rows);
    buildScript.enrichWithStats(catalog, {
      "0607-24": { canonicalName: "Unclassified", isUnclassified: true, questionCount: 8, yearFrom: 2014, yearTo: 2025, series: [], subTopics: [] },
    });
    const chapter = catalog[0].components[0].chapters[0];
    expect(chapter.name).toBe("Whatever");
    expect(chapter.stats).toBeNull();
  });
});

describe("selectTopicPilot", () => {
  it("picks the top N classified, non-Unclassified chapters per configured subject, sorted by question count", () => {
    const rows = [
      { subject: "0455", component: "Paper 1", file_name: "1-Low-QP.pdf" },
      { subject: "0455", component: "Paper 1", file_name: "2-High-QP.pdf" },
      { subject: "0455", component: "Paper 1", file_name: "3-Mid-QP.pdf" },
    ];
    const catalog = buildScript.buildCatalog(rows);
    buildScript.enrichWithStats(catalog, {
      "0455-1": { canonicalName: "Low", isUnclassified: false, questionCount: 10, yearFrom: 2020, yearTo: 2025, series: ["June"], subTopics: [] },
      "0455-2": { canonicalName: "High", isUnclassified: false, questionCount: 90, yearFrom: 2020, yearTo: 2025, series: ["June"], subTopics: [] },
      "0455-3": { canonicalName: "Mid", isUnclassified: false, questionCount: 50, yearFrom: 2020, yearTo: 2025, series: ["June"], subTopics: [] },
    });
    const picks = buildScript.selectTopicPilot(catalog, { "0455": 2 });
    expect(picks.map((p) => p.chapterName)).toEqual(["High", "Mid"]);
  });

  it("excludes Unclassified buckets even when they would otherwise rank highly", () => {
    const rows = [
      { subject: "0607", component: "Paper 2", file_name: "24-Junk-QP.pdf" },
      { subject: "0607", component: "Paper 2", file_name: "1-Real-QP.pdf" },
    ];
    const catalog = buildScript.buildCatalog(rows);
    buildScript.enrichWithStats(catalog, {
      "0607-24": { canonicalName: "Unclassified", isUnclassified: true, questionCount: 999, yearFrom: 2014, yearTo: 2025, series: [], subTopics: [] },
      "0607-1": { canonicalName: "Real", isUnclassified: false, questionCount: 5, yearFrom: 2020, yearTo: 2025, series: ["June"], subTopics: [] },
    });
    const picks = buildScript.selectTopicPilot(catalog, { "0607": 5 });
    expect(picks.map((p) => p.chapterName)).toEqual(["Real"]);
  });

  it("lists every component that examines a shared topic, ordered by paper number", () => {
    const rows = [
      { subject: "0455", component: "Paper 2", file_name: "1-Demand-QP.pdf" },
      { subject: "0455", component: "Paper 1", file_name: "1-Demand-QP.pdf" },
    ];
    const catalog = buildScript.buildCatalog(rows);
    buildScript.enrichWithStats(catalog, {
      "0455-1": { canonicalName: "Demand", isUnclassified: false, questionCount: 40, yearFrom: 2020, yearTo: 2025, series: ["June"], subTopics: [] },
    });
    const picks = buildScript.selectTopicPilot(catalog, { "0455": 1 });
    expect(picks[0].featuredIn.map((c) => c.raw)).toEqual(["Paper 1", "Paper 2"]);
  });

  it("skips subjects with no configured pilot count", () => {
    const rows = [{ subject: "0620", component: "Paper 2", file_name: "1-Atoms-QP.pdf" }];
    const catalog = buildScript.buildCatalog(rows);
    buildScript.enrichWithStats(catalog, {
      "0620-1": { canonicalName: "Atoms", isUnclassified: false, questionCount: 40, yearFrom: 2020, yearTo: 2025, series: ["June"], subTopics: [] },
    });
    expect(buildScript.selectTopicPilot(catalog, { "0455": 5 })).toEqual([]);
  });
});

describe("computeLastMod", () => {
  it("takes the max created_at per subject and per (subject, component)", () => {
    const rows = [
      { subject: "0455", component: "Paper 1", file_name: "a", created_at: "2026-01-01T00:00:00Z" },
      { subject: "0455", component: "Paper 1", file_name: "b", created_at: "2026-03-01T00:00:00Z" },
      { subject: "0455", component: "Paper 2", file_name: "c", created_at: "2026-02-01T00:00:00Z" },
    ];
    const { bySubject, byComponent } = buildScript.computeLastMod(rows);
    expect(bySubject.get("0455")).toBe("2026-03-01T00:00:00Z");
    // Keyed with a NUL separator (never a legal subject-code or component-label
    // character) rather than a plain space, matching the lookup in renderSitemap.
    expect(byComponent.get("0455 Paper 1")).toBe("2026-03-01T00:00:00Z");
    expect(byComponent.get("0455 Paper 2")).toBe("2026-02-01T00:00:00Z");
  });

  it("ignores rows with no created_at rather than treating them as newest", () => {
    const rows = [{ subject: "0455", component: "Paper 1", file_name: "a" }];
    const { bySubject } = buildScript.computeLastMod(rows);
    expect(bySubject.has("0455")).toBe(false);
  });
});

describe("truncateWords", () => {
  it("returns text unchanged when already within budget", () => {
    expect(buildScript.truncateWords("short text", 100)).toBe("short text");
  });

  it("truncates at a word boundary and appends an ellipsis when over budget", () => {
    const long = "This description runs on for quite a while and needs trimming to a sane length";
    const result = buildScript.truncateWords(long, 40);
    expect(result.length).toBeLessThanOrEqual(41); // budget + the ellipsis character
    expect(result.endsWith("…")).toBe(true);
    expect(result.endsWith(" …")).toBe(false); // no trailing space before the ellipsis
  });
});
