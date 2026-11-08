-- Date-range analytics RPCs for the admin dashboard's "Verified totals" panel.
--
-- The existing admin_analytics_* RPCs take a trailing window (p_days), which can't
-- answer "how many papers since launch?" or "how many visitors in September?". These
-- take an explicit inclusive [p_from, p_to] date range instead, NULL meaning
-- unbounded on that side, so all-time is (NULL, NULL).
--
-- Days and months are UTC calendar days/months, matching analytics_daily.
-- A "visitor" is coalesce(user_id, anon_id), as in 20260724010000. anon_id is
-- per-origin, so with p_app_key NULL one signed-out person who used two apps counts
-- twice — scope to a single app for a strict per-device figure.
--
-- These read analytics_events, so they only see the 180-day raw retention window
-- (20260724030000). Older totals must come from a rollup, not from here.

-- ── Totals over a date range ─────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.admin_analytics_range_summary(
  p_from date DEFAULT NULL,
  p_to date DEFAULT NULL,
  p_app_key text DEFAULT NULL
)
RETURNS TABLE (
  events bigint,
  visitors bigint,
  papers_generated bigint,
  papers_failed bigint,
  first_event timestamptz,
  last_event timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public._assert_admin();
  IF p_from IS NOT NULL AND p_to IS NOT NULL AND p_from > p_to THEN
    RAISE EXCEPTION 'p_from (%) is after p_to (%)', p_from, p_to;
  END IF;
  RETURN QUERY
  SELECT
    count(*)::bigint,
    count(DISTINCT coalesce(e.user_id::text, e.anon_id))::bigint,
    count(*) FILTER (WHERE e.name = 'generate_complete')::bigint,
    count(*) FILTER (WHERE e.name = 'generate_failed')::bigint,
    min(e.occurred_at),
    max(e.occurred_at)
  FROM public.analytics_events e
  WHERE (p_from IS NULL OR e.occurred_at >= (p_from::timestamp AT TIME ZONE 'UTC'))
    AND (p_to IS NULL OR e.occurred_at < ((p_to + 1)::timestamp AT TIME ZONE 'UTC'))
    AND (p_app_key IS NULL OR e.app_key = p_app_key);
END;
$$;

-- ── Per-month breakdown over a date range ────────────────────────────────────────────
-- Visitors are distinct within each month, so the rows do not sum to the range total.
CREATE OR REPLACE FUNCTION public.admin_analytics_monthly(
  p_from date DEFAULT NULL,
  p_to date DEFAULT NULL,
  p_app_key text DEFAULT NULL
)
RETURNS TABLE (
  month date,
  events bigint,
  visitors bigint,
  papers_generated bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public._assert_admin();
  IF p_from IS NOT NULL AND p_to IS NOT NULL AND p_from > p_to THEN
    RAISE EXCEPTION 'p_from (%) is after p_to (%)', p_from, p_to;
  END IF;
  RETURN QUERY
  SELECT
    date_trunc('month', e.occurred_at AT TIME ZONE 'UTC')::date,
    count(*)::bigint,
    count(DISTINCT coalesce(e.user_id::text, e.anon_id))::bigint,
    count(*) FILTER (WHERE e.name = 'generate_complete')::bigint
  FROM public.analytics_events e
  WHERE (p_from IS NULL OR e.occurred_at >= (p_from::timestamp AT TIME ZONE 'UTC'))
    AND (p_to IS NULL OR e.occurred_at < ((p_to + 1)::timestamp AT TIME ZONE 'UTC'))
    AND (p_app_key IS NULL OR e.app_key = p_app_key)
  GROUP BY 1
  ORDER BY 1;
END;
$$;

-- Supabase grants EXECUTE to anon directly, and REVOKE … FROM public does not touch
-- that grant (see CLAUDE.md). _assert_admin() already rejects anon; this removes the
-- reach entirely.
REVOKE EXECUTE ON FUNCTION public.admin_analytics_range_summary(date, date, text) FROM public, anon;
REVOKE EXECUTE ON FUNCTION public.admin_analytics_monthly(date, date, text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.admin_analytics_range_summary(date, date, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_analytics_monthly(date, date, text) TO authenticated;
