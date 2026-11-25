-- User feedback, collected suite-wide by @repo/feedback (footer link + periodic
-- bottom-right prompt in every app).
--
-- Unlike analytics_events this table holds FREE TEXT, so it is closed tighter:
--   * RLS on with NO policies and every privilege revoked from anon/authenticated.
--     Nobody reaches the table over PostgREST at all.
--   * The only write path is submit_feedback(), a SECURITY DEFINER RPC that stamps
--     user_id from auth.uid() (never from the client), validates every field, and
--     rate-limits per user / per hashed IP.
--   * The only read paths are the admin_* RPCs, gated by _assert_admin().
--
-- Signed-out visitors may submit (scholium-home has no sign-in gate), which is why
-- the rate limit and honeypot exist. The raw IP is never stored: ip_hash is a
-- SHA-256 of the IP salted with the current UTC date, so it can rate-limit within a
-- day but cannot be correlated across days or reversed.
--
-- Email alerts: an AFTER INSERT trigger posts to the `feedback-notify` Edge Function
-- via pg_net, capped at FEEDBACK_EMAIL_DAILY_CAP alerts per UTC day plus one
-- "more feedback waiting" notice. The function URL and shared secret are read from
-- Supabase Vault (`feedback_notify_url`, `feedback_webhook_secret`); when either is
-- absent (local, staging) the trigger does nothing, and a notify failure can never
-- fail the insert.

CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

CREATE TABLE public.feedback (
  id           BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  user_id      UUID REFERENCES auth.users(id) ON DELETE SET NULL,  -- NULL when signed out
  app_key      TEXT NOT NULL CHECK (char_length(app_key) BETWEEN 1 AND 40),
  source       TEXT NOT NULL DEFAULT 'form' CHECK (source IN ('form', 'prompt', 'error')),
  category     TEXT NOT NULL CHECK (category IN ('bug', 'idea', 'other')),
  rating       SMALLINT CHECK (rating BETWEEN 1 AND 5),
  message      TEXT CHECK (char_length(message) <= 2000),
  path         TEXT CHECK (char_length(path) <= 300),
  app_version  TEXT CHECK (char_length(app_version) <= 40),
  user_agent   TEXT CHECK (char_length(user_agent) <= 300),
  ip_hash      TEXT,
  status       TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'triaged', 'done')),
  CHECK (rating IS NOT NULL OR message IS NOT NULL)
);

CREATE INDEX feedback_created_idx    ON public.feedback (created_at DESC);
CREATE INDEX feedback_app_time_idx   ON public.feedback (app_key, created_at DESC);
CREATE INDEX feedback_user_time_idx  ON public.feedback (user_id, created_at DESC) WHERE user_id IS NOT NULL;
CREATE INDEX feedback_ip_time_idx    ON public.feedback (ip_hash, created_at DESC) WHERE ip_hash IS NOT NULL;

ALTER TABLE public.feedback ENABLE ROW LEVEL SECURITY;
-- Deliberately no policies: deny-all for anon/authenticated. See header.
REVOKE ALL ON public.feedback FROM anon, authenticated;

-- ── submit_feedback: the only client write path ─────────────────────────────────────
CREATE OR REPLACE FUNCTION public.submit_feedback(
  p_app_key     text,
  p_category    text,
  p_message     text    DEFAULT NULL,
  p_rating      int     DEFAULT NULL,
  p_source      text    DEFAULT 'form',
  p_path        text    DEFAULT NULL,
  p_app_version text    DEFAULT NULL,
  p_user_agent  text    DEFAULT NULL,
  p_website     text    DEFAULT NULL   -- honeypot: a hidden field humans never fill
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_uid     uuid := auth.uid();
  v_message text := nullif(btrim(coalesce(p_message, '')), '');
  v_ip      text;
  v_ip_hash text;
  v_recent  int;
BEGIN
  -- Honeypot tripped: pretend success so the bot learns nothing.
  IF coalesce(p_website, '') <> '' THEN
    RETURN;
  END IF;

  IF p_category IS NULL OR p_category NOT IN ('bug', 'idea', 'other') THEN
    RAISE EXCEPTION 'invalid category' USING ERRCODE = '22023';
  END IF;
  IF p_source IS NULL OR p_source NOT IN ('form', 'prompt', 'error') THEN
    RAISE EXCEPTION 'invalid source' USING ERRCODE = '22023';
  END IF;
  IF p_rating IS NOT NULL AND (p_rating < 1 OR p_rating > 5) THEN
    RAISE EXCEPTION 'invalid rating' USING ERRCODE = '22023';
  END IF;
  IF v_message IS NULL AND p_rating IS NULL THEN
    RAISE EXCEPTION 'empty feedback' USING ERRCODE = '22023';
  END IF;
  IF char_length(coalesce(v_message, '')) > 2000 THEN
    RAISE EXCEPTION 'message too long' USING ERRCODE = '22023';
  END IF;
  IF p_app_key IS NULL OR char_length(p_app_key) NOT BETWEEN 1 AND 40 THEN
    RAISE EXCEPTION 'invalid app_key' USING ERRCODE = '22023';
  END IF;

  -- First hop of X-Forwarded-For, as set by the Supabase gateway.
  BEGIN
    v_ip := btrim(split_part(
      coalesce(current_setting('request.headers', true)::json ->> 'x-forwarded-for', ''),
      ',', 1));
  EXCEPTION WHEN others THEN
    v_ip := '';
  END;
  IF v_ip <> '' THEN
    v_ip_hash := encode(digest(v_ip || '|' || current_date::text || '|scholium-feedback', 'sha256'), 'hex');
  END IF;

  -- Rate limit: 5 per hour per signed-in user, else per hashed IP.
  IF v_uid IS NOT NULL THEN
    SELECT count(*) INTO v_recent FROM public.feedback
     WHERE user_id = v_uid AND created_at > now() - interval '1 hour';
  ELSIF v_ip_hash IS NOT NULL THEN
    SELECT count(*) INTO v_recent FROM public.feedback
     WHERE ip_hash = v_ip_hash AND created_at > now() - interval '1 hour';
  ELSE
    v_recent := 0;
  END IF;
  IF v_recent >= 5 THEN
    RAISE EXCEPTION 'rate limited' USING ERRCODE = 'P0429';
  END IF;

  -- Global backstop against an IP-rotating flood of signed-out submissions.
  IF v_uid IS NULL THEN
    SELECT count(*) INTO v_recent FROM public.feedback
     WHERE user_id IS NULL AND created_at > now() - interval '1 hour';
    IF v_recent >= 100 THEN
      RAISE EXCEPTION 'rate limited' USING ERRCODE = 'P0429';
    END IF;
  END IF;

  INSERT INTO public.feedback
    (user_id, app_key, source, category, rating, message, path, app_version, user_agent, ip_hash)
  VALUES (
    v_uid,
    p_app_key,
    p_source,
    p_category,
    p_rating,
    v_message,
    left(nullif(p_path, ''), 300),
    left(nullif(p_app_version, ''), 40),
    left(nullif(p_user_agent, ''), 300),
    v_ip_hash
  );
END;
$$;
REVOKE EXECUTE ON FUNCTION public.submit_feedback(text, text, text, int, text, text, text, text, text) FROM public;
GRANT  EXECUTE ON FUNCTION public.submit_feedback(text, text, text, int, text, text, text, text, text) TO anon, authenticated;

-- ── Email alert trigger (capped) ────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public._feedback_notify()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  -- Alerts per UTC day. The (cap + 1)th submission sends one "more waiting" notice;
  -- after that nothing is emailed until tomorrow. Every row is stored regardless.
  c_daily_cap constant int := 20;
  v_url     text;
  v_secret  text;
  v_today   int;
  v_kind    text;
BEGIN
  BEGIN
    SELECT decrypted_secret INTO v_url    FROM vault.decrypted_secrets WHERE name = 'feedback_notify_url';
    SELECT decrypted_secret INTO v_secret FROM vault.decrypted_secrets WHERE name = 'feedback_webhook_secret';
  EXCEPTION WHEN others THEN
    RETURN NULL;  -- no vault (unusual local setups): skip silently
  END;
  IF v_url IS NULL OR v_secret IS NULL THEN
    RETURN NULL;  -- not configured in this environment
  END IF;

  SELECT count(*) INTO v_today FROM public.feedback
   WHERE created_at >= date_trunc('day', now() AT TIME ZONE 'utc') AT TIME ZONE 'utc';

  IF v_today <= c_daily_cap THEN
    v_kind := 'item';
  ELSIF v_today = c_daily_cap + 1 THEN
    v_kind := 'overflow';
  ELSE
    RETURN NULL;
  END IF;

  BEGIN
    PERFORM net.http_post(
      url     := v_url,
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'x-webhook-secret', v_secret
      ),
      body    := jsonb_build_object(
        'kind', v_kind,
        'daily_cap', c_daily_cap,
        'today_count', v_today,
        'feedback', jsonb_build_object(
          'id', NEW.id,
          'created_at', NEW.created_at,
          'signed_in', NEW.user_id IS NOT NULL,
          'app_key', NEW.app_key,
          'source', NEW.source,
          'category', NEW.category,
          'rating', NEW.rating,
          'message', NEW.message,
          'path', NEW.path,
          'app_version', NEW.app_version,
          'user_agent', NEW.user_agent
        )
      )
    );
  EXCEPTION WHEN others THEN
    -- Never let a notification problem lose the user's feedback.
    RAISE WARNING 'feedback notify failed: %', SQLERRM;
  END;
  RETURN NULL;
END;
$$;
REVOKE EXECUTE ON FUNCTION public._feedback_notify() FROM public, anon, authenticated;

CREATE TRIGGER feedback_notify
  AFTER INSERT ON public.feedback
  FOR EACH ROW EXECUTE FUNCTION public._feedback_notify();

-- ── Admin reads / triage ────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.admin_list_feedback(
  p_app_key  text DEFAULT NULL,
  p_category text DEFAULT NULL,
  p_status   text DEFAULT NULL,
  p_days     int  DEFAULT 90,
  p_limit    int  DEFAULT 200
)
RETURNS TABLE (
  id           bigint,
  created_at   timestamptz,
  user_email   text,
  app_key      text,
  source       text,
  category     text,
  rating       smallint,
  message      text,
  path         text,
  app_version  text,
  user_agent   text,
  status       text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public._assert_admin();
  RETURN QUERY
  SELECT f.id, f.created_at, u.email::text, f.app_key, f.source, f.category, f.rating,
         f.message, f.path, f.app_version, f.user_agent, f.status
    FROM public.feedback f
    LEFT JOIN auth.users u ON u.id = f.user_id
   WHERE f.created_at >= now() - make_interval(days => greatest(p_days, 1))
     AND (p_app_key  IS NULL OR f.app_key  = p_app_key)
     AND (p_category IS NULL OR f.category = p_category)
     AND (p_status   IS NULL OR f.status   = p_status)
   ORDER BY f.created_at DESC
   LIMIT least(greatest(p_limit, 1), 1000);
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_update_feedback_status(p_id bigint, p_status text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public._assert_admin();
  IF p_status NOT IN ('new', 'triaged', 'done') THEN
    RAISE EXCEPTION 'invalid status' USING ERRCODE = '22023';
  END IF;
  UPDATE public.feedback SET status = p_status WHERE id = p_id;
END;
$$;

-- Supabase grants EXECUTE to anon directly; REVOKE … FROM public alone does not
-- remove it (see CLAUDE.md). _assert_admin() rejects anon anyway — belt and braces.
REVOKE EXECUTE ON FUNCTION public.admin_list_feedback(text, text, text, int, int) FROM public, anon;
REVOKE EXECUTE ON FUNCTION public.admin_update_feedback_status(bigint, text)       FROM public, anon;
GRANT  EXECUTE ON FUNCTION public.admin_list_feedback(text, text, text, int, int) TO authenticated;
GRANT  EXECUTE ON FUNCTION public.admin_update_feedback_status(bigint, text)       TO authenticated;

-- ── Retention: 2 years (stated in the Privacy Policy, §5) ───────────────────────────
CREATE EXTENSION IF NOT EXISTS pg_cron;
SELECT cron.unschedule(jobid) FROM cron.job WHERE jobname = 'prune-feedback';
SELECT cron.schedule(
  'prune-feedback',
  '29 4 * * *',  -- daily at 04:29 UTC, after prune-analytics-events
  $$DELETE FROM public.feedback WHERE created_at < now() - interval '2 years'$$
);
