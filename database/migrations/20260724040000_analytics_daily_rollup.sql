-- Phase 6 (reports/ANALYTICS_PLAN.md): daily rollup + nightly refresh + read RPC.
--
-- Grain is (day, app_key), NOT per event name: distinct-visitor counts do not sum
-- across event names, and the `hll` extension (which would make them mergeable) is
-- not available on this instance. So `visitors`/`sessions` are true day-level
-- distinct counts and `events`/`signed_out_events` are additive.
--
-- Purpose: a fast per-app daily time series, and long-term history that survives the
-- 180-day raw prune (rollups are kept indefinitely — never pruned). Rolling DAU/WAU/
-- MAU, per-event, funnel and retention stay on the raw table, which is accurate
-- within 180 days — already wider than any of those windows.

CREATE TABLE public.analytics_daily (
  day                date   NOT NULL,
  app_key            text   NOT NULL,
  events             bigint NOT NULL DEFAULT 0,
  signed_out_events  bigint NOT NULL DEFAULT 0,
  visitors           bigint NOT NULL DEFAULT 0,   -- distinct coalesce(user_id, anon_id) that day
  sessions           bigint NOT NULL DEFAULT 0,   -- distinct session_id that day
  PRIMARY KEY (day, app_key)
);

CREATE INDEX analytics_daily_app_day_idx ON public.analytics_daily (app_key, day DESC);

ALTER TABLE public.analytics_daily ENABLE ROW LEVEL SECURITY;
-- No policies: unreadable with the anon/auth key (same posture as analytics_events).
-- The refresh function writes as SECURITY DEFINER; admin reads via the RPC below.

-- ── Refresh: re-aggregate a trailing window (late events + the partial current day) ──
CREATE OR REPLACE FUNCTION public.refresh_analytics_daily(p_trailing_days int DEFAULT 3)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.analytics_daily WHERE day >= (current_date - p_trailing_days);
  INSERT INTO public.analytics_daily (day, app_key, events, signed_out_events, visitors, sessions)
  SELECT
    (e.occurred_at AT TIME ZONE 'UTC')::date,
    e.app_key,
    count(*)::bigint,
    count(*) FILTER (WHERE e.user_id IS NULL)::bigint,
    count(DISTINCT coalesce(e.user_id::text, e.anon_id))::bigint,
    count(DISTINCT e.session_id)::bigint
  FROM public.analytics_events e
  WHERE e.occurred_at >= (current_date - p_trailing_days)::timestamptz
  GROUP BY 1, e.app_key;
END;
$$;
-- Internal maintenance function: not exposed to the API (only the cron / postgres calls it).
REVOKE ALL ON FUNCTION public.refresh_analytics_daily(int) FROM public;

-- ── One-time backfill of all existing history (idempotent) ──────────────────────────
INSERT INTO public.analytics_daily (day, app_key, events, signed_out_events, visitors, sessions)
SELECT
  (e.occurred_at AT TIME ZONE 'UTC')::date,
  e.app_key,
  count(*)::bigint,
  count(*) FILTER (WHERE e.user_id IS NULL)::bigint,
  count(DISTINCT coalesce(e.user_id::text, e.anon_id))::bigint,
  count(DISTINCT e.session_id)::bigint
FROM public.analytics_events e
GROUP BY 1, e.app_key
ON CONFLICT (day, app_key) DO NOTHING;

-- ── Read RPC: daily time series (one app, or all apps summed) ────────────────────────
-- Single app → exact. app_key NULL → events/signed_out are exact; visitors/sessions
-- are the sum of per-app day-distincts (the apps are separate origins, so a true
-- cross-app unique is not computable — this is an engagement proxy).
CREATE OR REPLACE FUNCTION public.admin_analytics_daily(p_app_key text DEFAULT NULL, p_days int DEFAULT 30)
RETURNS TABLE (
  day date,
  events bigint,
  visitors bigint,
  sessions bigint,
  signed_out_events bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public._assert_admin();
  RETURN QUERY
  SELECT
    d.day,
    sum(d.events)::bigint,
    sum(d.visitors)::bigint,
    sum(d.sessions)::bigint,
    sum(d.signed_out_events)::bigint
  FROM public.analytics_daily d
  WHERE d.day >= current_date - p_days
    AND (p_app_key IS NULL OR d.app_key = p_app_key)
  GROUP BY d.day
  ORDER BY d.day;
END;
$$;
GRANT EXECUTE ON FUNCTION public.admin_analytics_daily(text, int) TO authenticated;

-- ── Nightly refresh (04:37 UTC, after the 04:17 prune) ──────────────────────────────
SELECT cron.unschedule(jobid) FROM cron.job WHERE jobname = 'refresh-analytics-daily';
SELECT cron.schedule('refresh-analytics-daily', '37 4 * * *', $$SELECT public.refresh_analytics_daily(3)$$);
