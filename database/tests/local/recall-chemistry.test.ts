import { describe, it, expect, beforeAll } from "vitest";

/**
 * Chemistry content added to Recall Master (20260914000000_recall_chemistry_content.sql),
 * against the LOCAL stack. Runs via `pnpm test:db:local` (scripts/test-db-local.sh brings
 * up Docker Supabase, applies every migration in database/migrations/, seeds
 * database/seed.sql, then runs this).
 *
 * recall_chapters/recall_cards are public-read (RLS `USING (true)` + granted to anon —
 * see 20260421000000_recall_tables.sql / 20260822010000_grant_missing_table_privileges.sql),
 * so unlike language-hub-scoping.test.ts this needs no sign-in — every request here uses
 * the anon key, exactly as the deployed apps do.
 *
 * What it proves:
 *   1. The Chemistry subject/section/chapter tree lands exactly as migrated — the shape
 *      useSubjects.ts (apps/recall-app) reconstructs from recall_chapters.
 *   2. Every chapter's cards are present (73 total across 8 chapters).
 *   3. The load-bearing invariant: no chapter has two cards with the same `definition`
 *      (or the same `term`). MatchingRound (apps/recall-app/src/components/study/
 *      MatchingRound.tsx) matches Pass 1 strictly by array position — a duplicate
 *      definition lets a student correctly pick the *other* identical card and still be
 *      marked wrong. This is exactly the trap the reactivity-series table's five
 *      "no reaction" rows were collapsed into one summary card to avoid; this test is
 *      what would have caught it (and catches any future admin edit that reintroduces it).
 */

const URL_ = process.env.VITE_SUPABASE_URL ?? "";
const ANON = process.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? "";

const EXPECTED_CHAPTER_IDS = [
  "chemistry-flame-tests",
  "chemistry-cation-tests",
  "chemistry-anion-tests",
  "chemistry-gas-tests",
  "chemistry-ion-charges",
  "chemistry-industrial-catalysts",
  "chemistry-hydrated-salts",
  "chemistry-reactivity-series",
];

const EXPECTED_CARD_COUNT: Record<string, number> = {
  "chemistry-flame-tests": 6,
  "chemistry-cation-tests": 8,
  "chemistry-anion-tests": 7,
  "chemistry-gas-tests": 6,
  "chemistry-ion-charges": 26,
  "chemistry-industrial-catalysts": 6,
  "chemistry-hydrated-salts": 6,
  "chemistry-reactivity-series": 8,
};

interface ChapterRow {
  id: string;
  subject_id: string;
  subject_name: string;
  subject_emoji: string;
  section_id: string;
  section_name: string;
  name: string;
  sort_order: number;
}

interface CardRow {
  chapter_id: string;
  term: string;
  definition: string;
  sort_order: number;
}

async function selectRows<T = Record<string, unknown>>(table: string, query: string): Promise<T[]> {
  const res = await fetch(`${URL_}/rest/v1/${table}?${query}`, {
    headers: { apikey: ANON, Authorization: `Bearer ${ANON}` },
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`GET ${table}?${query} -> ${res.status}: ${text.slice(0, 300)}`);
  return JSON.parse(text) as T[];
}

let chapters: ChapterRow[] = [];
let cards: CardRow[] = [];

beforeAll(async () => {
  if (!URL_ || !ANON) {
    throw new Error(
      "VITE_SUPABASE_URL / VITE_SUPABASE_PUBLISHABLE_KEY are unset. Run this via `pnpm test:db:local` " +
        "(scripts/test-db-local.sh), which brings up the local stack and points these at it.",
    );
  }

  try {
    chapters = await selectRows<ChapterRow>(
      "recall_chapters",
      "select=id,subject_id,subject_name,subject_emoji,section_id,section_name,name,sort_order" +
        "&subject_id=eq.chemistry&order=sort_order.asc",
    );
  } catch (e) {
    throw new Error(
      `Local Supabase not reachable at ${URL_}. Start it with \`pnpm db:start\` (needs Docker), then ` +
        `\`pnpm db:reset\` to replay database/migrations/. Original error: ${(e as Error).message}`,
    );
  }

  if (chapters.length === 0) {
    throw new Error(
      "No chemistry chapters found — run `pnpm db:reset` to re-apply " +
        "20260914000000_recall_chemistry_content.sql.",
    );
  }

  const chapterIds = chapters.map((c) => c.id).join(",");
  cards = await selectRows<CardRow>(
    "recall_cards",
    `select=chapter_id,term,definition,sort_order&chapter_id=in.(${chapterIds})&order=chapter_id,sort_order.asc`,
  );
});

describe("Chemistry subject tree (recall_chapters)", () => {
  it("has exactly the eight expected chapters, in order, under one section", () => {
    expect(chapters.map((c) => c.id)).toEqual(EXPECTED_CHAPTER_IDS);
    for (const c of chapters) {
      expect(c.subject_id).toBe("chemistry");
      expect(c.subject_name).toBe("Chemistry");
      expect(c.subject_emoji).toBe("🧪");
      expect(c.section_id).toBe("chemistry-reference-tables");
      expect(c.section_name).toBe("Reference Tables");
    }
  });

  it("chapter sort_order is dense 0..7 — the order Home.tsx renders them in", () => {
    expect(chapters.map((c) => c.sort_order)).toEqual([0, 1, 2, 3, 4, 5, 6, 7]);
  });
});

describe("Chemistry cards (recall_cards)", () => {
  it("has the expected card count per chapter, 73 total", () => {
    const byChapter = new Map<string, CardRow[]>();
    for (const card of cards) {
      const list = byChapter.get(card.chapter_id) ?? [];
      list.push(card);
      byChapter.set(card.chapter_id, list);
    }

    for (const id of EXPECTED_CHAPTER_IDS) {
      expect(byChapter.get(id)?.length ?? 0).toBe(EXPECTED_CARD_COUNT[id]);
    }
    expect(cards.length).toBe(73);
  });

  it("has no two cards in the same chapter sharing a definition (Pass 1 matches by position)", () => {
    const byChapter = new Map<string, string[]>();
    for (const card of cards) {
      const list = byChapter.get(card.chapter_id) ?? [];
      list.push(card.definition);
      byChapter.set(card.chapter_id, list);
    }

    for (const [chapterId, definitions] of byChapter) {
      const unique = new Set(definitions);
      expect(unique.size, `${chapterId} has a duplicate definition`).toBe(definitions.length);
    }
  });

  it("has no two cards in the same chapter sharing a term (Pass 2 offers each term once)", () => {
    const byChapter = new Map<string, string[]>();
    for (const card of cards) {
      const list = byChapter.get(card.chapter_id) ?? [];
      list.push(card.term);
      byChapter.set(card.chapter_id, list);
    }

    for (const [chapterId, terms] of byChapter) {
      const unique = new Set(terms);
      expect(unique.size, `${chapterId} has a duplicate term`).toBe(terms.length);
    }
  });

  it("has dense 0-based sort_order within every chapter", () => {
    const byChapter = new Map<string, number[]>();
    for (const card of cards) {
      const list = byChapter.get(card.chapter_id) ?? [];
      list.push(card.sort_order);
      byChapter.set(card.chapter_id, list);
    }

    for (const [chapterId, orders] of byChapter) {
      const sorted = [...orders].sort((a, b) => a - b);
      expect(sorted, chapterId).toEqual(Array.from({ length: orders.length }, (_, i) => i));
    }
  });
});
