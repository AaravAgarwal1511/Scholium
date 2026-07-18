-- Practice sessions previously downloaded every mastered vocabulary item
-- (two round trips, full rows, a giant IN(...) list) only to shuffle in JS and
-- keep 20-100. This pushes the random sampling into Postgres so one call returns
-- exactly `sample_count` rows with their set language already joined.
--
-- Behaviour-preserving: like the client code it replaces, it samples across ALL
-- mastered items (this app's RLS is USING(true) and no read is user-scoped).

-- Index the mastered rows so the sample scans only them, not the whole table.
CREATE INDEX IF NOT EXISTS idx_set_progress_mastered
  ON public.set_progress (item_id)
  WHERE mastered;

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
  ORDER BY random()
  LIMIT GREATEST(sample_count, 0);
$$;

GRANT EXECUTE ON FUNCTION public.practice_sample(int) TO anon, authenticated;
