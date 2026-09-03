-- Scope the practice-sampling RPCs to the caller's own sets.
--
-- language-hub added a "Starter Sets" catalog users import with one click, and
-- the dashboard/folder reads that back it now filter to
-- `user_id = auth.uid() OR user_id IS NULL` (own sets, plus legacy rows from
-- before this app had per-user ownership). practice_sample /
-- practice_sample_folder still drew mastered items from EVERY user's sets, so a
-- practice session increasingly served strangers' words as imports piled up.
--
-- Same predicate as the client reads, applied in the WHERE. Both functions are
-- SECURITY INVOKER, so auth.uid() is the signed-in caller (NULL for anon, which
-- then matches only the legacy null-owner sets — anon cannot reach these pages
-- anyway). Return shape and signatures are unchanged; CREATE OR REPLACE keeps
-- the existing grants, but they are re-issued below to be explicit.
--
-- Note this is a UX filter, not an access boundary: vocabulary_sets RLS is still
-- USING(true). Real per-user isolation is a separate migration (it would hide
-- every legacy null-owner row and needs a folders.user_id column too).

CREATE OR REPLACE FUNCTION public.practice_sample(sample_count int)
RETURNS TABLE (
  id         uuid,
  term       text,
  definition text,
  set_id     uuid,
  language   text
)
LANGUAGE sql
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT v.id, v.term, v.definition, v.set_id, s.language
  FROM public.set_progress p
  JOIN public.vocabulary_items v ON v.id = p.item_id
  JOIN public.vocabulary_sets s  ON s.id = v.set_id
  WHERE p.mastered
    AND (s.user_id = auth.uid() OR s.user_id IS NULL)
  ORDER BY random()
  LIMIT GREATEST(sample_count, 0);
$$;

GRANT EXECUTE ON FUNCTION public.practice_sample(int) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.practice_sample_folder(sample_count int, target_folder uuid)
RETURNS TABLE (
  id         uuid,
  term       text,
  definition text,
  set_id     uuid,
  language   text
)
LANGUAGE sql
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT v.id, v.term, v.definition, v.set_id, s.language
  FROM public.set_progress p
  JOIN public.vocabulary_items v ON v.id = p.item_id
  JOIN public.vocabulary_sets s  ON s.id = v.set_id
  WHERE p.mastered
    AND s.folder_id = target_folder
    AND (s.user_id = auth.uid() OR s.user_id IS NULL)
  ORDER BY random()
  LIMIT GREATEST(sample_count, 0);
$$;

GRANT EXECUTE ON FUNCTION public.practice_sample_folder(int, uuid) TO anon, authenticated;
