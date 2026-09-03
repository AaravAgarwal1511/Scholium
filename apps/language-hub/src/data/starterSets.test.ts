import { describe, it, expect } from "vitest";
import { STARTER_SETS } from "./starterSets";

describe("STARTER_SETS", () => {
  it("has at least one set per supported language", () => {
    const langs = new Set(STARTER_SETS.map((s) => s.language));
    expect(langs).toContain("french");
    expect(langs).toContain("spanish");
  });

  it("uses only the two languages the app understands", () => {
    for (const set of STARTER_SETS) {
      expect(["french", "spanish"]).toContain(set.language);
    }
  });

  it("has unique ids", () => {
    const ids = STARTER_SETS.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("gives every set a name, description and a non-empty item list", () => {
    for (const set of STARTER_SETS) {
      expect(set.name.trim()).not.toBe("");
      expect(set.description.trim()).not.toBe("");
      expect(set.items.length).toBeGreaterThan(0);
    }
  });

  it("has no empty or untrimmed terms or definitions", () => {
    for (const set of STARTER_SETS) {
      for (const item of set.items) {
        expect(item.term, `term in ${set.id}`).toBe(item.term.trim());
        expect(item.definition, `definition in ${set.id}`).toBe(item.definition.trim());
        expect(item.term).not.toBe("");
        expect(item.definition).not.toBe("");
      }
    }
  });

  it("has no duplicate term within a set", () => {
    for (const set of STARTER_SETS) {
      const terms = set.items.map((i) => i.term);
      expect(new Set(terms).size, `duplicate term in ${set.id}`).toBe(terms.length);
    }
  });

  it("parses cleanly with the ' : ' separator the Create/Edit forms use", () => {
    // CreateSet/EditSet round-trip a set as `term : definition` lines. A term or
    // definition containing " : " would split wrong on re-import, so forbid it.
    for (const set of STARTER_SETS) {
      for (const item of set.items) {
        expect(item.term.includes(" : "), `"${item.term}" holds the separator`).toBe(false);
      }
    }
  });
});
