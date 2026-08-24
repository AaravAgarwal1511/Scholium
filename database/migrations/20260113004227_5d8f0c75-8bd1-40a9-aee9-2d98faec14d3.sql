-- Drop RLS policies that reference user_id or has_role
DROP POLICY IF EXISTS "Admins and owners can create sets" ON public.vocabulary_sets;
DROP POLICY IF EXISTS "Admins and owners can delete sets" ON public.vocabulary_sets;
DROP POLICY IF EXISTS "Admins and owners can update sets" ON public.vocabulary_sets;
DROP POLICY IF EXISTS "Users can create their own progress" ON public.set_progress;
DROP POLICY IF EXISTS "Users can delete their own progress" ON public.set_progress;
DROP POLICY IF EXISTS "Users can update their own progress" ON public.set_progress;
DROP POLICY IF EXISTS "Users can view their own progress" ON public.set_progress;
-- folders/user_roles policies are NOT dropped individually here (unlike above):
-- on a fresh replay neither table exists yet at this point in history (they were
-- created out-of-band in the dashboard, same as scholium_apps — see
-- 20260526020000_scholium_apps_base.sql), and `DROP POLICY ... ON <table>`
-- errors on a missing relation even with IF EXISTS on the policy, unlike
-- `DROP TABLE IF EXISTS`. The CASCADE below drops their policies regardless.

-- Drop the folders table
DROP TABLE IF EXISTS public.folders CASCADE;

-- Drop the user_roles table
DROP TABLE IF EXISTS public.user_roles CASCADE;

-- Drop the has_role function
DROP FUNCTION IF EXISTS public.has_role(uuid, app_role);

-- Remove user_id and folder_id columns from vocabulary_sets
ALTER TABLE public.vocabulary_sets DROP COLUMN IF EXISTS user_id;
ALTER TABLE public.vocabulary_sets DROP COLUMN IF EXISTS folder_id;

-- Remove user_id column from set_progress
ALTER TABLE public.set_progress DROP COLUMN IF EXISTS user_id;

-- Drop the app_role enum type
DROP TYPE IF EXISTS public.app_role;

-- Create simple open RLS policies for vocabulary_sets
--
-- Dropped first (unlike the set_progress block below): on a fresh replay these
-- three exact names already exist from 20251203142017_...sql and were never
-- dropped in between, unlike on prod where an out-of-band dashboard edit had
-- already replaced them with the "Admins and owners can ..." policies dropped
-- above by the time this migration ran.
DROP POLICY IF EXISTS "Anyone can create vocabulary sets" ON public.vocabulary_sets;
DROP POLICY IF EXISTS "Anyone can update vocabulary sets" ON public.vocabulary_sets;
DROP POLICY IF EXISTS "Anyone can delete vocabulary sets" ON public.vocabulary_sets;

CREATE POLICY "Anyone can create vocabulary sets"
ON public.vocabulary_sets FOR INSERT
WITH CHECK (true);

CREATE POLICY "Anyone can update vocabulary sets"
ON public.vocabulary_sets FOR UPDATE
USING (true);

CREATE POLICY "Anyone can delete vocabulary sets"
ON public.vocabulary_sets FOR DELETE
USING (true);

-- Create simple open RLS policies for set_progress
CREATE POLICY "Anyone can view progress"
ON public.set_progress FOR SELECT
USING (true);

CREATE POLICY "Anyone can create progress"
ON public.set_progress FOR INSERT
WITH CHECK (true);

CREATE POLICY "Anyone can update progress"
ON public.set_progress FOR UPDATE
USING (true);

CREATE POLICY "Anyone can delete progress"
ON public.set_progress FOR DELETE
USING (true);