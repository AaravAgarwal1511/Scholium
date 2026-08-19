// Deep link target for "Open in Mock Space". Overridable so a local dev server
// can point at mock-space's own dev port instead of the deployed app.
//
// Kept in its own module with no Supabase import, unlike the rest of
// mockSpaceHandoff.ts, so mockSpaceHandoff.test.ts can check it without
// triggering supabase/client.ts's module-scope createClient() call, which
// needs `localStorage` — unavailable when that test runs in vitest's node
// environment (see the file for why it needs node, not this project's jsdom).
// Must stay byte-equal to mock-space's own OWN_APP_URL in
// apps/mock-space/src/App.tsx — see that file's comment on why a stale copy
// here is a silent, hard-to-notice bug.
export const MOCK_SPACE_URL =
  (import.meta.env.VITE_MOCK_SPACE_URL as string | undefined)?.replace(/\/+$/, "") ||
  "https://mockspace.thescholium.com";
