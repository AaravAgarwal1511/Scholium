# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Claude data lives in the repo (`Claude/`)

Claude Code stores a project's **memory (notes)** and **conversation transcripts** under `~/.claude/projects/<absolute-path-encoded>/`, keyed to the repo's absolute path — so moving the repo would orphan them. To keep Claude Code working wherever this repo is moved, that data is kept in the **git-ignored `Claude/`** dir at the repo root and bridged into place:

- `Claude/memory/` — the canonical memory notes. Claude Code's `…/projects/<path>/memory` is a **symlink** to this folder, so notes are always read/written here.
- `Claude/transcripts/` — archived session transcripts (`.jsonl` + per-session subdirs).

The bridge is `.claude/claude-sync.sh`, wired to two hooks in `.claude/settings.local.json`:
- **SessionStart** — symlinks `…/projects/<current-path>/memory` → `Claude/memory`, restores archived transcripts (so notes work and past conversations `--resume` at whatever path the repo lives), and re-links `.claude/` into every git worktree.
- **SessionEnd** — archives the finished transcript(s) into `Claude/transcripts/`.

Both derive the project dir from the event's `transcript_path`, so nothing is hardcoded. **To move the repo:** move the whole directory — `Claude/` and the hooks travel with it, and the next launch re-links everything automatically. Never commit `Claude/` (transcripts can hold sensitive context). Because `Claude/` and `.claude/settings.local.json` are git-ignored, a fresh *clone* (unlike a move) won't carry the notes or hook wiring.

**Git worktrees** get the same bridge. A worktree is a second checkout at its own absolute path, so
Claude Code gives it its own `…/projects/<path>/` dir — and because `.claude/` is git-ignored, the
checkout `git worktree add` creates has no hook wiring and no copy of the script at all (its
SessionEnd hook used to die with *No such file or directory*). Two things close that gap:
`claude-sync.sh` resolves `Claude/` through `git rev-parse --git-common-dir`, so **every worktree
shares the main checkout's memory and transcript store**, and SessionStart symlinks
`<worktree>/.claude/{claude-sync.sh,settings.local.json}` back to main's copies. The hook command
itself also falls back to that git lookup, so a session started in a brand-new worktree — before any
SessionStart has run there — still finds the script. Only the main checkout gets the archived
transcripts restored into its project dir; a worktree resumes the sessions it actually ran.

## Commands

### Root (runs across all apps via Turbo)
```bash
pnpm dev          # Start all dev servers
pnpm build        # Build all apps
pnpm lint         # Lint all packages
pnpm check-types  # Typecheck all packages (see "Type checking" below)
pnpm boundaries   # Verify no undeclared cross-package imports
pnpm preview      # Preview all built apps
pnpm test         # Vitest — browser tests (language-hub, recall-app, poetry-notes, @repo/ui) + node tests (mock-space, notes)
pnpm test:e2e     # Playwright real journeys — all 7 apps. mock-space rides signed-out /demo;
                  #   the five gated apps seed a fake session + stub Supabase at the network layer
pnpm test:db      # Security suite against the DEPLOYED Supabase project (see below)
pnpm lint:db      # Lint database/ — turbo cannot, it is not a workspace package
pnpm check-types:db  # Typecheck database/tests against its own tsconfig
```

`lint`, `check-types` and `test` all run through Turbo, which only sees workspace packages. `database/`
is not one, so it has the two `:db` scripts above; both run in CI's `static` and `types` jobs. Their
tooling (eslint, typescript, and the root `eslint.config.mjs`) lives in the **root** package.json, and
the root config ignores `apps`/`packages`/`admin` so it can never shadow a package's own.

Pass `--filter` to scope any of these to one package, e.g. `pnpm dev --filter=past-papers`.
Running bare `pnpm dev` starts every app at once.

### Dev server ports

| App | Vite | Express |
|---|---|---|
| language-hub | 8080 | 3000 |
| recall-app | 8081 | — |
| poetry-notes | 5173 | — |
| scholium-home | 3030 | — |
| past-papers | 3040 | 3002 (`SERVER_PORT`) |
| mock-space | 3050 | — |
| notes | 3060 | — |

Storybook runs on 6006 for the apps and 6007 for `@repo/ui`.

### Type checking

`check-types` is **not** wired into `build` — `vite build` never typechecks. Two apps have
known pre-existing errors: **language-hub (23)** and **recall-app (7)**. Everything else is
at zero. If you see different numbers, you changed something.

Most of the recall-app/language-hub errors trace to `.from("scholium_apps")`: that table is
absent from both apps' generated `src/integrations/supabase/types.ts` and from `database/`,
so the typed client resolves the query against the tables it does know and `App.tsx` casts
past the resulting `SelectQueryError` with `as AppLink[]`. Fixing it needs a types regen.

### Known pre-existing failures

Baselines, so you can tell a regression from the status quo:

- `pnpm lint` — **0 problems**. Every package is clean; treat any new warning as a regression.
- `pnpm check-types` — **30 errors** (language-hub 23, recall-app 7). Everything else clean.

Turbo aborts sibling tasks as soon as one fails, so a single failing `pnpm lint` run cannot show
you every problem at once. To confirm a baseline, run `npx eslint .` inside each package.
- `pnpm test` — **0 failures**, ~357 tests across all 10 packages (every package has real tests; no
  `--passWithNoTests` remains). Run it with `--concurrency=1`: four packages each start a Chromium
  browser server, and in parallel they contend and flake.

The `check-types` baseline is enforced by `scripts/check-types-ratchet.sh`, which fails CI only when
the count *rises*. Lower its `BASELINE` whenever you pay some of the debt down.

### Test layout

Each app runs its tests through vitest projects rather than a bare `include`:

| Project | Where | Environment |
|---|---|---|
| `unit` | `src/**/*.test.{ts,tsx}` in every app + `@repo/ui` | jsdom |
| `server` | `server/**` and `api/**` in past-papers | node |
| `storybook` | `*.stories.tsx` in language-hub, recall-app, poetry-notes, `@repo/ui` | chromium via Playwright |

`notes` uses a single top-level vitest config (jsdom, `src/**/*.test.{ts,tsx}`) — no
projects, no browser tests.

**A `projects` array replaces the root-level `include`.** Before this existed, the four Storybook
packages defined only a `storybook` project, so any `src/**/*.test.ts` was collected by nothing and
passed silently. If you add a test file and vitest reports "No test files found", check that the
package declares a project whose `include` covers it.

`mock-space`, `@repo/analytics`, `@repo/hooks` and `@repo/session` have no browser tests and so use a
single top-level config instead of projects.

### Auth-seeded e2e (all five gated apps)

recall-app, language-hub, poetry-notes, past-papers and notes each drive the real app with **no
account and no backend** — the session is seeded into localStorage and every Supabase request is
stubbed at the network layer. Each app carries its own copy of `e2e/support/auth.ts` (the fixture is
app-agnostic; the per-app stubs live in the specs). This is the complement to `pnpm test:db`: that
proves the real RLS, this proves the UI journeys. The CI `e2e` job is a matrix over all six
test-bearing apps; every one runs its dev server with `pnpm exec vite --mode test` so the committed
`.env.test` supplies a dummy URL and no secrets are needed.

Per-app surfaces the specs stub, so you know what to copy:
- **recall-app / language-hub** — REST tables. Watch the single-vs-list split (`recall_chapters` and
  `vocabulary_sets` are read both ways); branch on the `accept: vnd.pgrst.object` header.
- **poetry-notes** — Storage bucket, not tables. `stubStorage()` (added to its `auth.ts` copy) fakes
  `<uid>/_index.json` and `<uid>/<projectId>.json` downloads.
- **past-papers** — browsing is NOT auth-gated; with `VITE_R2_PUBLIC_URL` unset (the .env.test
  default) papers.ts lists from Storage, so the spec stubs the `object/list` endpoint and branches on
  the `prefix` in the POST body to fake the subject/component/chapter tree.
- **notes** — every route IS auth-gated. `stubNotesStorage()` (added to its `auth.ts` copy) fakes the
  private `notes` bucket's `object/list` (the flat PDF list) and `object/sign` (the signed URL the
  `<iframe>` loads) endpoints.

The five seeding gotchas — storage-key hostname derivation, loadEnv in the config, route registration
order, single-vs-list on the `accept` header, and (meta) that a `rest/v1` glob inside a block comment
closes it early — are documented in each `auth.ts` header. Read it before extending.

### Accessibility gates (`e2e/a11y-scan.spec.ts` per app)

Every app has an axe scan (`@axe-core/playwright`) on its primary page(s), reusing the same seeding
fixture. The gate is **zero serious/critical WCAG 2.1 A/AA violations**, with `color-contrast`
disabled — that rule is design-token-dependent (brand-tint badges, hover states) and belongs to a
separate design pass; the gate targets unambiguous semantic defects (missing accessible names,
invalid ARIA, roles). All seven apps currently pass, so the bar is zero, not a baseline. Standing up
these gates surfaced and fixed real bugs: the shared `ScholiumNavbar` search input carried
`aria-expanded`/`aria-autocomplete` without `role="combobox"` (invalid ARIA on **every** page of every
app — fixed in `@repo/ui` as a proper combobox with `aria-controls`/`aria-activedescendant`), and
language-hub's icon-only edit/delete/back controls and its progress bar had no accessible names.
When adding a page or an icon-only control, run the app's a11y scan; a bare icon button needs an
`aria-label`.

### Visual regression (`pnpm --filter <app> test:visual`)

Six apps have full-page screenshot baselines (`toHaveScreenshot`) of their primary HTML pages, driven
through the same stubbed seeding so the render is deterministic. Kept **separate from the default e2e
run**: the specs are `e2e-visual/*.visual.ts` (not `.spec.ts`) under their own
`playwright.visual.config.ts`, so `playwright test` never collects them — only `test:visual` does.
Canvas/PDF surfaces (mock-space's attempt page) are deliberately not snapshotted; pdf.js rasterisation
varies by platform and they are covered functionally.

**These baselines are a LOCAL guard, not CI-enforced.** Screenshots are platform-specific (Playwright
suffixes them `-darwin` / `-linux`) and the committed ones were generated on the dev machine. CI runs
on Linux and would need `-linux` baselines. The `visual-baselines.yml` workflow (manual dispatch)
regenerates them on ubuntu and uploads them as an artifact; commit those into each
`e2e-visual/*-snapshots/` dir to enable enforcement, then add the suite to `ci.yml`. After any
intended UI change, refresh with `pnpm --filter <app> test:visual -- --update-snapshots` and review
the diff before committing.

### Lighthouse budgets (`pnpm --filter scholium-home lighthouse`)

Performance / accessibility / best-practices / SEO budgets for **scholium-home** — the public
marketing site, the one app where these signals matter and where no auth blocks Lighthouse. Config in
`apps/scholium-home/lighthouserc.cjs`: it builds, serves the result with `vite preview` (dev-server
scores are meaningless), and runs Lighthouse 3× per URL over `/`, `/about`, `/memory-science`, taking
the median. Budgets are `minScore 0.9` on all four categories — calibrated from measured medians
(perf 1.00, a11y 0.92–0.96, best-practices 0.96, seo 0.92) and held below them so a real regression
(a dropped meta tag, a heavy new dependency, an unlabelled control) fails while run-to-run noise does
not. Unlike visual baselines, category scores are portable enough to enforce in CI: `lighthouse.yml`
runs on any change under `apps/scholium-home/**`. The other apps are gated behind auth (Lighthouse
can't use the network stubs), so this is scoped to the public site; extend to their `/signin` pages if
wanted. `.lighthouseci/` reports are gitignored.

### Database security suite (`pnpm test:db`)

Two files under `database/tests/`, run via `vitest.db.config.ts`. **Deliberately outside `pnpm test`
and outside `ci.yml`**: they assert things about the *deployed* database, not about the checkout, so
they must never gate a PR — a green PR would otherwise imply a claim about production that the PR's
code has no bearing on. `.github/workflows/db-security.yml` runs them daily instead.

| File | Credential | Question |
|---|---|---|
| `anon-access.test.ts` | anon key, over HTTPS | what can a signed-**out** caller reach? |
| `rls-isolation.test.ts` | linked Supabase CLI | can a signed-**in** user reach someone else's rows? |

The anon key is the right credential to attack with because it is public by construction — it ships
in all six client bundles. The service role key is never used by either file.

`rls-isolation.test.ts` creates **no test accounts**. `auth.uid()` reads `request.jwt.claims`, so a
transaction can simply declare who it is:

```sql
begin;
set local role authenticated;
set local request.jwt.claims to '{"sub":"<uuid>","role":"authenticated"}';
…
rollback;
```

Real user ids are discovered at run time, so no UUIDs or emails are committed. It needs
database-level access rather than just the anon key, so it **skips** wherever the linked CLI is
unavailable — CI included. Roughly 60s: every assertion is a separate CLI process.

The table classification in that file is hardcoded, not derived from `pg_policies`, and that is the
point — `analytics_events` is listed as write-only, so if anyone ever adds a `SELECT` policy to it
the suite fails. Clients insert events and can never read them back; the only read path is the
SECURITY DEFINER `admin_analytics_*` RPCs.

Every probe is inert by construction: read-only RPCs are called as-is, mutating RPCs only with ids
that cannot match a row, and `admin_save_chapter` / `admin_save_two_sider` are never called at all
(they could INSERT on a bogus id) — they are covered by the static guard-coverage audit instead.
Keep it that way; do not "test properly" by substituting real ids.

Two live findings so far, both fixed:
- `_assert_admin` gated on `email <> '…'`, and `NULL <> 'x'` is NULL, not TRUE — so the guard passed
  for anonymous callers. Fixed by `IS DISTINCT FROM` in 20260724000000 / 20260724020000.
- `refresh_analytics_daily` was SECURITY DEFINER, unguarded and anon-executable, letting anyone wipe
  the `analytics_daily` rollup beyond the 180-day `analytics_events` retention. Fixed in
  20260724050000 — see the grants gotcha below.

**`REVOKE … FROM public` does not revoke from `anon`.** Supabase's default privileges grant EXECUTE
*directly* to the `anon` and `authenticated` roles, and a direct role grant survives a revoke aimed
at PUBLIC. 20260724040000 ran `REVOKE ALL … FROM public` and the function stayed wide open. Always
`REVOKE EXECUTE ON FUNCTION … FROM anon, authenticated`, and verify with `proacl` rather than
assuming — a leading `=X/postgres` in the ACL is PUBLIC, `anon=X/postgres` is the direct grant.

Note that adding `_assert_admin()` is the *wrong* fix for anything pg_cron calls: cron jobs run as
`postgres` with no JWT, so `auth.uid()` is NULL and the guard would raise. Use grants there.

Every app has a committed **`.env.test`** holding dummy Supabase values. `src/integrations/supabase/
client.ts` calls `createClient()` at module scope, so merely importing a page throws
`supabaseUrl is required` without them — which is why the suites could not run on a fresh clone or in
CI. They are not credentials, and Vite only loads them when the mode is `test`.

Storybook substitutes `src/__mocks__/supabase-client.ts` for the real client via an alias in
`.storybook/main.ts`. That alias matches the `@/integrations/supabase/client` specifier only —
poetry-notes imports the client by *relative* path everywhere, so its stories get the real client and
rely on `.env.test` instead.

### Two remotes: merge PRs on DD10654 only

The repo lives on **two** GitHub remotes. `origin` has one fetch URL and *two push URLs*, so a plain
`git push` already reaches both:

| Repo | Role |
|---|---|
| `DD10654/Scholium` | **Canonical.** origin's fetch URL; open and merge PRs here |
| `AaravAgarwal1511/Scholium` | **Pure mirror.** Never merge a PR on it |

Local pushes were never the problem — *server-side* merges are. Clicking "Merge" on a PR creates a
merge commit inside GitHub that never passes through any clone, so doing it on both repos for the
same branch yields two different merge commits over **identical trees** and the two mains fork. That
happened to `unit-tests`, `new-subjects` and `fix/schema-drift-secrets-if`, and was repaired in
`d991662` by merging the mirror back in — not by force-pushing, which would have orphaned the other
repo's PR merges for no content gain.

To diagnose a suspected fork: `git diff main mirror/main` empty means the *content* already matches,
and `git log --oneline --no-merges main..mirror/main` empty means the extra commits are merges only.
That combination is cosmetic — merge, don't force.

`.github/workflows/mirror.yml` makes this self-healing: on every push to `main` it force-pushes
canonical → mirror. It is guarded by `if: github.repository == 'DD10654/Scholium'` because the file
is itself mirrored and would otherwise run on the mirror and push to itself. It needs a
`MIRROR_TOKEN` secret (PAT, write access to the mirror) and skips with a warning if that is unset, so
an unconfigured fork never shows a red X. Only `main` is mirrored — feature branches already reach
both repos via the dual push URLs.

## Architecture

This is a **pnpm monorepo** managed by **Turborepo** with seven Vite+React apps and three shared packages.

```
apps/
  language-hub/   — Language learning flashcard app (React 18, SWC, TanStack Query, Recharts)
  recall-app/     — Spaced repetition study app (React 18, SWC)
  poetry-notes/   — Poetry note-taking app (React 19, Tiptap rich text editor)
  past-papers/    — Past-paper browser/generator (R2-backed PDFs, Express server)
  scholium-home/  — Suite landing page
  mock-space/     — Sit a past paper under exam conditions (pdf.js + append-only editor)
  notes/          — Login-gated reader for study-note PDFs (private Supabase bucket, native <iframe> viewer)
packages/
  ui/             — @repo/ui      presentational components only (React 18/19 compatible)
  hooks/          — @repo/hooks   client-state hooks (localStorage/DOM, no server)
  session/        — @repo/session Supabase-backed session logic
database/         — Shared Supabase migrations and RPC definitions
```

Only `apps/*` and `packages/*` are workspace packages. `database/`, `scripts/`, and
`email-templates/` are not — nothing imports from them.

### Shared packages

All three are consumed as raw TypeScript source (`exports["."] → ./src/index.ts`); there is no
build step. Import only via the declared entrypoints — `pnpm boundaries` fails on deep imports,
and on importing a package an app has not declared in its own `package.json`.

The split exists to keep **backend logic out of the UI library**. One rule per package:

| Package | Owns | Must never |
|---|---|---|
| `@repo/ui` | Rendering. `AuthCard`, `SettingsLayout`, `SettingsCard`, `ScholiumLogo`, `ScholiumNavbar`, `ScholiumFooter`, `LegalPage`, `TermsOfService`, `PrivacyPolicy`, `SCHOLIUM_HOME_URL` | Touch a network, a data client, or `localStorage` |
| `@repo/hooks` | Client state that reads/writes the browser. `useDarkMode`, `useTourCompleted`, `useTourStyles`, `tourStyles` | Import a data client; remote sync arrives via an injected port |
| `@repo/session` | Server-backed session logic. `SingleSessionGuard` (`active_sessions` + Realtime) | — the Supabase client is injected as a prop, so it carries no `@supabase/supabase-js` dep |

`@repo/ui` also exports CSS subpaths: `tokens.css`, `auth-card.css`, `settings-layout.css`,
`settings-card.css`, `scholium-navbar.css`, `legal.css`.

The only edge in the graph is `@repo/ui → @repo/hooks`: `ScholiumNavbar` calls `useDarkMode`, which
is why every app gets the `dark` class for free just by mounting the navbar. `@repo/session` depends
on neither of the others.

New shared code goes in the package matching the rule above — if it does a round trip, it does not
belong in `@repo/ui`.

### Backend & Database

All seven apps share a single **Supabase** instance. The `database/` directory contains all migrations (run in order) and PostgreSQL RPC functions. Each app creates its own schema but reads from shared tables (e.g., recall chapters/cards/progress). `language-hub` runs a local Express 5 server (`server.js`) proxied at `/api` → `localhost:3000`; `past-papers` runs its own on `localhost:3002` (`SERVER_PORT`).

### Routing & State

All apps use **react-router-dom v6** for SPA routing with `vercel.json` rewrite rules for deployment. Forms use **React Hook Form + Zod**. `language-hub` uses **TanStack Query v5** for server state; the other apps use local React state.

### UI Stack

All apps use **Tailwind CSS** with **shadcn/ui** (Radix UI primitives + CVA). Design tokens are CSS variables defined in `tailwind.config.ts` — look there first when adjusting colors or theming. `recall-app` adds custom purple tokens and keyframe animations. Path alias `@/` maps to `src/` in all apps.

### App-Specific Notes

- **language-hub**: uses `lovable-tagger` in dev for component tagging; has the most complete feature set including Recharts dashboards and Embla Carousel.
- **recall-app**: ESLint, Storybook, Vitest, and Playwright — same setup as language-hub.
- **poetry-notes**: uses `@vitejs/plugin-react` (Babel, not SWC), Tiptap editor, Vitest with Storybook addon and Playwright browser provider, and React 19. Its `build` is the only one that typechecks (`tsc -b && vite build`).
- **past-papers** / **scholium-home**: no Storybook, no tests.
- **mock-space**: no Express server. Everything a student produces belongs to their **account, not
  their browser** — nothing is stored locally except `localStorage["mock-space:active-attempt"]`, a
  pointer to whichever attempt the tab has open. Answers, boxes, strokes and the clock live in the
  `mock_attempts` table (`attemptStore.ts`); the question paper lives in the private Storage bucket
  `mock-space-papers` under `{user_id}/{attempt_id}.pdf` (`paperStorage.ts`). Both are RLS-scoped to
  `auth.uid()`, so signing in on another machine resumes the same attempt mid-exam.

  Because Storage holds the *only* copy of the paper, `startAttempt` **awaits** the upload and
  refuses to begin if it fails — an attempt row must never exist without the paper it refers to.
  Autosave is debounced (800 ms) and a failure raises the "Not saved" chip rather than losing work
  silently. The `/demo` attempt is signed out and therefore deliberately ephemeral: it stores
  nothing and does not survive a reload.

  Retention: `api/prune-papers.js` — the app's one serverless function, run daily by Vercel Cron
  with `CRON_SECRET` + `SUPABASE_SERVICE_ROLE_KEY` — deletes papers **and** their `mock_attempts`
  rows once they are older than `PAPER_RETENTION_DAYS` (15). The two expire together because a
  script cannot be exported without the paper it was written on. That constant is duplicated in the
  cron (it runs outside Vite and cannot import TS); `paperRetention.test.ts` reads the file and
  fails if the two drift. Paper deletion must go through the Storage API — dropping rows from
  `storage.objects` orphans the underlying files.

  Vitest runs in **node**, not a browser, so it does not contend with the Playwright-backed suites.
  `pnpm make:sample --filter=mock-space` regenerates `public/sample-paper.pdf`, the paper `/demo`
  opens.

  **e2e (`pnpm --filter mock-space test:e2e`)** rides `/demo` for exactly the reason the route's own
  comment gives — it is a real attempt through the real pipeline, but signed out and ephemeral, so
  the whole surface below the auth gate is drivable with no account and no seeding. `e2e/helpers.ts`
  reaches a running attempt with a focused box; `append-only.spec.ts` proves the guarantee model.test
  already proves in the unit, but through the real textarea sink and real keyboard events — the wiring
  the model cannot vouch for. Two behaviours there are load-bearing and easy to get wrong when writing
  the tests: select-all is a **blocked chord** (`BLOCKED_CHORDS` in AnswerBox), so it selects nothing
  and Backspace only nibbles the pending word; and the export heading is `Time&rsquo;s up` with a
  typographic apostrophe, so match it with a regex, not a straight `'`. Stable selectors:
  `data-testid` on `timer-start`/`timer-pause`/`timer-finish`/`clock`/`download`/`save-failed`, plus
  `data-page`, `data-box`, `textarea.ms-sink`, and `.ms-text`.

  Four invariants hold the app together; breaking any one silently corrupts a student's script:

  1. **`pdfjs.getDocument({data})` transfers the buffer**, leaving the original detached. The
     exporter re-reads the original bytes at the end of the attempt, so `loadPdf()` always hands
     pdf.js a clone and `AttemptContext` keeps the pristine copy in a ref.
  2. **pdf-lib applies neither kerning nor ligatures** — `widthOfTextAtSize` just sums glyph
     advances. So `.ms-line` sets `font-kerning: none` and disables `liga`, and widths are additive
     (a prefix-sum array is exact). `metrics.ts` documents this; `textLayout.test.ts` asserts it.
  3. **One font, `dejavu-fonts-ttf`, for both screen and export.** `answerFont.ts` fetches it once
     and hands the same bytes to `FontFace` and `embedFont`. `layoutText()` then decides line breaks
     for the editor *and* the exporter, which is the only reason the exported PDF wraps where the
     student saw it wrap. Do not let CSS wrap answer text.
  4. **Geometry is stored in model space**: PDF points, origin top-left. Screen pixels are derived,
     never stored. `coords.ts` owns the single y-flip to pdf-lib's bottom-left origin. `loadPdf()`
     rejects rotated pages and offset crop boxes so that transform stays a scale plus a flip.

  The append-only rules (`model.ts`) are pure functions, deliberately outside React: the integrity
  guarantee is proved by `model.test.ts`, not by poking the DOM.

  5. **The hidden textarea in `AnswerBox.tsx` holds the pending word — exactly the uncommitted
     tail — and nothing else.** Committed text lives only in the model, so the browser cannot
     reach it: there is nothing behind the sink's first character to backspace into, select, or
     undo. Append-only is therefore structural, not a matter of catching every event, and
     `setPending()` is the single write (it copies committed text through and never moves
     `commitIndex` backwards).

     Do **not** go back to intercepting `insertText` and replaying it into the model, which is
     what left the sink permanently empty. The macOS press-and-hold accent menu works by
     *selecting* the base letter and overwriting it with an ordinary `insertText` — with an empty
     sink it has nothing to select and silently re-inserts the base letter, so accents cannot be
     typed at all. (It does **not** use `insertReplacementText`; that is mobile autocorrect
     rewriting a finished word, and stays in `REFUSED_INPUT_TYPES`.) For the same reason, never
     write to `sink.value` mid-word: it destroys the selection the accent menu is relying on.
     `REFUSED_INPUT_TYPES` is the whole list of edits still preventDefaulted — paste, drop, undo,
     word-at-a-time deletes.

- **notes**: the newest app and the smallest — scaffolded from mock-space (no shadcn, no Radix,
  strict tsconfig, untyped Supabase client). A signed-in student sees a flat list of note PDFs and
  opens one in a browser-native `<iframe>`; there is no subject/topic hierarchy and no in-app PDF
  renderer (deliberately — the native viewer gives text search/print/zoom for free).

  **Every route is auth-gated** (`RequireAuth` in `App.tsx`), unlike mock-space / past-papers. But
  the real gate is the **private `notes` Storage bucket**: its RLS policy is `FOR SELECT TO
  authenticated` only (`database/migrations/20260903000000_notes_storage.sql`), so `anon` cannot
  list or sign a single object — a logged-out visitor with a direct link gets nothing. The route
  guard is only a convenience. `database/tests/anon-access.test.ts` has the regression probe for
  the bucket failing open.

  **No index table.** `src/lib/notes.ts` lists the bucket directly with
  `supabase.storage.from('notes').list()` (possible only because it is Supabase, not R2 — R2 has no
  client-safe listing, which is why past-papers needs `paper_files`). Everything the reader sees is
  derived from the object name: an optional leading `"{n}-"` sets the display order, the rest is the
  title. Renaming a file in the Supabase dashboard is the whole way to retitle or reorder a note.
  PDFs reach the browser as 1-hour signed URLs (`createSignedUrl`); the bucket has no public URL.

  **Publishing = dragging a PDF into the `notes` bucket in the Supabase dashboard.** No ingestion
  script, no service-role key in any `.env`, no `pnpm index:*`. In prod the `scholium_apps` row
  (`url = https://notes.thescholium.com`) is inserted by hand — that table has no write policy.

  For local dev, `pnpm seed:notes --filter=notes` (`scripts/seed-notes.mjs`) uploads four sample
  PDFs it generates on the fly into the **local** bucket, so `pnpm dev` has something to list. It
  refuses any non-`127.0.0.1`/`localhost` target and uses the CLI's fixed local demo service-role
  key. Re-run it after a `supabase db reset` (which drops the bucket until the migration re-applies).

### Storybook

`language-hub`, `recall-app`, `poetry-notes`, and `@repo/ui` have Storybook 10, each integrating Vitest as a Storybook addon so tests run inside the browser via Playwright.

On Storybook 10, `@storybook/react` and `@storybook/test` are **not** valid import sources here — neither is a declared dependency. Import `Meta`/`StoryObj` from `@storybook/react-vite` and test helpers from `storybook/test`. `pnpm boundaries` enforces this.
