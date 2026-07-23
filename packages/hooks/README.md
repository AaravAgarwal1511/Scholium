# @repo/hooks

Stateful **client-state** hooks shared across the Scholium suite: things that read and write
the browser (localStorage, `matchMedia`, the `<html>` class list) but never talk to a server.

- `useDarkMode` — theme preference, persisted to `localStorage` and applied as a class on
  `document.documentElement`.
- `useTourCompleted` / `useTourStyles` / `tourStyles` — onboarding-tour progress, persisted to
  `localStorage` per app key.

## Boundaries

This package must not import `@supabase/supabase-js`, or any other data client. `useTourCompleted`
supports cross-device sync through an **injected** `CloudSync` port (`load`/`save`/`reset`) that
the consuming app backs with its own Supabase client — the hook itself stays transport-agnostic.

Anything that owns a server round trip belongs in `@repo/session` (or its own feature package),
not here. Anything that only renders belongs in `@repo/ui`.
