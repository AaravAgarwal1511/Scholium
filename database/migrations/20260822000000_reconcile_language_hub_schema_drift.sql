-- Reconcile 20260113004227_...sql's `DROP COLUMN IF EXISTS user_id` (on
-- vocabulary_sets and set_progress) and several NOT NULL columns from
-- 20251203142017's original CREATE TABLE against what production's live schema
-- actually is.
--
-- Discovered by running `supabase db reset` end-to-end (Phase 0 of the staging
-- effort) and then calling get_user_stats(): it failed with `column sp.user_id
-- does not exist`. 20260421010000_admin_stats_rpc.sql's
-- `LEFT JOIN public.set_progress sp ON sp.user_id = u.id` depends on a column
-- the fresh replay didn't have — a real RPC, not a hypothetical.
--
-- Cross-checked against a live `supabase gen types typescript --linked` pull
-- against prod (2026-08-22): prod's set_progress and vocabulary_sets BOTH still
-- carry `user_id uuid`, nullable, and several other columns are nullable in prod
-- despite being declared NOT NULL by the original CREATE TABLE:
-- set_progress.{correct_count,created_at,item_id,mastered,set_id,updated_at},
-- vocabulary_items.{created_at,set_id}, vocabulary_sets.{created_at,updated_at}.
--
-- Best available explanation: 20260113004227 (and 20251203142017's NOT NULLs)
-- most likely applied against a separate, now-orphaned Supabase project — see
-- the removed apps/language-hub/supabase/config.toml, which pinned a project_id
-- not part of this org — before language-hub's tables were consolidated into
-- this shared project by some other, undocumented process. This migration makes
-- a fresh replay match prod's real current shape rather than the file history's
-- aspirational one.
--
-- ACTION REQUIRED: this is inferred from a type diff plus a runtime error, not
-- a verified `supabase db pull` against prod — that step is still blocked on a
-- migration-history mismatch (prod's tracking table doesn't know about the
-- migrations folded in during this same effort). Confirm with a real `db pull`
-- once that's resolved, and drop this notice.

ALTER TABLE public.set_progress
  ADD COLUMN IF NOT EXISTS user_id uuid,
  ALTER COLUMN correct_count DROP NOT NULL,
  ALTER COLUMN created_at DROP NOT NULL,
  ALTER COLUMN item_id DROP NOT NULL,
  ALTER COLUMN mastered DROP NOT NULL,
  ALTER COLUMN set_id DROP NOT NULL,
  ALTER COLUMN updated_at DROP NOT NULL;

ALTER TABLE public.vocabulary_items
  ALTER COLUMN created_at DROP NOT NULL,
  ALTER COLUMN set_id DROP NOT NULL;

ALTER TABLE public.vocabulary_sets
  ADD COLUMN IF NOT EXISTS user_id uuid,
  ALTER COLUMN created_at DROP NOT NULL,
  ALTER COLUMN updated_at DROP NOT NULL;
