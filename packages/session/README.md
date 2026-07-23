# @repo/session

Server-backed **session logic** for the Scholium suite. This is the package that owns a data
round trip, which is exactly why it does not live in `@repo/ui`.

- `SingleSessionGuard` — concurrent-session kicking (anti account-sharing). Claims the
  active-session slot for `(user_id, app_key)` in the `active_sessions` table, subscribes to
  Supabase Realtime on that row, and signs the losing device out when another device claims it.

## Boundaries

The Supabase client is **injected as a prop**, not imported, so this package carries no
`@supabase/supabase-js` dependency of its own — see the `SupabaseLike` note in
`SingleSessionGuard.tsx` for why that interface is deliberately `any`-typed.

Sessions are scoped per `app_key` because the suite's apps are separate origins with separate
auth sessions and `localStorage`; a user running two apps at once must not kick themselves.

The "Signed out" overlay ships with the guard rather than in `@repo/ui`: it is inline-styled,
self-contained, and meaningless without the logic that raises it. Keeping the feature in one
place means an app wires up one component, not two.
