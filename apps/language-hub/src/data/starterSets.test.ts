import { describe, it, expect } from "vitest";
import { STARTER_SETS, type StarterSetItem } from "./starterSets";

// The item lists live one-file-per-set in ./starter-sets/*.json and are loaded
// lazily at runtime (see the module comment). Pull them all in eagerly *here* so
// the invariants below cover every card without shipping the corpus to the app.
const ITEM_FILES = import.meta.glob<{ id: string; items: StarterSetItem[] }>(
  "./starter-sets/*.json",
  { eager: true },
);

const itemsById = new Map<string, StarterSetItem[]>();
const fileIdMismatches: string[] = [];
for (const [path, mod] of Object.entries(ITEM_FILES)) {
  const fileId = path.replace(/^\.\/starter-sets\//, "").replace(/\.json$/, "");
  if (mod.id !== fileId) fileIdMismatches.push(`${path} declares id "${mod.id}"`);
  itemsById.set(fileId, mod.items);
}

describe("STARTER_SETS catalog", () => {
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

  it("gives every set a name, description and topic", () => {
    for (const set of STARTER_SETS) {
      expect(set.name.trim(), set.id).not.toBe("");
      expect(set.description.trim(), set.id).not.toBe("");
      expect(set.topic.trim(), set.id).not.toBe("");
    }
  });

  it("names each set after its language", () => {
    // e2e/starter-sets.spec.ts asserts the imported set's name contains "French";
    // the Create/Edit language selectors also read the prefix.
    for (const set of STARTER_SETS) {
      const word = set.language === "french" ? "French" : "Spanish";
      expect(set.name, set.id).toContain(word);
    }
  });
});

describe("STARTER_SETS ↔ starter-sets/*.json", () => {
  it("pairs every catalog entry with exactly one JSON file, and vice versa", () => {
    const catalogIds = new Set(STARTER_SETS.map((s) => s.id));
    const fileIds = new Set(itemsById.keys());
    const missingFile = [...catalogIds].filter((id) => !fileIds.has(id));
    const orphanFile = [...fileIds].filter((id) => !catalogIds.has(id));
    expect(missingFile, "catalog entries with no JSON file").toEqual([]);
    expect(orphanFile, "JSON files with no catalog entry").toEqual([]);
  });

  it("gives each JSON file an `id` matching its filename", () => {
    expect(fileIdMismatches).toEqual([]);
  });

  it("keeps catalog `count` equal to the real item count", () => {
    for (const set of STARTER_SETS) {
      expect(itemsById.get(set.id)?.length, `count for ${set.id}`).toBe(set.count);
    }
  });

  it("keeps catalog `preview` equal to the first five items", () => {
    for (const set of STARTER_SETS) {
      const items = itemsById.get(set.id) ?? [];
      expect(set.preview, `preview for ${set.id}`).toEqual(items.slice(0, 5));
    }
  });
});

describe("starter-sets/*.json contents", () => {
  it("has a non-empty item list per set", () => {
    for (const [id, items] of itemsById) {
      expect(items.length, id).toBeGreaterThan(0);
    }
  });

  it("has no empty or untrimmed terms or definitions", () => {
    for (const [id, items] of itemsById) {
      for (const item of items) {
        expect(item.term, `term in ${id}`).toBe(item.term.trim());
        expect(item.definition, `definition in ${id}`).toBe(item.definition.trim());
        expect(item.term, id).not.toBe("");
        expect(item.definition, id).not.toBe("");
      }
    }
  });

  it("has no duplicate term within a set", () => {
    for (const [id, items] of itemsById) {
      const terms = items.map((i) => i.term);
      expect(new Set(terms).size, `duplicate term in ${id}`).toBe(terms.length);
    }
  });

  it("has no duplicate term across sets of the same language", () => {
    // A term landing in two topics of one language is a curation slip — the
    // source repeats ~110 terms across its sheets and they must be placed once.
    const byLanguage = new Map<string, Map<string, string>>();
    for (const set of STARTER_SETS) {
      const seen = byLanguage.get(set.language) ?? new Map<string, string>();
      byLanguage.set(set.language, seen);
      for (const item of itemsById.get(set.id) ?? []) {
        const prior = seen.get(item.term);
        expect(prior, `"${item.term}" is in both ${prior} and ${set.id}`).toBeUndefined();
        seen.set(item.term, set.id);
      }
    }
  });

  it("parses cleanly with the ' : ' separator the Create/Edit forms use", () => {
    // CreateSet/EditSet round-trip a set as `term : definition` lines. A term
    // containing " : " would split wrong on re-import, so forbid it.
    for (const [id, items] of itemsById) {
      for (const item of items) {
        expect(item.term.includes(" : "), `"${item.term}" in ${id} holds the separator`).toBe(
          false,
        );
      }
    }
  });
});
