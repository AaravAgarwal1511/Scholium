# @repo/analytics

First-party product-analytics client for the Scholium suite. Batches session-level events and
inserts them into the `analytics_events` table. It is its **own** package — not part of `@repo/ui` —
because a telemetry client that queues and POSTs to PostgREST is backend logic, exactly what the
`@repo/ui` split exists to keep out (see CLAUDE.md → "Shared packages").

## Exports

- `AnalyticsProvider` — mount once per app, next to `SingleSessionGuard`. Owns the flush timers and
  the unload-safe flush. Takes the Supabase client **as a prop** (structural `SupabaseLike`, `any`-
  typed) so this package carries no `@supabase/supabase-js` dependency — same rationale as
  `@repo/session`.
- `useAnalytics()` → `{ track, setOptOut }`. Returns a **no-op** when no provider is mounted, so
  Storybook, tests, and the router-free `/demo` trees never crash.
- `usePageView(path)` — emits a `page_view` whenever `path` changes. Takes the path as an argument
  rather than importing `react-router-dom`, so it works in poetry-notes (no router) too.
- `Tracker`, `sanitizeProps` — the framework-free core, exported for unit testing.

## Boundaries

- No data-client dependency: the Supabase client is injected.
- `core.ts` has no DOM or network imports — every browser/transport dependency (storage, `fetch`,
  `now`, `randomId`) is injected, so it unit-tests in plain Node.
- `props` are sanitised to numbers, booleans, and strings ≤64 chars. No free text, ever.
- Off unless `import.meta.env.PROD && VITE_ANALYTICS_ENABLED === 'true'`, and short-circuited by
  GPC / DNT / the user's opt-out. A dead endpoint never throws and never blocks a render.
