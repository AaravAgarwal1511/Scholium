-- Owner-scope the remaining language-hub tables: vocabulary_sets,
-- vocabulary_items, set_progress.
--
-- These three shipped with fully open RLS in the migration history —
-- "Anyone can view/create/update/delete ...", USING/WITH CHECK (true) — from
-- 20251203142017 and 20260113004227. Prod was silently re-scoped to
-- auth.uid() = user_id at some point out-of-band (no migration records it;
-- verified live via `supabase db query --linked`), but every environment
-- built from this repo's migrations — local `supabase db reset`, CI, a fresh
-- staging project — gets the wide-open version. There, any signed-in user
-- reads, edits, and deletes every other user's sets, items, and progress.
-- 20260905000000_folders_user_scope.sql closed the folders half of this;
-- foldered sets then hide behind the (now per-user) folder list in the UI,
-- but a set with folder_id IS NULL has nothing hiding it and shows up in
-- everyone's dashboard.
--
-- This migration reconciles the file history to prod's real, deployed model,
-- reproducing prod's exact policies:
--   * vocabulary_sets / set_progress — direct owner column, auth.uid() = user_id
--   * vocabulary_items — no owner column; transitively scoped through the
--     parent set's owner (EXISTS against vocabulary_sets.user_id)
--
-- No backfill and no `OR user_id IS NULL` branch: prod has 0 null-owner rows
-- in vocabulary_sets (266) and set_progress (1490), and its live policies
-- already have no null-owner escape hatch — legacy null-owner rows are
-- already invisible there and have been. On prod this migration is a no-op
-- (drop then recreate identical policies; the "Anyone can ..." DROPs match
-- nothing). Locally it is the actual fix.
--
-- The deferral this completes is called out verbatim in
-- 20260901000000_practice_sample_user_scope.sql ("Real per-user isolation is
-- a separate migration ... needs a folders.user_id column too") and
-- 20260822000000_reconcile_language_hub_schema_drift.sql.
--
-- No client changes: every read in apps/language-hub already leans on RLS for
-- scoping with no explicit user_id filter, and the two insert paths that need
-- it (CreateSet.tsx for vocabulary_sets, Study.tsx for set_progress) already
-- pass user_id. Study.tsx's `set_progress.delete().eq("set_id", id)` on
-- "restart study" previously wiped every user's progress for that set; owner
-- scoping incidentally fixes that too.

ALTER TABLE public.vocabulary_sets  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vocabulary_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.set_progress     ENABLE ROW LEVEL SECURITY;

-- ── vocabulary_sets ──────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Anyone can view vocabulary sets"   ON public.vocabulary_sets;
DROP POLICY IF EXISTS "Anyone can create vocabulary sets" ON public.vocabulary_sets;
DROP POLICY IF EXISTS "Anyone can update vocabulary sets" ON public.vocabulary_sets;
DROP POLICY IF EXISTS "Anyone can delete vocabulary sets" ON public.vocabulary_sets;
DROP POLICY IF EXISTS "Users can view own sets"   ON public.vocabulary_sets;
DROP POLICY IF EXISTS "Users can create own sets" ON public.vocabulary_sets;
DROP POLICY IF EXISTS "Users can update own sets" ON public.vocabulary_sets;
DROP POLICY IF EXISTS "Users can delete own sets" ON public.vocabulary_sets;

CREATE POLICY "Users can view own sets"
ON public.vocabulary_sets FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can create own sets"
ON public.vocabulary_sets FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own sets"
ON public.vocabulary_sets FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own sets"
ON public.vocabulary_sets FOR DELETE
USING (auth.uid() = user_id);

-- ── vocabulary_items (transitive via parent set) ─────────────────────────────
DROP POLICY IF EXISTS "Anyone can view vocabulary items"   ON public.vocabulary_items;
DROP POLICY IF EXISTS "Anyone can create vocabulary items" ON public.vocabulary_items;
DROP POLICY IF EXISTS "Anyone can update vocabulary items" ON public.vocabulary_items;
DROP POLICY IF EXISTS "Anyone can delete vocabulary items" ON public.vocabulary_items;
DROP POLICY IF EXISTS "Users can view items in own sets"   ON public.vocabulary_items;
DROP POLICY IF EXISTS "Users can create items in own sets" ON public.vocabulary_items;
DROP POLICY IF EXISTS "Users can update items in own sets" ON public.vocabulary_items;
DROP POLICY IF EXISTS "Users can delete items in own sets" ON public.vocabulary_items;

CREATE POLICY "Users can view items in own sets"
ON public.vocabulary_items FOR SELECT
USING (EXISTS (
  SELECT 1 FROM public.vocabulary_sets
  WHERE vocabulary_sets.id = vocabulary_items.set_id
    AND vocabulary_sets.user_id = auth.uid()
));

CREATE POLICY "Users can create items in own sets"
ON public.vocabulary_items FOR INSERT
WITH CHECK (EXISTS (
  SELECT 1 FROM public.vocabulary_sets
  WHERE vocabulary_sets.id = vocabulary_items.set_id
    AND vocabulary_sets.user_id = auth.uid()
));

CREATE POLICY "Users can update items in own sets"
ON public.vocabulary_items FOR UPDATE
USING (EXISTS (
  SELECT 1 FROM public.vocabulary_sets
  WHERE vocabulary_sets.id = vocabulary_items.set_id
    AND vocabulary_sets.user_id = auth.uid()
));

CREATE POLICY "Users can delete items in own sets"
ON public.vocabulary_items FOR DELETE
USING (EXISTS (
  SELECT 1 FROM public.vocabulary_sets
  WHERE vocabulary_sets.id = vocabulary_items.set_id
    AND vocabulary_sets.user_id = auth.uid()
));

-- ── set_progress ─────────────────────────────────────────────────────────────
-- Two "Anyone can ..." families exist on a fresh replay: the originals from
-- 20251203142017 ("... set progress") plus the ones 20260113004227 added
-- without dropping them ("... progress"). Drop both.
DROP POLICY IF EXISTS "Anyone can view set progress"   ON public.set_progress;
DROP POLICY IF EXISTS "Anyone can create set progress" ON public.set_progress;
DROP POLICY IF EXISTS "Anyone can update set progress" ON public.set_progress;
DROP POLICY IF EXISTS "Anyone can delete set progress" ON public.set_progress;
DROP POLICY IF EXISTS "Anyone can view progress"   ON public.set_progress;
DROP POLICY IF EXISTS "Anyone can create progress" ON public.set_progress;
DROP POLICY IF EXISTS "Anyone can update progress" ON public.set_progress;
DROP POLICY IF EXISTS "Anyone can delete progress" ON public.set_progress;
DROP POLICY IF EXISTS "Users can view own progress"   ON public.set_progress;
DROP POLICY IF EXISTS "Users can create own progress" ON public.set_progress;
DROP POLICY IF EXISTS "Users can update own progress" ON public.set_progress;
DROP POLICY IF EXISTS "Users can delete own progress" ON public.set_progress;

CREATE POLICY "Users can view own progress"
ON public.set_progress FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can create own progress"
ON public.set_progress FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own progress"
ON public.set_progress FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own progress"
ON public.set_progress FOR DELETE
USING (auth.uid() = user_id);
