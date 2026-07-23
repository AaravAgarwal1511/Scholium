-- First-party product-analytics events (Phase 2 of reports/ANALYTICS_PLAN.md).
--
-- One row per session-level event (never a per-interaction firehose): a whole
-- recall study session is a single `study_complete`, not one row per card. This
-- keeps the table small enough that the aggregating admin RPCs (Phase 4) stay fast
-- on raw scans for years, and keeps us far from anything resembling behavioural
-- profiling of a minor.
--
-- `props` holds numbers, booleans and short enum strings ONLY — no card/poem/exam
-- text, no filenames, no emails, no free text. The client's sanitizeProps() drops
-- anything else before it leaves the browser; this is the schema-level counterpart.

CREATE TABLE public.analytics_events (
  id           BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  occurred_at  TIMESTAMPTZ NOT NULL DEFAULT now(),   -- server clock, authoritative
  client_ts    TIMESTAMPTZ,                          -- client clock, for intra-session ordering
  user_id      UUID REFERENCES auth.users(id) ON DELETE CASCADE,  -- NULL when signed out
  anon_id      TEXT NOT NULL,   -- per-origin device id (reuses 'scholium-device-id')
  session_id   TEXT NOT NULL,   -- per tab/visit, 30-min idle timeout
  app_key      TEXT NOT NULL,   -- 'recall-app' | 'language-hub' | ... (same keys as active_sessions)
  name         TEXT NOT NULL,   -- event name from the taxonomy in the plan (§5)
  path         TEXT,            -- route only, query string already stripped client-side
  props        JSONB NOT NULL DEFAULT '{}'::JSONB
);

-- ── Indexes: one per admin-RPC access pattern (per-app, per-user, per-event) ────────
CREATE INDEX analytics_events_app_time_idx  ON public.analytics_events (app_key, occurred_at DESC);
CREATE INDEX analytics_events_user_time_idx ON public.analytics_events (user_id, occurred_at DESC) WHERE user_id IS NOT NULL;
CREATE INDEX analytics_events_name_time_idx ON public.analytics_events (name, occurred_at DESC);

-- ── RLS: insert-only, and you may only attribute events to yourself ─────────────────
ALTER TABLE public.analytics_events ENABLE ROW LEVEL SECURITY;

-- The WITH CHECK is the security-critical line: it makes it impossible to forge
-- events attributed to another user, while still allowing signed-out demo traffic
-- (NULL user_id IS NOT DISTINCT FROM a NULL auth.uid() → TRUE).
CREATE POLICY "analytics_events: client insert"
  ON public.analytics_events FOR INSERT TO anon, authenticated
  WITH CHECK (user_id IS NOT DISTINCT FROM auth.uid());

-- Deliberately NO select/update/delete policy: nothing can read or mutate this
-- table with the anon/authenticated key. Admin reads go exclusively through the
-- SECURITY DEFINER RPCs added in Phase 4. Clients insert without RETURNING
-- (supabase-js insert() with no .select()), so the missing SELECT policy is fine.
GRANT INSERT ON public.analytics_events TO anon, authenticated;
