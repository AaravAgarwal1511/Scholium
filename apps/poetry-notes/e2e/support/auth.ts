import type { BrowserContext, Route } from '@playwright/test';

/**
 * Auth-seeded e2e without a real account and without touching production.
 *
 * Every real route in recall-app is behind AppContext, which redirects to
 * /signin when there is no session. Rather than create a test user (which would
 * live in the production auth table forever), we seed a fake session into
 * localStorage the way supabase-js persists a real one, and intercept every
 * Supabase request at the network layer. Nothing reaches Supabase — so this is a
 * pure UI-journey test, complementary to test:db, which covers the real backend.
 *
 * The three gotchas below each cost a wasted run in the language-hub verify
 * skill; they are load-bearing, not incidental.
 */

// supabase-js builds its storage key as `sb-${hostname.split('.')[0]}-auth-token`
// (see SupabaseClient). Match that derivation exactly — using the raw URL instead
// keeps the port on a localhost URL ("localhost:54321"), so the seed lands under a
// key the client never reads and the session silently fails to load.
export function projectRef(): string {
  const url = process.env.VITE_SUPABASE_URL ?? '';
  try {
    return new URL(url).hostname.split('.')[0];
  } catch {
    return url.replace(/^https?:\/\//, '').split(/[.:]/)[0];
  }
}

const TEST_USER = {
  id: '00000000-0000-4000-8000-00000000e2e5',
  aud: 'authenticated',
  role: 'authenticated',
  email: 'e2e@scholium.test',
  user_metadata: {},
  app_metadata: { provider: 'email' },
  created_at: '2026-01-01T00:00:00.000Z',
};

/** A session shaped like the one supabase-js stores, with expiry safely ahead. */
function makeSession() {
  return {
    access_token: 'e2e-access-token',
    refresh_token: 'e2e-refresh-token',
    token_type: 'bearer',
    expires_in: 3600,
    // Far future, in epoch SECONDS — otherwise the client tries to refresh over
    // the network on load and the stub race begins before the page even renders.
    expires_at: Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 365,
    user: TEST_USER,
  };
}

export const testUserId = TEST_USER.id;

function json(route: Route, body: unknown, status = 200) {
  return route.fulfill({
    status,
    contentType: 'application/json',
    headers: { 'access-control-allow-origin': '*' },
    body: JSON.stringify(body),
  });
}

/** True when the caller asked for a single object (.single()/.maybeSingle()). */
function wantsSingle(route: Route): boolean {
  const accept = route.request().headers()['accept'] ?? '';
  return accept.includes('vnd.pgrst.object');
}

export interface StubTables {
  /**
   * Per PostgREST path fragment (e.g. "recall_chapters"), the rows to return.
   * A function receives whether a single object was requested, so one table can
   * answer both a list read and a .single() read — the same table is often read
   * both ways across pages, and a fixed shape breaks one of them.
   */
  [table: string]: unknown[] | ((single: boolean) => unknown);
}

/**
 * Seeds the session and installs the network stubs. Order matters: the REST
 * catch-all (the rest/v1 wildcard route) is registered FIRST so the
 * specific-table routes, registered after, win — Playwright matches the most
 * recently registered route. Register it the other way round and the catch-all
 * swallows every table and each query silently returns [], which surfaces only
 * as an unexplained redirect home from a page's error branch.
 */
export async function seedAuth(context: BrowserContext, tables: StubTables = {}): Promise<void> {
  const ref = projectRef();
  const session = makeSession();

  await context.addInitScript(
    ([key, value]) => window.localStorage.setItem(key as string, value as string),
    [`sb-${ref}-auth-token`, JSON.stringify(session)] as const,
  );

  // Catch-all first (loses to anything registered later).
  await context.route('**/rest/v1/**', (route) => json(route, wantsSingle(route) ? {} : []));

  // Auth endpoints: report the seeded user, accept sign-out, swallow the rest.
  await context.route('**/auth/v1/**', (route) => {
    const url = route.request().url();
    if (url.includes('/user')) return json(route, TEST_USER);
    if (url.includes('/logout')) return json(route, {}, 204);
    return json(route, { user: TEST_USER, session });
  });

  // Realtime is a websocket the SingleSessionGuard opens; let it fail quietly
  // rather than hang. The guard tolerates a dead channel.
  await context.route('**/realtime/v1/**', (route) => route.abort());

  // Specific tables last, so they take precedence over the catch-all.
  for (const [table, rows] of Object.entries(tables)) {
    await context.route(`**/rest/v1/${table}*`, (route) =>
      json(route, typeof rows === 'function' ? rows(wantsSingle(route)) : rows),
    );
  }
}

/**
 * poetry-notes keeps everything in the `poetry-notes-projects` storage bucket,
 * not in tables: the project index is `<uid>/_index.json` and each project is
 * `<uid>/<projectId>.json`. Stub the storage object endpoint so downloads resolve
 * to the given JSON, keyed by the path SUFFIX (e.g. "_index.json"). A download of
 * an unlisted path 404s, which the app treats as "no such project".
 */
export async function stubStorage(
  context: BrowserContext,
  objects: Record<string, unknown>,
): Promise<void> {
  await context.route('**/storage/v1/object/**', (route) => {
    // Uploads and removes just succeed; only downloads (GET) return content.
    if (route.request().method() !== 'GET') return json(route, {});
    const path = new URL(route.request().url()).pathname;
    const match = Object.keys(objects).find((suffix) => path.endsWith(suffix));
    if (!match) return route.fulfill({ status: 404, body: 'Not found' });
    return json(route, objects[match]);
  });
}
