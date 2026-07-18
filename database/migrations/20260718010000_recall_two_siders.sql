-- Two-Sider essays for RecallApp: a question argued on two sides, each side a
-- short list of points. Every point's keyword initial spells the side's
-- mnemonic, so only the keyword + full point are stored — the letter and the
-- mnemonic are derived in the app. Public SELECT so the app reads them;
-- admin-only writes via the RPCs below (same pattern as recall_chapters).

-- ── recall_two_siders ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.recall_two_siders (
  id            text PRIMARY KEY,                 -- e.g. 'eco-tariffs'
  subject       text NOT NULL,                    -- display label, e.g. 'Economics'
  emoji         text NOT NULL DEFAULT '📝',
  question      text NOT NULL,
  marks         int,
  for_label     text NOT NULL DEFAULT 'For',      -- how the two sides read for this question
  against_label text NOT NULL DEFAULT 'Against',
  available     boolean NOT NULL DEFAULT true,    -- unpublished essays are hidden from the app
  sort_order    int NOT NULL DEFAULT 0,
  created_at    timestamptz NOT NULL DEFAULT now()
);

-- ── recall_two_sider_points ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.recall_two_sider_points (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  two_sider_id  text NOT NULL REFERENCES public.recall_two_siders(id) ON DELETE CASCADE,
  side          text NOT NULL CHECK (side IN ('for', 'against')),
  keyword       text NOT NULL,                    -- trigger word; its initial forms the mnemonic
  point         text NOT NULL,                    -- the full point, one sentence
  sort_order    int NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_recall_two_sider_points_parent
  ON public.recall_two_sider_points(two_sider_id);

-- ── RLS: public read, no direct writes (all writes via admin RPCs) ─────────────
ALTER TABLE public.recall_two_siders       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recall_two_sider_points ENABLE ROW LEVEL SECURITY;

CREATE POLICY "recall_two_siders: public read"
  ON public.recall_two_siders FOR SELECT USING (true);

CREATE POLICY "recall_two_sider_points: public read"
  ON public.recall_two_sider_points FOR SELECT USING (true);

-- ── Admin RPCs ─────────────────────────────────────────────────────────────────
-- Save an essay and fully replace its points in one call. p_for / p_against are
-- JSON arrays of {keyword, point} objects, in display order.
CREATE OR REPLACE FUNCTION public.admin_save_two_sider(
  p_id            text,
  p_subject       text,
  p_emoji         text,
  p_question      text,
  p_marks         int,
  p_for_label     text,
  p_against_label text,
  p_sort_order    int,
  p_for           jsonb,
  p_against       jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  pt jsonb;
  i  int;
BEGIN
  PERFORM public._assert_admin();

  INSERT INTO public.recall_two_siders
    (id, subject, emoji, question, marks, for_label, against_label, sort_order)
  VALUES
    (p_id, p_subject, p_emoji, p_question, p_marks, p_for_label, p_against_label, p_sort_order)
  ON CONFLICT (id) DO UPDATE SET
    subject       = EXCLUDED.subject,
    emoji         = EXCLUDED.emoji,
    question      = EXCLUDED.question,
    marks         = EXCLUDED.marks,
    for_label     = EXCLUDED.for_label,
    against_label = EXCLUDED.against_label,
    sort_order    = EXCLUDED.sort_order;

  DELETE FROM public.recall_two_sider_points WHERE two_sider_id = p_id;

  i := 0;
  FOR pt IN SELECT * FROM jsonb_array_elements(p_for) LOOP
    INSERT INTO public.recall_two_sider_points (two_sider_id, side, keyword, point, sort_order)
    VALUES (p_id, 'for', pt->>'keyword', pt->>'point', i);
    i := i + 1;
  END LOOP;

  i := 0;
  FOR pt IN SELECT * FROM jsonb_array_elements(p_against) LOOP
    INSERT INTO public.recall_two_sider_points (two_sider_id, side, keyword, point, sort_order)
    VALUES (p_id, 'against', pt->>'keyword', pt->>'point', i);
    i := i + 1;
  END LOOP;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_delete_two_sider(p_id text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public._assert_admin();
  DELETE FROM public.recall_two_siders WHERE id = p_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_set_two_sider_available(
  p_id        text,
  p_available boolean
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public._assert_admin();
  UPDATE public.recall_two_siders SET available = p_available WHERE id = p_id;
END;
$$;

-- Swap the display order of two essays (drives the up/down arrows in the admin).
CREATE OR REPLACE FUNCTION public.admin_swap_two_sider_order(
  p_id_a text,
  p_id_b text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  ord_a int;
  ord_b int;
BEGIN
  PERFORM public._assert_admin();
  SELECT sort_order INTO ord_a FROM public.recall_two_siders WHERE id = p_id_a;
  SELECT sort_order INTO ord_b FROM public.recall_two_siders WHERE id = p_id_b;
  UPDATE public.recall_two_siders SET sort_order = ord_b WHERE id = p_id_a;
  UPDATE public.recall_two_siders SET sort_order = ord_a WHERE id = p_id_b;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_save_two_sider(text, text, text, text, int, text, text, int, jsonb, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_delete_two_sider(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_set_two_sider_available(text, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_swap_two_sider_order(text, text) TO authenticated;

-- ── SEED: the two essays RecallApp originally shipped ──────────────────────────
INSERT INTO public.recall_two_siders (id, subject, emoji, question, marks, for_label, against_label, available, sort_order) VALUES
  ('eco-tariffs', 'Economics', '📈', 'Evaluate the case for and against the use of protectionist tariffs.', 25, 'FOR tariffs', 'AGAINST tariffs', true, 1),
  ('eco-minimum-wage', 'Economics', '📈', 'Discuss whether the government should raise the national minimum wage.', 25, 'FOR raising it', 'AGAINST raising it', true, 2)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.recall_two_sider_points (two_sider_id, side, keyword, point, sort_order) VALUES
  -- eco-tariffs · FOR (DRIVES)
  ('eco-tariffs', 'for', 'Dumping',          'Shields domestic firms from foreign goods sold below cost.', 0),
  ('eco-tariffs', 'for', 'Revenue',          'Tariffs are a source of government tax revenue.', 1),
  ('eco-tariffs', 'for', 'Infant industry',  'Protects young industries until they reach an efficient scale.', 2),
  ('eco-tariffs', 'for', 'Vulnerable jobs',  'Safeguards employment in sectors exposed to import competition.', 3),
  ('eco-tariffs', 'for', 'External balance', 'Curbs imports to help narrow a current-account deficit.', 4),
  ('eco-tariffs', 'for', 'Security',         'Protects strategically vital industries — steel, food, defence.', 5),
  -- eco-tariffs · AGAINST (PRICER)
  ('eco-tariffs', 'against', 'Prices',          'Consumers pay more, lowering real incomes.', 0),
  ('eco-tariffs', 'against', 'Retaliation',     'Partners impose counter-tariffs, risking a trade war.', 1),
  ('eco-tariffs', 'against', 'Inefficiency',    'Protected firms lack incentive to cut costs — X-inefficiency.', 2),
  ('eco-tariffs', 'against', 'Choice',          'The range of goods available to consumers narrows.', 3),
  ('eco-tariffs', 'against', 'Efficiency loss', 'Ignoring comparative advantage misallocates resources; welfare falls.', 4),
  ('eco-tariffs', 'against', 'Regressive',      'Price rises hit low-income households hardest.', 5),
  -- eco-minimum-wage · FOR (SPEND)
  ('eco-minimum-wage', 'for', 'Standards',    'Lifts low-paid workers'' living standards, cutting in-work poverty.', 0),
  ('eco-minimum-wage', 'for', 'Productivity', 'Firms train and invest to justify the higher wage — the efficiency-wage effect.', 1),
  ('eco-minimum-wage', 'for', 'Extra demand', 'Higher incomes raise consumer spending, supporting growth.', 2),
  ('eco-minimum-wage', 'for', 'Narrower gap', 'Reduces income inequality between low and high earners.', 3),
  ('eco-minimum-wage', 'for', 'Dependency',   'Less reliance on state top-up benefits, easing the fiscal burden.', 4),
  -- eco-minimum-wage · AGAINST (COBRA)
  ('eco-minimum-wage', 'against', 'Costs',         'Raises firms'' labour costs, squeezing profits and small businesses.', 0),
  ('eco-minimum-wage', 'against', 'Output prices', 'Firms pass costs on, adding to cost-push inflation.', 1),
  ('eco-minimum-wage', 'against', 'Barriers',      'Prices low-skilled and young workers out of jobs, raising unemployment.', 2),
  ('eco-minimum-wage', 'against', 'Relocation',    'Firms substitute capital for labour or offshore production.', 3),
  ('eco-minimum-wage', 'against', 'Awkward fit',   'A single national rate ignores regional differences in living costs.', 4)
ON CONFLICT DO NOTHING;
