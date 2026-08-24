-- Add folders feature for grouping vocabulary sets.
-- Purely additive: existing sets get folder_id = NULL and continue to work unchanged.

CREATE TABLE IF NOT EXISTS public.folders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.folders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view folders"
ON public.folders FOR SELECT
USING (true);

CREATE POLICY "Anyone can create folders"
ON public.folders FOR INSERT
WITH CHECK (true);

CREATE POLICY "Anyone can update folders"
ON public.folders FOR UPDATE
USING (true);

CREATE POLICY "Anyone can delete folders"
ON public.folders FOR DELETE
USING (true);

-- Nullable FK so deleting a folder preserves its sets (they become uncategorized).
ALTER TABLE public.vocabulary_sets
ADD COLUMN IF NOT EXISTS folder_id uuid REFERENCES public.folders(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS vocabulary_sets_folder_id_idx
ON public.vocabulary_sets(folder_id);
