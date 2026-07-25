import { describe, it, expect } from "vitest";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";

/**
 * Authorised behaviour of the admin_* RPCs — the other half of anon-access.test.ts,
 * which only proves they REJECT the anon key. Here they run as the real admin and
 * must do the right thing: swaps stay consistent, saves persist chapter + cards,
 * deletes cascade, the disabled flag toggles. And a signed-in NON-admin is still
 * rejected (the gap between "anonymous" and "the admin").
 *
 * SAFETY: every RPC call runs inside `begin … rollback`, in a single CLI round
 * trip, so nothing is ever committed — production content is untouched even though
 * these are mutating calls. Test rows use a `__test_` id prefix that cannot collide
 * with real slugs. The admin is impersonated by setting request.jwt.claims to the
 * admin's real uid (discovered at run time from the email in the committed
 * migration); _assert_admin then reads that user's email and passes. No password,
 * no session, no new auth row.
 */

const SUPABASE_BIN = path.resolve(process.cwd(), "node_modules/.bin/supabase");

function cli(sql: string): unknown[] {
  let stdout: string;
  try {
    stdout = execFileSync(SUPABASE_BIN, ["db", "query", "--linked", sql], {
      encoding: "utf8",
      timeout: 60_000,
      maxBuffer: 32 * 1024 * 1024,
      stdio: ["ignore", "pipe", "pipe"],
    });
  } catch (e) {
    // A SQL error makes the CLI exit non-zero; the error JSON is still on stdout.
    // Surface it (so "not authorized" is assertable) rather than the exec wrapper.
    stdout = (e as { stdout?: Buffer | string }).stdout?.toString() ?? "";
    if (!stdout) throw e;
  }
  const start = stdout.indexOf("{");
  if (start === -1) throw new Error(`no JSON in CLI output: ${stdout.slice(0, 300)}`);
  const parsed = JSON.parse(stdout.slice(start)) as { rows?: unknown[]; error?: unknown };
  if (parsed.error) throw new Error(`db error: ${JSON.stringify(parsed.error).slice(0, 400)}`);
  return parsed.rows ?? [];
}

/** The admin email is whatever the live _assert_admin gates on; read it from the
 *  committed migration rather than hardcoding PII in the test. */
function adminEmail(): string {
  // test:db runs from the repo root, so the migration is under database/ directly.
  const sql = readFileSync(
    path.resolve(process.cwd(), "database/migrations/20260724000000_fix_assert_admin_null_bypass.sql"),
    "utf8",
  );
  const m = sql.match(/IS DISTINCT FROM\s+'([^']+)'/i);
  if (!m) throw new Error("could not find admin email in the migration");
  return m[1];
}

// Discovered at module load, NOT in beforeAll: describe.skipIf() is evaluated when
// the file is collected, before any hook runs, so the flag must be set by then.
let adminUid = "";
let available = false;
try {
  const rows = cli(`select id::text as uid from auth.users where email = '${adminEmail()}'`) as {
    uid: string;
  }[];
  adminUid = rows[0]?.uid ?? "";
  available = adminUid.length > 0;
} catch {
  available = false;
}

// A valid (all-hex) uuid belonging to no admin. Must be real hex or auth.uid()'s
// ::uuid cast raises a syntax error before the guard is ever reached.
const NON_ADMIN = "00000000-0000-4000-8000-000000000001";

/** Runs `body` as the admin inside a rolled-back transaction. `body` may seed rows
 *  (executed as the connection's superuser role, before the role switch), call
 *  RPCs, and end with the SELECT whose rows are returned. */
function asAdmin(seed: string, call: string, observe: string): unknown[] {
  const claims = JSON.stringify({ sub: adminUid, role: "authenticated" }).replace(/'/g, "''");
  return cli(
    `begin;
     ${seed}
     select set_config('request.jwt.claims', '${claims}', true);
     set local role authenticated;
     ${call}
     reset role;
     ${observe}
     rollback;`,
  );
}

describe.skipIf(!available)("admin_swap_chapter_order", () => {
  it("swaps the two chapters' sort_order", () => {
    const rows = asAdmin(
      `insert into recall_chapters (id, subject_id, subject_name, subject_emoji, section_id, section_name, name, sort_order, section_sort_order, subject_sort_order)
       values ('__test_a','s','S','x','sec','Sec','A',1,0,0), ('__test_b','s','S','x','sec','Sec','B',2,0,0);`,
      `select public.admin_swap_chapter_order('__test_a','__test_b');`,
      `select id, sort_order from recall_chapters where id in ('__test_a','__test_b') order by id;`,
    ) as { id: string; sort_order: number }[];
    expect(rows).toEqual([
      { id: "__test_a", sort_order: 2 },
      { id: "__test_b", sort_order: 1 },
    ]);
  });
});

describe.skipIf(!available)("admin_save_chapter", () => {
  it("upserts the chapter and replaces its cards from the jsonb payload", () => {
    const cards = JSON.stringify([
      { term: "Chlorophyll", definition: "green pigment" },
      { term: "Stomata", definition: "leaf pores" },
    ]);
    const rows = asAdmin(
      "",
      `select public.admin_save_chapter(
         '${cards}'::jsonb, '__test_chap', 'Photosynthesis', '__test_sec', 'Cells',
         0, '🧬', '__test_subj', 'Biology');`,
      `select
         (select name from recall_chapters where id = '__test_chap') as chapter_name,
         (select count(*)::int from recall_cards where chapter_id = '__test_chap') as card_count,
         (select term from recall_cards where chapter_id = '__test_chap' order by sort_order limit 1) as first_term;`,
    ) as { chapter_name: string; card_count: number; first_term: string }[];
    expect(rows[0]).toEqual({ chapter_name: "Photosynthesis", card_count: 2, first_term: "Chlorophyll" });
  });
});

describe.skipIf(!available)("admin_delete_chapter", () => {
  it("removes the chapter and cascades to its cards", () => {
    const rows = asAdmin(
      `insert into recall_chapters (id, subject_id, subject_name, subject_emoji, section_id, section_name, name, sort_order, section_sort_order, subject_sort_order)
         values ('__test_del','s','S','x','sec','Sec','Doomed',1,0,0);
       insert into recall_cards (chapter_id, term, definition, sort_order)
         values ('__test_del','t','d',0), ('__test_del','t2','d2',1);`,
      `select public.admin_delete_chapter('__test_del');`,
      `select
         (select count(*)::int from recall_chapters where id = '__test_del') as chapters,
         (select count(*)::int from recall_cards where chapter_id = '__test_del') as cards;`,
    ) as { chapters: number; cards: number }[];
    expect(rows[0]).toEqual({ chapters: 0, cards: 0 });
  });
});

describe.skipIf(!available)("admin_set_disabled", () => {
  it("adds a disabled row when true and removes it when false", () => {
    const enabled = asAdmin(
      "",
      `select public.admin_set_disabled(true, '__test_subj', 'subject');`,
      `select count(*)::int as n from recall_disabled where entity_id = '__test_subj' and entity_type = 'subject';`,
    ) as { n: number }[];
    expect(enabled[0].n).toBe(1);

    const disabled = asAdmin(
      `insert into recall_disabled (entity_id, entity_type) values ('__test_subj','subject') on conflict do nothing;`,
      `select public.admin_set_disabled(false, '__test_subj', 'subject');`,
      `select count(*)::int as n from recall_disabled where entity_id = '__test_subj' and entity_type = 'subject';`,
    ) as { n: number }[];
    expect(disabled[0].n).toBe(0);
  });
});

describe.skipIf(!available)("a signed-in non-admin is rejected", () => {
  it("admin_swap_chapter_order raises for an authenticated non-admin", () => {
    const claims = JSON.stringify({ sub: NON_ADMIN, role: "authenticated" }).replace(/'/g, "''");
    expect(() =>
      cli(
        `begin;
         select set_config('request.jwt.claims', '${claims}', true);
         set local role authenticated;
         select public.admin_swap_chapter_order('a','b');
         rollback;`,
      ),
    ).toThrow(/not authorized/i);
  });
});
