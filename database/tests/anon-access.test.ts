import { describe, it, expect, beforeAll } from "vitest";

/**
 * What can someone holding only the anon key do?
 *
 * The anon key is not a secret — it ships in all six client bundles, so every
 * visitor already has it. It is therefore the exact credential to attack the
 * project with, and the only one this suite ever uses. The service role key
 * appears nowhere here.
 *
 * The bug class this exists for has shipped once already: `_assert_admin()`
 * gated on `email <> 'admin@…'`, and for an anonymous caller auth.uid() is NULL,
 * so the subquery yields NULL, `NULL <> 'admin'` is NULL rather than TRUE, the
 * `IF` branch is not taken and the guard PASSES. Every admin_* RPC was callable
 * with the anon key until 20260724000000 replaced it with IS DISTINCT FROM.
 * These tests are the regression net for that, and for the next one.
 *
 * SAFETY: every probe below is inert by construction. Read-only RPCs are called
 * as-is; mutating RPCs are called only with identifiers that cannot match a real
 * row, so even a total guard failure changes nothing. The two RPCs that could
 * INSERT on a bogus id (admin_save_chapter, admin_save_two_sider) are never
 * called — they are covered by the static guard-coverage assertion instead.
 */

const URL_ = process.env.VITE_SUPABASE_URL;
const ANON = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;

// An id that cannot exist: every real id in these tables is a slug or a UUID.
const NOWHERE = "__security_probe_nonexistent__";

interface RpcResult {
  status: number;
  body: unknown;
  message: string;
}

async function rpc(name: string, args: Record<string, unknown> = {}): Promise<RpcResult> {
  const res = await fetch(`${URL_}/rest/v1/rpc/${name}`, {
    method: "POST",
    headers: {
      apikey: ANON!,
      Authorization: `Bearer ${ANON}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(args),
  });
  const text = await res.text();
  let body: unknown = text;
  try {
    body = JSON.parse(text);
  } catch {
    /* non-JSON error pages come back as text */
  }
  const message =
    body && typeof body === "object" && "message" in body
      ? String((body as { message: unknown }).message)
      : text;
  return { status: res.status, body, message };
}

async function selectFrom(table: string): Promise<{ status: number; rows: unknown[] }> {
  const res = await fetch(`${URL_}/rest/v1/${table}?select=*&limit=5`, {
    headers: { apikey: ANON!, Authorization: `Bearer ${ANON}` },
  });
  const text = await res.text();
  let rows: unknown[] = [];
  try {
    const parsed = JSON.parse(text);
    rows = Array.isArray(parsed) ? parsed : [];
  } catch {
    /* an error body is not a row set */
  }
  return { status: res.status, rows };
}

/** Every admin RPC must fail closed for an anonymous caller. */
function expectRejected(result: RpcResult, name: string) {
  expect(
    result.status,
    `${name} answered ${result.status} to an anonymous caller — expected a rejection. Body: ${JSON.stringify(result.body).slice(0, 300)}`,
  ).toBeGreaterThanOrEqual(400);
  expect(result.message, `${name} rejected, but not via the admin guard`).toMatch(
    /not authorized/i,
  );
}

beforeAll(() => {
  if (!URL_ || !ANON) {
    throw new Error(
      "VITE_SUPABASE_URL / VITE_SUPABASE_PUBLISHABLE_KEY are unset. This suite talks to the " +
        "deployed project; copy an app's .env in (see CLAUDE.md) or skip with `pnpm test` instead.",
    );
  }
});

describe("admin analytics RPCs are closed to anonymous callers", () => {
  // Read-only: safe to call exactly as the admin dashboard would.
  const readOnly: [string, Record<string, unknown>][] = [
    ["admin_analytics_overview", { p_days: 7 }],
    ["admin_analytics_daily", { p_app_key: "recall", p_days: 7 }],
    ["admin_analytics_events", { p_days: 7, p_app_key: "recall" }],
    ["admin_analytics_funnel", { p_app_key: "recall", p_steps: ["a", "b"], p_days: 7 }],
    ["admin_analytics_retention", { p_app_key: "recall", p_weeks: 4 }],
  ];

  it.each(readOnly)("%s rejects anon", async (name, args) => {
    expectRejected(await rpc(name, args), name);
  });
});

describe("get_user_stats is closed to anonymous callers", () => {
  // This one had its own inline copy of the broken guard, so fixing
  // _assert_admin in 20260724000000 did NOT cover it — it needed
  // 20260724020000 as well. It leaked every user's email and last activity.
  it("rejects anon", async () => {
    expectRejected(await rpc("get_user_stats"), "get_user_stats");
  });

  it("returns no user rows to anon", async () => {
    const { body } = await rpc("get_user_stats");
    expect(Array.isArray(body) ? body : []).toHaveLength(0);
  });
});

describe("admin content-mutation RPCs are closed to anonymous callers", () => {
  // Called with ids that match nothing, so a guard failure still mutates zero
  // rows. Do not swap these for real ids to "test properly".
  const mutating: [string, Record<string, unknown>][] = [
    ["admin_delete_chapter", { p_id: NOWHERE }],
    ["admin_delete_two_sider", { p_id: NOWHERE }],
    ["admin_rename_section", { p_section_id: NOWHERE, p_new_name: NOWHERE }],
    ["admin_rename_subject", { p_subject_id: NOWHERE, p_new_name: NOWHERE, p_new_emoji: "🔒" }],
    ["admin_set_disabled", { p_entity_type: "chapter", p_entity_id: NOWHERE, p_disabled: false }],
    ["admin_set_two_sider_available", { p_id: NOWHERE, p_available: false }],
    ["admin_swap_chapter_order", { p_id_a: NOWHERE, p_id_b: NOWHERE }],
    ["admin_swap_section_order", { p_section_id_a: NOWHERE, p_section_id_b: NOWHERE }],
    ["admin_swap_subject_order", { p_subject_id_a: NOWHERE, p_subject_id_b: NOWHERE }],
    ["admin_swap_two_sider_order", { p_id_a: NOWHERE, p_id_b: NOWHERE }],
  ];

  it.each(mutating)("%s rejects anon", async (name, args) => {
    expectRejected(await rpc(name, args), name);
  });
});

describe("SECURITY DEFINER functions are not left ungated", () => {
  /**
   * refresh_analytics_daily() rebuilds the analytics_daily rollup:
   *
   *   DELETE FROM analytics_daily WHERE day >= current_date - p_trailing_days;
   *   INSERT INTO analytics_daily SELECT … FROM analytics_events
   *     WHERE occurred_at >= current_date - p_trailing_days;
   *
   * It is SECURITY DEFINER, takes no admin check, and its only intended caller
   * is the `refresh-analytics-daily` pg_cron job, which runs as postgres.
   *
   * analytics_events is pruned at 180 days by the `prune-analytics-events` cron,
   * so analytics_daily is the ONLY record of anything older than that. A caller
   * passing a large p_trailing_days deletes the whole rollup and rebuilds only
   * the part still backed by events — permanently destroying every day older
   * than the retention window.
   *
   * The probe below passes -36500, which makes both statements provably empty
   * (the cutoff lands a century in the future), so it demonstrates reachability
   * without touching a single row.
   */
  it("refresh_analytics_daily is not executable by anon", async () => {
    const result = await rpc("refresh_analytics_daily", { p_trailing_days: -36500 });
    expect(
      result.status,
      "anon can execute refresh_analytics_daily — it is SECURITY DEFINER with no _assert_admin() " +
        "and can wipe the analytics_daily rollup beyond the 180-day events retention window",
    ).toBeGreaterThanOrEqual(400);
  });
});

describe("RLS keeps user-scoped tables closed to anonymous readers", () => {
  // Every one of these is scoped to auth.uid(); anon has no uid, so a correct
  // policy yields nothing. A non-empty result means the table is world-readable.
  const userScoped = [
    "mock_attempts",
    "recall_progress",
    "user_prefs",
    "analytics_events",
    "active_sessions",
  ];

  // questions_metadata isn't user-scoped — it's the past-papers question index,
  // and there's no auth.uid() column to key a policy on. It's grouped with the
  // user-scoped tables anyway because the assertion is identical: anon must get
  // zero rows. It used to be a blanket `FOR SELECT USING (true)` policy
  // (20260520000000_questions_metadata.sql) so the browser could query it
  // directly; 20260821000000_revoke_anon_questions_metadata.sql closed that once
  // the browser moved to reading it through /api/chapter-questions with the
  // service role instead (server/chapter-questions-handler.js). This is the
  // regression net for that: if the policy or grant is ever restored, this test
  // fails rather than the table quietly reopening.
  it("questions_metadata exposes no rows to anon", async () => {
    const { rows } = await selectFrom("questions_metadata");
    expect(rows, "questions_metadata returned rows to an anonymous reader").toHaveLength(0);
  });

  it.each(userScoped)("%s exposes no rows to anon", async (table) => {
    const { rows } = await selectFrom(table);
    expect(rows, `${table} returned rows to an anonymous reader`).toHaveLength(0);
  });
});
