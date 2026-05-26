-- Add an explicit sort order for subjects (separate from section_sort_order
-- and chapter sort_order). Mirrors the section_sort_order pattern.

ALTER TABLE public.recall_chapters
  ADD COLUMN IF NOT EXISTS subject_sort_order INTEGER NOT NULL DEFAULT 0;

-- Initialise: assign each distinct subject a sort order based on its first
-- appearance in the existing data.
DO $$
DECLARE
  r RECORD;
  i INT := 0;
BEGIN
  FOR r IN
    SELECT DISTINCT ON (subject_id) subject_id
    FROM public.recall_chapters
    ORDER BY subject_id, sort_order ASC
  LOOP
    UPDATE public.recall_chapters
       SET subject_sort_order = i
     WHERE subject_id = r.subject_id;
    i := i + 1;
  END LOOP;
END;
$$;

-- Swap subject_sort_order between two subjects (called by AdminDashboard up/down).
-- Params alphabetical: p_subject_id_a, p_subject_id_b
CREATE OR REPLACE FUNCTION public.admin_swap_subject_order(
  p_subject_id_a text,
  p_subject_id_b text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  ord_a INT;
  ord_b INT;
BEGIN
  PERFORM public._assert_admin();
  SELECT subject_sort_order INTO ord_a FROM public.recall_chapters
   WHERE subject_id = p_subject_id_a LIMIT 1;
  SELECT subject_sort_order INTO ord_b FROM public.recall_chapters
   WHERE subject_id = p_subject_id_b LIMIT 1;
  UPDATE public.recall_chapters SET subject_sort_order = ord_b WHERE subject_id = p_subject_id_a;
  UPDATE public.recall_chapters SET subject_sort_order = ord_a WHERE subject_id = p_subject_id_b;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_swap_subject_order(text, text) TO authenticated;
