import { describe, it, expect, beforeAll, afterAll } from "vitest";

/**
 * language-hub per-user scoping + starter-set import, against the LOCAL stack.
 *
 * Runs via `pnpm test:db:local` (scripts/test-db-local.sh brings up Docker
 * Supabase, applies every migration in database/migrations/, seeds
 * database/seed.sql, then runs this). Unlike vitest.db.config.ts this talks to
 * 127.0.0.1:54321 and is allowed to write — it signs in as the seed users and
 * inserts a set, then cleans up.
 *
 * What it proves:
 *   1. The Index/Folder `.or(user_id.eq.<me>,user_id.is.null)` read shows a user
 *      its own sets + legacy null-owner sets, and never another user's.
 *   2. RLS is still USING(true): an UNfiltered read as user 1 still returns
 *      user 2's set. The scope is a UX filter, not a security boundary.
 *   3. A starter-set import (a set + its items, owned by the importer) shows up
 *      for the importer and not for anyone else.
 *   4. practice_sample / practice_sample_folder (migration 20260901000000) only
 *      ever sample the caller's own + legacy sets.
 *
 * Seed fixtures (database/seed.sql):
 *   seed-user-1  owns  a1111111…  ("User One — French Food")
 *   seed-user-2  owns  a2222222…  ("User Two — Spanish Food"), inside folder f0000000…
 *   no owner           a0000000…  ("Legacy Shared Set")
 */

const URL_ = process.env.VITE_SUPABASE_URL ?? "";
const ANON = process.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? "";

const U1 = "11111111-1111-1111-1111-111111111111";
const U2 = "22222222-2222-2222-2222-222222222222";
const SET_U1 = "a1111111-1111-1111-1111-111111111111";
const SET_U2 = "a2222222-2222-2222-2222-222222222222";
const SET_LEGACY = "a0000000-0000-0000-0000-000000000000";
const FOLDER = "f0000000-0000-0000-0000-000000000001";

const SEED_USERS = {
  one: { email: "seed-user-1@example.com", password: "seed-password-1" },
  two: { email: "seed-user-2@example.com", password: "seed-password-2" },
};

let token1 = "";
let token2 = "";
/** Sets created by a test, torn down in afterAll. */
const createdSetIds: string[] = [];

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function signIn(email: string, password: string): Promise<string> {
  // GoTrue can still be restarting right after `supabase db reset` (502/503 from
  // the gateway); retry a few times before giving up.
  let last = "";
  for (let attempt = 0; attempt < 10; attempt++) {
    const res = await fetch(`${URL_}/auth/v1/token?grant_type=password`, {
      method: "POST",
      headers: { apikey: ANON, "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    const text = await res.text();
    if (res.ok) {
      const body = JSON.parse(text) as { access_token?: string };
      if (body.access_token) return body.access_token;
    }
    last = `${res.status}: ${text.slice(0, 200)}`;
    if (res.status !== 502 && res.status !== 503 && res.status !== 504) break;
    await sleep(1000);
  }
  throw new Error(`sign-in failed for ${email} (${last})`);
}

function authHeaders(token?: string): Record<string, string> {
  return { apikey: ANON, Authorization: `Bearer ${token ?? ANON}`, "Content-Type": "application/json" };
}

async function selectRows<T = Record<string, unknown>>(
  table: string,
  query: string,
  token?: string,
): Promise<T[]> {
  const res = await fetch(`${URL_}/rest/v1/${table}?${query}`, { headers: authHeaders(token) });
  const text = await res.text();
  if (!res.ok) throw new Error(`GET ${table}?${query} -> ${res.status}: ${text.slice(0, 300)}`);
  return JSON.parse(text) as T[];
}

async function insertRows<T = Record<string, unknown>>(
  table: string,
  rows: unknown,
  token: string,
  { returning = false }: { returning?: boolean } = {},
): Promise<T[]> {
  const res = await fetch(`${URL_}/rest/v1/${table}`, {
    method: "POST",
    headers: { ...authHeaders(token), Prefer: returning ? "return=representation" : "return=minimal" },
    body: JSON.stringify(rows),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`POST ${table} -> ${res.status}: ${text.slice(0, 300)}`);
  return returning ? (JSON.parse(text) as T[]) : [];
}

async function rpc<T = Record<string, unknown>>(
  name: string,
  args: Record<string, unknown>,
  token: string,
): Promise<T[]> {
  const res = await fetch(`${URL_}/rest/v1/rpc/${name}`, {
    method: "POST",
    headers: authHeaders(token),
    body: JSON.stringify(args),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`RPC ${name} -> ${res.status}: ${text.slice(0, 300)}`);
  return JSON.parse(text) as T[];
}

/** The exact read Index.tsx / Folder.tsx now issue for the signed-in user. */
function scopedSetsQuery(userId: string): string {
  return `select=id,name,user_id&or=(user_id.eq.${userId},user_id.is.null)&order=created_at.desc`;
}

beforeAll(async () => {
  if (!URL_ || !ANON) {
    throw new Error(
      "VITE_SUPABASE_URL / VITE_SUPABASE_PUBLISHABLE_KEY are unset. Run this via `pnpm test:db:local` " +
        "(scripts/test-db-local.sh), which brings up the local stack and points these at it.",
    );
  }

  let seededSets: { id: string }[];
  try {
    seededSets = await selectRows<{ id: string }>("vocabulary_sets", "select=id");
  } catch (e) {
    throw new Error(
      `Local Supabase not reachable at ${URL_}. Start it with \`pnpm db:start\` (needs Docker), then ` +
        `\`pnpm db:reset\`. Original error: ${(e as Error).message}`,
    );
  }
  const ids = new Set(seededSets.map((s) => s.id));
  if (!ids.has(SET_U1) || !ids.has(SET_U2) || !ids.has(SET_LEGACY)) {
    throw new Error(
      "Seed fixtures missing from vocabulary_sets — run `pnpm db:reset` to re-apply database/seed.sql.",
    );
  }

  token1 = await signIn(SEED_USERS.one.email, SEED_USERS.one.password);
  token2 = await signIn(SEED_USERS.two.email, SEED_USERS.two.password);
});

afterAll(async () => {
  // Belt-and-braces: the runner db-resets before every run, but a bare `vitest`
  // re-run would otherwise stack duplicate import rows.
  for (const id of createdSetIds) {
    await fetch(`${URL_}/rest/v1/vocabulary_sets?id=eq.${id}`, {
      method: "DELETE",
      headers: authHeaders(token1),
    });
  }
});

describe("per-user set scoping (the Index/Folder .or filter)", () => {
  it("shows seed-user-1 its own set + the legacy set, never seed-user-2's", async () => {
    const rows = await selectRows<{ id: string }>("vocabulary_sets", scopedSetsQuery(U1), token1);
    const ids = rows.map((r) => r.id);
    expect(ids).toContain(SET_U1);
    expect(ids).toContain(SET_LEGACY);
    expect(ids).not.toContain(SET_U2);
  });

  it("shows seed-user-2 its own set + the legacy set, never seed-user-1's", async () => {
    const rows = await selectRows<{ id: string }>("vocabulary_sets", scopedSetsQuery(U2), token2);
    const ids = rows.map((r) => r.id);
    expect(ids).toContain(SET_U2);
    expect(ids).toContain(SET_LEGACY);
    expect(ids).not.toContain(SET_U1);
  });
});

describe("RLS stays open — the scope is a UX filter, not a boundary", () => {
  it("an UNfiltered read as seed-user-1 still returns seed-user-2's set", async () => {
    const rows = await selectRows<{ id: string }>("vocabulary_sets", "select=id", token1);
    expect(rows.map((r) => r.id)).toContain(SET_U2);
  });
});

describe("importing a starter set (mirrors createSetWithItems)", () => {
  it("an imported set shows up for the importer and for nobody else", async () => {
    const [created] = await insertRows<{ id: string }>(
      "vocabulary_sets",
      {
        name: "IMPORT TEST — French Greetings",
        description: "created by language-hub-scoping.test.ts",
        language: "french",
        user_id: U1,
      },
      token1,
      { returning: true },
    );
    createdSetIds.push(created.id);

    await insertRows(
      "vocabulary_items",
      [
        { set_id: created.id, term: "bonjour", definition: "hello" },
        { set_id: created.id, term: "merci", definition: "thank you" },
      ],
      token1,
    );

    const seenByOne = await selectRows<{ id: string }>("vocabulary_sets", scopedSetsQuery(U1), token1);
    expect(seenByOne.map((r) => r.id)).toContain(created.id);

    const seenByTwo = await selectRows<{ id: string }>("vocabulary_sets", scopedSetsQuery(U2), token2);
    expect(seenByTwo.map((r) => r.id)).not.toContain(created.id);

    const items = await selectRows("vocabulary_items", `select=id&set_id=eq.${created.id}`, token1);
    expect(items).toHaveLength(2);
  });
});

describe("practice_sample is scoped to the caller's sets (migration 20260901000000)", () => {
  it("seed-user-1's pool draws only from its own + legacy sets", async () => {
    const rows = await rpc<{ set_id: string }>("practice_sample", { sample_count: 50 }, token1);
    const setIds = new Set(rows.map((r) => r.set_id));
    expect(rows.length).toBeGreaterThan(0);
    expect(setIds.has(SET_U2)).toBe(false);
    expect([...setIds].every((id) => id === SET_U1 || id === SET_LEGACY)).toBe(true);
    expect(setIds.has(SET_LEGACY)).toBe(true);
  });

  it("seed-user-2's pool draws only from its own + legacy sets", async () => {
    const rows = await rpc<{ set_id: string }>("practice_sample", { sample_count: 50 }, token2);
    const setIds = new Set(rows.map((r) => r.set_id));
    expect(rows.length).toBeGreaterThan(0);
    expect(setIds.has(SET_U1)).toBe(false);
    expect([...setIds].every((id) => id === SET_U2 || id === SET_LEGACY)).toBe(true);
  });

  it("practice_sample_folder honours both the folder and the owner", async () => {
    // seed-user-2 owns the only set in FOLDER.
    const forOwner = await rpc<{ set_id: string }>(
      "practice_sample_folder",
      { sample_count: 50, target_folder: FOLDER },
      token2,
    );
    expect(forOwner.length).toBeGreaterThan(0);
    expect(forOwner.every((r) => r.set_id === SET_U2)).toBe(true);

    // seed-user-1 is not the owner of anything in FOLDER.
    const forOther = await rpc(
      "practice_sample_folder",
      { sample_count: 50, target_folder: FOLDER },
      token1,
    );
    expect(forOther).toHaveLength(0);
  });
});
