-- 13 of the 17 tables in `public` have RLS policies but no table-level GRANT to
-- `anon`/`authenticated` — confirmed by querying every table's actual grants
-- and every table's actual policies against a fresh local replay (`pg_policies`,
-- `has_table_privilege`), not by inspecting migration files. Postgres checks
-- table-level privilege before RLS ever runs, so without the GRANT below the
-- policies are unreachable: PostgREST returns `permission denied for table …`
-- regardless of what the policy would have allowed.
--
-- Root cause: none of the affected tables' migrations contain an explicit
-- GRANT. They relied on Supabase's old default of auto-exposing new `public`
-- tables to the Data API roles. supabase/config.toml's own template documents
-- that this default flipped ("matching the new cloud default") and that the
-- old behaviour is "removed on 2026-10-30 once the always-revoked behavior is
-- permanent" — under two months from when this migration was written
-- (2026-08-22). Three tables already show the newer, correct pattern of an
-- explicit GRANT written into their own migration: user_prefs, analytics_events,
-- and questions_metadata (whose SELECT was later deliberately revoked by
-- 20260821000000 — left untouched here, that closure was intentional).
--
-- Grants below are additive and idempotent (a GRANT already held is a no-op),
-- so applying this to production is safe regardless of whether prod currently
-- has these privileges via a still-grandfathered legacy default or not.
--
-- Each table gets exactly the operations its own RLS policies define, split by
-- whether the policy checks auth.uid() (authenticated only) or is unconditional
-- (anon too):

-- Public read-only: recall_chapters/recall_cards/recall_disabled/scholium_apps
-- are read on every page's nav; recall_two_siders/recall_two_sider_points back
-- the two-sider practice feature. All: "public read" policy, USING (true), no
-- write policy.
GRANT SELECT ON
  public.recall_chapters,
  public.recall_cards,
  public.recall_disabled,
  public.recall_two_siders,
  public.recall_two_sider_points,
  public.scholium_apps
TO anon, authenticated;

-- Owner-scoped CRUD: every policy's USING/WITH CHECK is `auth.uid() = user_id`,
-- so only a signed-in caller can ever match a row — anon has no legitimate use
-- and gets no grant (RLS would block it anyway; omitting the grant too keeps
-- the table unreachable at the privilege layer, not just the policy layer).
GRANT SELECT, INSERT, UPDATE, DELETE ON
  public.active_sessions,
  public.mock_attempts,
  public.recall_progress
TO authenticated;

-- Fully open, no auth check ("Anyone can ..." policies, USING/WITH CHECK
-- (true)) — a pre-existing design choice from before these apps had real
-- per-user data (see database/README.md on LanguageHub's tables), not
-- something introduced here.
GRANT SELECT, INSERT, UPDATE, DELETE ON
  public.folders,
  public.set_progress,
  public.vocabulary_items,
  public.vocabulary_sets
TO anon, authenticated;
