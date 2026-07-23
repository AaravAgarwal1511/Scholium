# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Claude data lives in the repo (`Claude/`)

Claude Code stores a project's **memory (notes)** and **conversation transcripts** under `~/.claude/projects/<absolute-path-encoded>/`, keyed to the repo's absolute path — so moving the repo would orphan them. To keep Claude Code working wherever this repo is moved, that data is kept in the **git-ignored `Claude/`** dir at the repo root and bridged into place:

- `Claude/memory/` — the canonical memory notes. Claude Code's `…/projects/<path>/memory` is a **symlink** to this folder, so notes are always read/written here.
- `Claude/transcripts/` — archived session transcripts (`.jsonl` + per-session subdirs).

The bridge is `.claude/claude-sync.sh`, wired to two hooks in `.claude/settings.local.json`:
- **SessionStart** — symlinks `…/projects/<current-path>/memory` → `Claude/memory` and restores archived transcripts (so notes work and past conversations `--resume` at whatever path the repo lives).
- **SessionEnd** — archives the finished transcript(s) into `Claude/transcripts/`.

Both derive the project dir from the event's `transcript_path`, so nothing is hardcoded. **To move the repo:** move the whole directory — `Claude/` and the hooks travel with it, and the next launch re-links everything automatically. Never commit `Claude/` (transcripts can hold sensitive context). Because `Claude/` and `.claude/settings.local.json` are git-ignored, a fresh *clone* (unlike a move) won't carry the notes or hook wiring.

## Commands

### Root (runs across all apps via Turbo)
```bash
pnpm dev          # Start all dev servers
pnpm build        # Build all apps
pnpm lint         # Lint all packages
pnpm check-types  # Typecheck all packages (see "Type checking" below)
pnpm boundaries   # Verify no undeclared cross-package imports
pnpm preview      # Preview all built apps
pnpm test         # Vitest — browser tests (language-hub, recall-app, poetry-notes, @repo/ui) + node tests (mock-space)
pnpm test:e2e     # Playwright (language-hub, recall-app, poetry-notes)
```

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
- `pnpm test` — **2 failures** in recall-app. Run it with `--concurrency=1`: four packages each start a Chromium browser server, and in parallel they contend and flake.

## Architecture

This is a **pnpm monorepo** managed by **Turborepo** with six Vite+React apps and three shared packages.

```
apps/
  language-hub/   — Language learning flashcard app (React 18, SWC, TanStack Query, Recharts)
  recall-app/     — Spaced repetition study app (React 18, SWC)
  poetry-notes/   — Poetry note-taking app (React 19, Tiptap rich text editor)
  past-papers/    — Past-paper browser/generator (R2-backed PDFs, Express server)
  scholium-home/  — Suite landing page
  mock-space/     — Sit a past paper under exam conditions (pdf.js + append-only editor)
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

All five apps share a single **Supabase** instance. The `database/` directory contains all migrations (run in order) and PostgreSQL RPC functions. Each app creates its own schema but reads from shared tables (e.g., recall chapters/cards/progress). `language-hub` runs a local Express 5 server (`server.js`) proxied at `/api` → `localhost:3000`; `past-papers` runs its own on `localhost:3002` (`SERVER_PORT`).

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

### Storybook

`language-hub`, `recall-app`, `poetry-notes`, and `@repo/ui` have Storybook 10, each integrating Vitest as a Storybook addon so tests run inside the browser via Playwright.

On Storybook 10, `@storybook/react` and `@storybook/test` are **not** valid import sources here — neither is a declared dependency. Import `Meta`/`StoryObj` from `@storybook/react-vite` and test helpers from `storybook/test`. `pnpm boundaries` enforces this.
