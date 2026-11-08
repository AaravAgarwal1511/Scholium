import { describe, it, expect } from "vitest";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";

/**
 * admin_analytics_range_summary / admin_analytics_monthly
 * (20261027000000_analytics_range_rpcs.sql), against the LOCAL stack. Runs via
 * `pnpm test:db:local`.
 *
 * These back the admin dashboard's "Verified totals" panel, i.e. numbers that get
 * quoted publicly, so the counting rules are pinned here:
 *   1. [p_from, p_to] is inclusive and in UTC days — an event at 23:30 UTC on p_to
 *      counts, one at 00:10 UTC the day after does not.
 *   2. Months are UTC calendar months.
 *   3. A visitor is coalesce(user_id, anon_id): a signed-in user counts once however
 *      many devices they use.
 *   4. Papers = generate_complete only; generate_failed is reported separately.
 *   5. Only the admin can call them, and anon has no EXECUTE grant at all.
 *
 * `supabase db query --local` refuses multi-statement SQL, and every case here needs a
 * rolled-back transaction, so this talks to the database container's psql directly.
 * Everything runs inside BEGIN … ROLLBACK, so nothing persists.
 */

function dbContainer(): string {
  try {
    const names = execFileSync("docker", ["ps", "--format", "{{.Names}}"], { encoding: "utf8" });
    return names.split("\n").find((n) => n.startsWith("supabase_db_")) ?? "";
  } catch {
    return "";
  }
}

const CONTAINER = dbContainer();

function psql(sql: string): string {
  try {
    return execFileSync(
      "docker",
      ["exec", "-i", CONTAINER, "psql", "-U", "postgres", "-At", "-v", "ON_ERROR_STOP=1"],
      { input: sql, encoding: "utf8", stdio: ["pipe", "pipe", "pipe"] },
    );
  } catch (e) {
    throw new Error((e as { stderr?: string }).stderr || String(e));
  }
}

/** Same source as admin-rpc-behaviour.test.ts: read the gate from the migration
 *  rather than committing the address. */
function adminEmail(): string {
  const sql = readFileSync(
    path.resolve(process.cwd(), "database/migrations/20260724000000_fix_assert_admin_null_bypass.sql"),
    "utf8",
  );
  const m = sql.match(/IS DISTINCT FROM\s+'([^']+)'/i);
  if (!m) throw new Error("could not find admin email in the migration");
  return m[1];
}

// The local seed may already hold an account with the admin email (the email is
// unique), so the admin is resolved by email at call time rather than inserted.
const ADMIN = "admin";
const STUDENT = "00000000-0000-4000-8000-0000000000b2";
const ADMIN_UUID = "00000000-0000-4000-8000-0000000000a1";

// Times are chosen to sit either side of UTC day and month boundaries.
const SEED = `
  insert into auth.users (id, email, aud, role)
  select '${ADMIN_UUID}', '${adminEmail()}', 'authenticated', 'authenticated'
  where not exists (select 1 from auth.users where email = '${adminEmail()}');
  insert into auth.users (id, email, aud, role)
  values ('${STUDENT}', 'analytics-range-student@example.com', 'authenticated', 'authenticated');
  insert into public.analytics_events (occurred_at, user_id, anon_id, session_id, app_key, name) values
    ('2026-08-31 23:30:00+00', null,         'dev-a', 's1', 'past-papers',   'generate_complete'),
    ('2026-09-01 00:10:00+00', null,         'dev-a', 's2', 'past-papers',   'generate_complete'),
    ('2026-09-15 12:00:00+00', '${STUDENT}', 'dev-b', 's3', 'past-papers',   'generate_complete'),
    ('2026-09-16 12:00:00+00', '${STUDENT}', 'dev-c', 's4', 'past-papers',   'page_view'),
    ('2026-09-20 12:00:00+00', null,         'dev-d', 's5', 'scholium-home', 'page_view'),
    ('2026-09-21 12:00:00+00', null,         'dev-e', 's6', 'past-papers',   'generate_failed');
`;

/** Seeds, becomes `uid`, runs `query`, returns its rows, rolls everything back. */
function callAs(uid: string | null, query: string): Record<string, unknown>[] {
  const sub =
    uid === ADMIN ? `(select id::text from auth.users where email = '${adminEmail()}')` : `'${uid}'`;
  const claims = uid
    ? `select set_config('request.jwt.claims',
         json_build_object('sub', ${sub}, 'role', 'authenticated')::text, true);
       set local role authenticated;`
    : `set local role anon;`;
  const out = psql(`
    begin;
    -- Only this test's rows: the local seed may carry events of its own.
    delete from public.analytics_events;
    ${SEED}
    ${claims}
    select 'JSON:' || coalesce(json_agg(t)::jsonb, '[]'::jsonb)::text from (${query}) t;
    rollback;
  `);
  const line = out.split("\n").find((l) => l.startsWith("JSON:"));
  if (!line) throw new Error(`no result in psql output: ${out.slice(0, 300)}`);
  return JSON.parse(line.slice(5));
}

const summary = (from: string | null, to: string | null, app: string | null = null) =>
  callAs(
    ADMIN,
    `select * from public.admin_analytics_range_summary(${lit(from)}, ${lit(to)}, ${lit(app)})`,
  )[0];

const monthly = (from: string | null, to: string | null, app: string | null = null) =>
  callAs(ADMIN, `select * from public.admin_analytics_monthly(${lit(from)}, ${lit(to)}, ${lit(app)})`);

function lit(v: string | null) {
  return v === null ? "null" : `'${v}'`;
}

describe.skipIf(!CONTAINER)("admin_analytics_range_summary", () => {
  it("counts all time when both bounds are null", () => {
    expect(summary(null, null)).toMatchObject({
      events: 6,
      // dev-a, STUDENT (dev-b and dev-c collapse into the account), dev-d, dev-e
      visitors: 4,
      papers_generated: 3,
      papers_failed: 1,
    });
  });

  it("treats p_to as inclusive to the end of that UTC day", () => {
    expect(summary(null, "2026-08-31")).toMatchObject({ events: 1, papers_generated: 1 });
    expect(summary("2026-09-01", null)).toMatchObject({ events: 5, papers_generated: 2 });
  });

  it("scopes to one app", () => {
    expect(summary(null, null, "past-papers")).toMatchObject({ events: 5, visitors: 3 });
    expect(summary(null, null, "scholium-home")).toMatchObject({ events: 1, papers_generated: 0 });
  });

  it("rejects a reversed range", () => {
    expect(() => summary("2026-09-02", "2026-09-01")).toThrow(/is after/);
  });
});

describe.skipIf(!CONTAINER)("admin_analytics_monthly", () => {
  it("buckets by UTC calendar month with per-month distinct visitors", () => {
    expect(monthly(null, null)).toEqual([
      { month: "2026-08-01", events: 1, visitors: 1, papers_generated: 1 },
      // dev-a again (a new month counts it again), STUDENT, dev-d, dev-e
      { month: "2026-09-01", events: 5, visitors: 4, papers_generated: 2 },
    ]);
  });

  it("only includes the days of an edge month that fall inside the range", () => {
    expect(monthly("2026-09-16", "2026-09-20")).toEqual([
      { month: "2026-09-01", events: 2, visitors: 2, papers_generated: 0 },
    ]);
  });
});

describe.skipIf(!CONTAINER)("access", () => {
  it("rejects an authenticated non-admin", () => {
    expect(() =>
      callAs(STUDENT, "select * from public.admin_analytics_range_summary(null, null, null)"),
    ).toThrow(/not authorized/);
    expect(() =>
      callAs(STUDENT, "select * from public.admin_analytics_monthly(null, null, null)"),
    ).toThrow(/not authorized/);
  });

  it("gives anon no EXECUTE grant", () => {
    const rows = psql(`
      select has_function_privilege('anon', 'public.admin_analytics_range_summary(date,date,text)', 'execute'),
             has_function_privilege('anon', 'public.admin_analytics_monthly(date,date,text)', 'execute'),
             has_function_privilege('authenticated', 'public.admin_analytics_monthly(date,date,text)', 'execute');
    `);
    expect(rows.trim()).toBe("f|f|t");
  });
});
