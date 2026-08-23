-- Base table for scholium_apps — reconstructed retroactively.
--
-- scholium_apps was created manually in the Supabase dashboard before migrations
-- were tracked (see the comment repeated in 20260527000000_scholium_apps_subjects.sql
-- and its two siblings, which only ALTER a table assumed to already exist). That
-- means no migration in this repo could ever recreate it from empty, so
-- `supabase db reset` on a fresh database — local or staging — fails the moment
-- it reaches those ALTERs.
--
-- Columns and defaults below are reverse-engineered from the live schema via
-- database/schema-types.snapshot.ts (generated with `--linked` against prod), not
-- from a dashboard export. That gives high confidence in column names, types, and
-- which columns are nullable/defaulted — TypeScript optionality on Insert directly
-- reflects a DB default. It gives NO information about RLS policies, grants, or
-- constraints beyond NOT NULL, since none of that is encoded in generated types.
--
-- The public-read policy below is inferred from usage, not verified: every app's
-- App.tsx reads scholium_apps for its nav links, and scholium-home (a public,
-- signed-out marketing site — see CLAUDE.md) reads it too, so anon SELECT must
-- already be allowed in prod. No write policy is created here — every write in
-- this repo's history was manual, so writes stay dashboard/service-role only,
-- matching the apparent prod behaviour.
--
-- ACTION REQUIRED before trusting this file: run `supabase db pull` against prod
-- (Phase 0 of the staging plan) and diff the result against this migration. If
-- pull reports anything for scholium_apps — a different constraint, a missing
-- policy, a grant — fold that diff in here and remove this notice.
--
-- id is TEXT, not UUID: a fresh local replay caught this directly —
-- 20260613000000_scholium_apps_tags.sql does `where id in ('language-hub',
-- 'recall-app', 'poetry-notes')`, i.e. id is the app's slug, not a generated
-- uuid. TypeScript's generated `id: string` can't distinguish the two, so this
-- was wrong on the first pass; the replay is what surfaced it.
--
-- The default below was added the same way: a live `--linked` type pull shows
-- prod's Insert.id as optional (`id?: string`), which only happens when the
-- column has a DB-level default. gen_random_uuid()::text is a guess at the
-- expression, not a verified one — every row that matters (the six in
-- database/seed.sql) sets id explicitly anyway, so the default's exact form is
-- low-stakes as long as it exists.

CREATE TABLE IF NOT EXISTS public.scholium_apps (
  id          TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  title       TEXT NOT NULL,
  url         TEXT NOT NULL,
  icon        TEXT,
  description TEXT,
  subjects    TEXT[] NOT NULL DEFAULT '{}',
  has_demo    BOOLEAN NOT NULL DEFAULT false,
  no_login    BOOLEAN NOT NULL DEFAULT false,
  sort_order  INTEGER NOT NULL DEFAULT 0,
  created_at  TIMESTAMP WITH TIME ZONE DEFAULT now()
);

ALTER TABLE public.scholium_apps ENABLE ROW LEVEL SECURITY;

CREATE POLICY "scholium_apps: public read"
  ON public.scholium_apps FOR SELECT
  USING (true);
