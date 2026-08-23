-- PostgREST resolves named-parameter RPCs by matching argument names in
-- alphabetical order. Redefine all affected functions with params sorted A→Z.

-- Ensure _assert_admin exists regardless of whether the previous migration ran.
CREATE OR REPLACE FUNCTION public._assert_admin()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF (SELECT au.email FROM auth.users au WHERE au.id = auth.uid())
     <> 'aaravagarwal.1511@gmail.com' THEN
    RAISE EXCEPTION 'not authorized';
  END IF;
END;
$$;

-- admin_rename_section: (p_new_name, p_section_id)
-- Both params are text, and only the order/names changed from the original
-- (p_section_id, p_new_name) in 20260422000000_admin_recall_rpcs.sql — Postgres
-- refuses to rename input parameters via CREATE OR REPLACE, so the old signature
-- must be dropped first. On prod this had already happened via an out-of-band
-- dashboard edit by the time this migration ran; on a fresh replay it has not.
DROP FUNCTION IF EXISTS public.admin_rename_section(text, text);
CREATE OR REPLACE FUNCTION public.admin_rename_section(
  p_new_name   text,
  p_section_id text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public._assert_admin();
  UPDATE public.recall_chapters
     SET section_name = p_new_name
   WHERE section_id = p_section_id;
END;
$$;

-- admin_rename_subject: (p_new_emoji, p_new_name, p_subject_id)
-- Same reordering issue as admin_rename_section above — all three params are
-- text, and the original order was (p_subject_id, p_new_name, p_new_emoji).
DROP FUNCTION IF EXISTS public.admin_rename_subject(text, text, text);
CREATE OR REPLACE FUNCTION public.admin_rename_subject(
  p_new_emoji  text,
  p_new_name   text,
  p_subject_id text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public._assert_admin();
  UPDATE public.recall_chapters
     SET subject_name  = p_new_name,
         subject_emoji = p_new_emoji
   WHERE subject_id = p_subject_id;
END;
$$;

-- admin_delete_chapter: single param, no reorder needed — but recreate for
-- consistency and to keep GRANT current.
CREATE OR REPLACE FUNCTION public.admin_delete_chapter(p_id text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public._assert_admin();
  DELETE FROM public.recall_chapters WHERE id = p_id;
END;
$$;

-- admin_set_disabled: (p_disabled, p_entity_id, p_entity_type)
CREATE OR REPLACE FUNCTION public.admin_set_disabled(
  p_disabled    boolean,
  p_entity_id   text,
  p_entity_type text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public._assert_admin();
  IF p_disabled THEN
    INSERT INTO public.recall_disabled (entity_id, entity_type)
    VALUES (p_entity_id, p_entity_type)
    ON CONFLICT DO NOTHING;
  ELSE
    DELETE FROM public.recall_disabled
    WHERE entity_id = p_entity_id AND entity_type = p_entity_type;
  END IF;
END;
$$;

-- admin_save_chapter: (p_cards, p_id, p_name, p_section_id, p_section_name,
--                      p_sort_order, p_subject_emoji, p_subject_id, p_subject_name)
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
BEGIN
  PERFORM public._assert_admin();

  INSERT INTO public.recall_chapters
    (id, subject_id, subject_name, subject_emoji, section_id, section_name, name, sort_order)
  VALUES
    (p_id, p_subject_id, p_subject_name, p_subject_emoji, p_section_id, p_section_name, p_name, p_sort_order)
  ON CONFLICT (id) DO UPDATE SET
    subject_id    = EXCLUDED.subject_id,
    subject_name  = EXCLUDED.subject_name,
    subject_emoji = EXCLUDED.subject_emoji,
    section_id    = EXCLUDED.section_id,
    section_name  = EXCLUDED.section_name,
    name          = EXCLUDED.name,
    sort_order    = EXCLUDED.sort_order;

  DELETE FROM public.recall_cards WHERE chapter_id = p_id;

  FOR c IN SELECT * FROM jsonb_array_elements(p_cards) LOOP
    INSERT INTO public.recall_cards (chapter_id, term, definition, sort_order)
    VALUES (p_id, c->>'term', c->>'definition', i);
    i := i + 1;
  END LOOP;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_rename_section(text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_rename_subject(text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_delete_chapter(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_set_disabled(boolean, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_save_chapter(jsonb, text, text, text, text, int, text, text, text) TO authenticated;
