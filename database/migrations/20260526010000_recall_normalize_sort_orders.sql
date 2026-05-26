-- Fix two issues with recall sort orders:
--
-- 1. Newly created sections all got section_sort_order = 0 (DB column default),
--    because admin_save_chapter never set it. Multiple sections within one
--    subject ending up at the same sort_order made admin_swap_section_order
--    a no-op (it reads ord_a, ord_b — both 0 — and writes them back unchanged).
-- 2. Same problem will exist for subject_sort_order for any newly created
--    subject.
--
-- This migration: (a) re-normalises sort orders so every subject's sections
-- are densely 0..N-1, and subjects globally are 0..M-1, preserving current
-- visual order; (b) updates admin_save_chapter to auto-assign the next free
-- sort order whenever a brand-new (subject_id) or (subject_id, section_id)
-- pair is inserted.

-- ── (a) Re-normalise section_sort_order per subject ───────────────────────────
DO $$
DECLARE
  r RECORD;
  i INT;
  prev_subject TEXT := NULL;
BEGIN
  i := 0;
  FOR r IN
    SELECT subject_id, section_id, MIN(section_sort_order) AS cur_order
      FROM public.recall_chapters
     GROUP BY subject_id, section_id
     ORDER BY subject_id, MIN(section_sort_order), section_id
  LOOP
    IF prev_subject IS DISTINCT FROM r.subject_id THEN
      i := 0;
      prev_subject := r.subject_id;
    END IF;
    UPDATE public.recall_chapters
       SET section_sort_order = i
     WHERE subject_id = r.subject_id AND section_id = r.section_id;
    i := i + 1;
  END LOOP;
END;
$$;

-- ── (a) Re-normalise subject_sort_order globally ──────────────────────────────
DO $$
DECLARE
  r RECORD;
  i INT := 0;
BEGIN
  FOR r IN
    SELECT subject_id, MIN(subject_sort_order) AS cur_order
      FROM public.recall_chapters
     GROUP BY subject_id
     ORDER BY MIN(subject_sort_order), subject_id
  LOOP
    UPDATE public.recall_chapters
       SET subject_sort_order = i
     WHERE subject_id = r.subject_id;
    i := i + 1;
  END LOOP;
END;
$$;

-- ── (b) Patch admin_save_chapter to auto-assign sort orders on insert ─────────
CREATE OR REPLACE FUNCTION public.admin_save_chapter(
  p_cards         jsonb,
  p_id            text,
  p_name          text,
  p_section_id    text,
  p_section_name  text,
  p_sort_order    int,
  p_subject_emoji text,
  p_subject_id    text,
  p_subject_name  text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  c jsonb;
  i int := 0;
  v_subject_order int;
  v_section_order int;
BEGIN
  PERFORM public._assert_admin();

  -- Reuse the subject's existing sort_order if any chapter already belongs
  -- to it; otherwise this is a brand-new subject → MAX + 1.
  SELECT subject_sort_order INTO v_subject_order
    FROM public.recall_chapters
   WHERE subject_id = p_subject_id
   LIMIT 1;
  IF v_subject_order IS NULL THEN
    SELECT COALESCE(MAX(subject_sort_order) + 1, 0) INTO v_subject_order
      FROM public.recall_chapters;
  END IF;

  -- Same rule for section: reuse if section exists, otherwise MAX + 1
  -- within that subject.
  SELECT section_sort_order INTO v_section_order
    FROM public.recall_chapters
   WHERE subject_id = p_subject_id AND section_id = p_section_id
   LIMIT 1;
  IF v_section_order IS NULL THEN
    SELECT COALESCE(MAX(section_sort_order) + 1, 0) INTO v_section_order
      FROM public.recall_chapters
     WHERE subject_id = p_subject_id;
  END IF;

  INSERT INTO public.recall_chapters
    (id, subject_id, subject_name, subject_emoji, section_id, section_name,
     name, sort_order, section_sort_order, subject_sort_order)
  VALUES
    (p_id, p_subject_id, p_subject_name, p_subject_emoji, p_section_id,
     p_section_name, p_name, p_sort_order, v_section_order, v_subject_order)
  ON CONFLICT (id) DO UPDATE SET
    subject_id         = EXCLUDED.subject_id,
    subject_name       = EXCLUDED.subject_name,
    subject_emoji      = EXCLUDED.subject_emoji,
    section_id         = EXCLUDED.section_id,
    section_name       = EXCLUDED.section_name,
    name               = EXCLUDED.name,
    sort_order         = EXCLUDED.sort_order,
    section_sort_order = EXCLUDED.section_sort_order,
    subject_sort_order = EXCLUDED.subject_sort_order;

  DELETE FROM public.recall_cards WHERE chapter_id = p_id;

  FOR c IN SELECT * FROM jsonb_array_elements(p_cards) LOOP
    INSERT INTO public.recall_cards (chapter_id, term, definition, sort_order)
    VALUES (p_id, c->>'term', c->>'definition', i);
    i := i + 1;
  END LOOP;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_save_chapter(
  jsonb, text, text, text, text, int, text, text, text
) TO authenticated;
