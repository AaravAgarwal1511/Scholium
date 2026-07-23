-- Per-user preferences (Phase 2 of reports/ANALYTICS_PLAN.md).
--
-- Introduced for the analytics opt-out toggle, which is one suite-wide preference
-- reachable from every app's Settings page. There was no profiles/preferences
-- table before this. Signed-in users read/write here (source of truth, so flipping
-- the switch off in one app turns analytics off everywhere the moment that app
-- syncs it); signed-out users fall back to per-origin localStorage.

CREATE TABLE public.user_prefs (
  user_id            UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  analytics_opt_out  BOOLEAN NOT NULL DEFAULT false,
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── RLS: a user may only read/write their own row ───────────────────────────────────
ALTER TABLE public.user_prefs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "user_prefs: owner select"
  ON public.user_prefs FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "user_prefs: owner insert"
  ON public.user_prefs FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "user_prefs: owner update"
  ON public.user_prefs FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

GRANT SELECT, INSERT, UPDATE ON public.user_prefs TO authenticated;
