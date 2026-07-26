import { describe, it, expect } from "vitest";
import { execFileSync } from "node:child_process";
import path from "node:path";

/**
 * Cross-user RLS isolation: can user A reach user B's rows?
 *
 * The anon-key suite (anon-access.test.ts) proves a signed-OUT caller sees
 * nothing. That is the weaker half. This file proves a signed-IN caller sees
 * nothing of anybody else's — the half that a policy of `USING (true)` would
 * pass and `USING (auth.uid() = user_id)` would fail if it were ever loosened.
 *
 * No test accounts are created. auth.uid() reads request.jwt.claims, so a
 * transaction can simply declare who it is:
 *
 *   begin;
 *   set local role authenticated;
 *   set local request.jwt.claims to '{"sub":"<uuid>","role":"authenticated"}';
 *   …
 *   rollback;
 *
 * SAFETY: every statement here is a SELECT. Nothing is inserted, updated or
 * deleted, so there is no write to roll back and no way for a botched
 * transaction to alter production. Keep it that way — do not add fixture rows.
 *
 * Real user ids are discovered at run time and never committed: this file holds
 * no UUIDs and no emails.
 *
 * Unlike the anon suite this needs database-level access (the linked Supabase
 * CLI), not just the anon key, so it skips rather than fails wherever that is
 * unavailable — CI included.
 */

// Tables carrying a direct owner column. vocabulary_items and folders are
// scoped transitively through vocabulary_sets and so are covered by that
// table's policies rather than one of their own.
//
// Readable back by their owner, and by nobody else.
const OWNER_READABLE = [
  "active_sessions",
  "mock_attempts",
  "recall_progress",
  "set_progress",
  "user_prefs",
  "vocabulary_sets",
];

// Write-only from the client: an INSERT policy and deliberately no SELECT one,
// so not even the author can read their events back over PostgREST. Every read
// goes through the SECURITY DEFINER admin_analytics_* RPCs. Listed separately
// rather than derived from pg_policies on purpose — stating the intent here is
// what makes "someone added a SELECT policy to analytics_events" a test failure.
const WRITE_ONLY = ["analytics_events"];

const OWNED_TABLES = [...OWNER_READABLE, ...WRITE_ONLY];

// A uuid that belongs to nobody, for the "signed in, but not the owner" case.
const NOBODY = "00000000-0000-4000-8000-000000000000";

// Resolved once. Going through `npx` on every call re-resolves the binary each
// time, which is both slow and an occasional source of spurious failures.
const SUPABASE_BIN = path.resolve(process.cwd(), "node_modules/.bin/supabase");

// Each call is a fresh CLI process and a round trip to the project's region, so
// identical lookups are answered from memory rather than repeated.
const queryCache = new Map<string, unknown[]>();

function dbQuery<T = Record<string, unknown>>(sql: string, cache = true): T[] {
  const hit = cache ? queryCache.get(sql) : undefined;
  if (hit) return hit as T[];

  let lastError: unknown;
  // One retry: the CLI occasionally fails to establish its connection, and a
  // flaky security suite is a suite people learn to ignore.
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const stdout = execFileSync(SUPABASE_BIN, ["db", "query", "--linked", sql], {
        encoding: "utf8",
        timeout: 60_000,
        maxBuffer: 32 * 1024 * 1024,
        stdio: ["ignore", "pipe", "pipe"],
      });
      // The CLI prints progress lines before the JSON payload.
      const start = stdout.indexOf("{");
      if (start === -1) throw new Error(`no JSON in CLI output: ${stdout.slice(0, 200)}`);
      const rows = (JSON.parse(stdout.slice(start)) as { rows?: T[] }).rows ?? [];
      if (cache) queryCache.set(sql, rows);
      return rows;
    } catch (err) {
      lastError = err;
    }
  }
  throw new Error(
    `supabase db query failed after 2 attempts.\nSQL: ${sql.slice(0, 200)}\n${String(lastError).slice(0, 400)}`,
  );
}

/** Runs `sql` as if signed in as `uid`, inside a transaction that rolls back. */
function asUser<T = Record<string, unknown>>(uid: string, sql: string): T[] {
  const claims = JSON.stringify({ sub: uid, role: "authenticated" }).replace(/'/g, "''");
  return dbQuery<T>(
    `begin; set local role authenticated; ` +
      `set local request.jwt.claims to '${claims}'; ${sql}; rollback;`,
  );
}

let available = false;
try {
  dbQuery("select 1 as ok");
  available = true;
} catch {
  available = false;
}

describe.skipIf(!available)("RLS is switched on at all", () => {
  it("every table in public has row level security enabled", () => {
    const off = dbQuery<{ relname: string }>(
      `select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace
       where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity
       order by c.relname`,
    ).map((r) => r.relname);

    expect(off, `tables in public without RLS: ${off.join(", ")}`).toEqual([]);
  });

  it("every table with RLS has at least one policy, or is deny-all on purpose", () => {
    // RLS on + zero policies denies everyone (bar the owner and service_role),
    // which is correct for analytics_daily — it is only ever read through the
    // SECURITY DEFINER admin_analytics_* RPCs, which bypass RLS. Any *other*
    // table in that state is far more likely to be an oversight.
    const denyAll = dbQuery<{ relname: string }>(
      `select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace
       where n.nspname = 'public' and c.relkind = 'r' and c.relrowsecurity
         and not exists (select 1 from pg_policies p
                         where p.schemaname = 'public' and p.tablename = c.relname)
       order by c.relname`,
    ).map((r) => r.relname);

    expect(denyAll).toEqual(["analytics_daily"]);
  });
});

describe.skipIf(!available)("write-only tables stay unreadable", () => {
  it.each(WRITE_ONLY)("%s has no SELECT policy", (table) => {
    const selectPolicies = dbQuery<{ policyname: string }>(
      `select policyname from pg_policies where schemaname = 'public'
         and tablename = '${table}' and cmd in ('SELECT', 'ALL')`,
    );
    expect(
      selectPolicies.map((p) => p.policyname),
      `${table} is meant to be write-only; a SELECT policy would expose it over PostgREST`,
    ).toEqual([]);
  });

  it.each(WRITE_ONLY)("%s is unreadable even by the user who wrote the rows", (table) => {
    const owners = dbQuery<{ uid: string; n: number }>(
      `select user_id::text as uid, count(*)::int as n from public.${table}
       where user_id is not null group by 1 order by 2 desc limit 1`,
    );
    if (owners.length === 0) return;

    const [seen] = asUser<{ n: number }>(
      owners[0].uid,
      `select count(*)::int as n from public.${table}`,
    );
    expect(seen.n, `${table} let its author read ${seen.n} rows back`).toBe(0);
  });
});

describe.skipIf(!available)("a signed-in user cannot reach another user's rows", () => {
  it.each(OWNER_READABLE)("%s", (table) => {
    // Discovered with full privileges, so this sees the true contents.
    const owners = dbQuery<{ uid: string; n: number }>(
      `select user_id::text as uid, count(*)::int as n from public.${table}
       where user_id is not null group by 1 order by 2 desc limit 2`,
    );

    if (owners.length === 0) {
      // Nothing stored yet. All that can be checked is that an arbitrary signed-in
      // user still sees nothing — which would catch a USING (true) policy.
      const [seen] = asUser<{ n: number }>(
        NOBODY,
        `select count(*)::int as n from public.${table}`,
      );
      expect(seen.n, `${table} is empty but visible to a non-owner`).toBe(0);
      return;
    }

    const a = owners[0];
    const b = owners[1];

    const [seen] = asUser<{ total: number; own: number; other: number }>(
      a.uid,
      `select (select count(*)::int from public.${table}) as total,
              (select count(*)::int from public.${table} where user_id = '${a.uid}') as own,
              (select count(*)::int from public.${table} where user_id = ${
                b ? `'${b.uid}'` : `'${NOBODY}'`
              }) as other`,
    );

    // The owner still gets their own data — a policy that denies everything
    // would pass an isolation check while breaking the app.
    expect(seen.own, `${table}: owner cannot see their own rows`).toBe(a.n);

    // …and nothing beyond it.
    expect(seen.other, `${table}: owner can see another user's rows`).toBe(0);
    expect(
      seen.total,
      `${table}: owner sees ${seen.total} rows but owns only ${a.n} — rows are leaking from other users`,
    ).toBe(a.n);
  });

  it.each(OWNED_TABLES)("%s exposes nothing to a signed-in non-owner", (table) => {
    const [seen] = asUser<{ n: number }>(
      NOBODY,
      `select count(*)::int as n from public.${table}`,
    );
    expect(seen.n, `${table} leaks rows to a signed-in user who owns nothing`).toBe(0);
  });
});
