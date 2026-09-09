-- Scope folders to their owner. Since 20260419000000_add_folders.sql, `folders`
-- has had no owner column at all and fully open RLS ("Anyone can
-- view/create/update/delete folders", USING/WITH CHECK (true)). Every
-- signed-in user can see, rename, and delete every other user's folders —
-- Index.tsx's fetch (`.from("folders").select("*")`, no filter possible
-- without a column to filter on) returns the whole table to whoever asks.
--
-- Discovered chasing a report of one user's change clobbering another's data:
-- 20260901000000_practice_sample_user_scope.sql (PR #31) fixed the analogous
-- leak in practice sampling, but that migration only touches
-- practice_sample/practice_sample_folder — folders was never in scope there.
--
-- Backfill is unambiguous on live prod (verified via `supabase db query
-- --linked` before writing this): all 11 existing folders are each
-- referenced by vocabulary_sets belonging to exactly one user — no folder is
-- shared across owners today. Pick that single owner. A folder with zero
-- owning sets (possible on some other environment, not this one) has no
-- owner to infer and is dropped rather than left ownerless — an empty
-- folder nobody's sets point to carries nothing worth keeping.
--
-- Client-side, only the create path needs a change: reads/updates/deletes
-- already carry no explicit user_id filter anywhere (Index.tsx, Folder.tsx,
-- EditSet.tsx, PracticeSetup.tsx all just query `folders` directly) because
-- the app's pattern throughout is to let RLS do the scoping, same as
-- vocabulary_sets. createFolder (Index.tsx) is the one write that must start
-- passing user_id explicitly, matching how CreateSet.tsx already does for
-- vocabulary_sets.

ALTER TABLE public.folders
  ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;

UPDATE public.folders f
SET user_id = owner.user_id
FROM (
  SELECT DISTINCT ON (s.folder_id) s.folder_id, s.user_id
  FROM public.vocabulary_sets s
  WHERE s.folder_id IS NOT NULL AND s.user_id IS NOT NULL
  ORDER BY s.folder_id, s.created_at ASC
) owner
WHERE owner.folder_id = f.id
  AND f.user_id IS NULL;

-- Folders no backfill could attribute an owner to (none on prod today).
DELETE FROM public.folders WHERE user_id IS NULL;

ALTER TABLE public.folders
  ALTER COLUMN user_id SET NOT NULL;

CREATE INDEX IF NOT EXISTS folders_user_id_idx ON public.folders(user_id);

DROP POLICY IF EXISTS "Anyone can view folders" ON public.folders;
DROP POLICY IF EXISTS "Anyone can create folders" ON public.folders;
DROP POLICY IF EXISTS "Anyone can update folders" ON public.folders;
DROP POLICY IF EXISTS "Anyone can delete folders" ON public.folders;

CREATE POLICY "Users can view own folders"
ON public.folders FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can create own folders"
ON public.folders FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own folders"
ON public.folders FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own folders"
ON public.folders FOR DELETE
USING (auth.uid() = user_id);

-- Grants are unchanged: 20260822010000_grant_missing_table_privileges.sql
-- already grants anon+authenticated on folders. That stays a no-op for anon
-- (auth.uid() is never a match with no session) exactly like it already is
-- for vocabulary_sets/set_progress/vocabulary_items — RLS is the real gate,
-- not the grant.
