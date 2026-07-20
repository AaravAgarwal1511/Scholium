-- Folder-scoped practice. Same sampling as practice_sample (see
-- 20260718000000_practice_sample_rpc.sql) but restricted to mastered items that
-- live in sets belonging to one folder, so a folder gets its own practice deck.
--
-- Kept as a separate function rather than an overload of practice_sample: a
-- distinct name avoids PostgREST resolving an ambiguous overloaded signature.

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
  WHERE p.mastered AND s.folder_id = target_folder
  ORDER BY random()
  LIMIT GREATEST(sample_count, 0);
$$;

GRANT EXECUTE ON FUNCTION public.practice_sample_folder(int, uuid) TO anon, authenticated;
