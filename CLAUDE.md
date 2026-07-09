# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

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

- `pnpm lint` — **49 problems** (language-hub 20, poetry-notes 18, recall-app 6, past-papers 3, scholium-home 2). `@repo/ui` and `mock-space` are clean.
- `pnpm check-types` — **30 errors** (language-hub 23, recall-app 7). Everything else clean.

Turbo aborts sibling tasks as soon as one fails, so a single `pnpm lint` run cannot show you
all 49. To confirm a baseline, run `npx eslint .` inside each package.
- `pnpm test` — **2 failures** in recall-app. Run it with `--concurrency=1`: four packages each start a Chromium browser server, and in parallel they contend and flake.

## Architecture

This is a **pnpm monorepo** managed by **Turborepo** with six Vite+React apps and one shared UI package.

```
apps/
  language-hub/   — Language learning flashcard app (React 18, SWC, TanStack Query, Recharts)
  recall-app/     — Spaced repetition study app (React 18, SWC)
  poetry-notes/   — Poetry note-taking app (React 19, Tiptap rich text editor)
  past-papers/    — Past-paper browser/generator (R2-backed PDFs, Express server)
  scholium-home/  — Suite landing page
  mock-space/     — Sit a past paper under exam conditions (pdf.js + append-only editor)
packages/
  ui/             — @repo/ui shared component library (React 18/19 compatible)
database/         — Shared Supabase migrations and RPC definitions
```

Only `apps/*` and `packages/*` are workspace packages. `database/`, `scripts/`, and
`email-templates/` are not — nothing imports from them.

### Shared UI Package (`@repo/ui`)

Consumed as raw TypeScript source (`exports["."] → ./src/index.ts`); there is no build step.
Exports `AuthCard`, `SettingsLayout`, `SettingsCard`, `ScholiumLogo`, `ScholiumNavbar`,
`ScholiumFooter`, `LegalPage`, `TermsOfService`, `PrivacyPolicy`, `SingleSessionGuard`, the
`SCHOLIUM_HOME_URL` constant, and the hooks `useDarkMode` / `useTourCompleted` (plus
`useTourStyles`). Also exports CSS subpaths: `tokens.css`, `auth-card.css`,
`settings-layout.css`, `settings-card.css`, `scholium-navbar.css`, `legal.css`.

Import only via the declared entrypoints — `pnpm boundaries` fails on deep imports.

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
- **mock-space**: entirely client-side — no Express server, no serverless functions, no tables of
  its own. The uploaded PDF never leaves the browser; attempts live in IndexedDB (`mock-space` DB).
  Login is required, but only for identity. Vitest runs in **node**, not a browser, so it does not
  contend with the Playwright-backed suites. `pnpm make:sample --filter=mock-space` regenerates
  `public/sample-paper.pdf`, the paper the no-signup `/demo` route opens.

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
  guarantee is proved by `model.test.ts`, not by poking the DOM. `AnswerBox.tsx` uses a hidden
  textarea as a keystroke sink whose `value` is never read — the browser's undo stack is therefore
  inert by construction rather than suppressed.

### Storybook

`language-hub`, `recall-app`, `poetry-notes`, and `@repo/ui` have Storybook 10, each integrating Vitest as a Storybook addon so tests run inside the browser via Playwright.

On Storybook 10, `@storybook/react` and `@storybook/test` are **not** valid import sources here — neither is a declared dependency. Import `Meta`/`StoryObj` from `@storybook/react-vite` and test helpers from `storybook/test`. `pnpm boundaries` enforces this.
