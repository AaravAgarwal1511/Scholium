-- Saved papers for past-papers, keyed to an account rather than a browser.
--
-- Stores the recipe, not the PDF: `generatePaper(subject, questionIds, options)`
-- (apps/past-papers/src/lib/papers.ts) is deterministic given its inputs, and the
-- question ids are already chosen client-side before that call. A row of a few
-- hundred bytes therefore reproduces the paper exactly, with no blob storage, no
-- R2 retention coupling, and no orphan-file problem. `r2_key` is kept only as a
-- fast path — set when the original composition came back as an R2 URL, so a
-- re-download can hit that cached object directly — with regeneration from the
-- recipe as the fallback once that `_cache/` object is pruned.
--
-- This is the account's one and only reward for signing in on this app: the
-- generator itself stays fully usable signed out (see the `no_login = true` row
-- in scholium_apps), so nothing here may gate anything that already works
-- anonymously — only add to what a signed-in user gets back.

CREATE TABLE public.saved_papers (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id              UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  subject              TEXT NOT NULL,
  component            TEXT NOT NULL,
  file_name            TEXT NOT NULL,
  question_ids         TEXT[] NOT NULL,
  include_mark_scheme  BOOLEAN NOT NULL,
  randomize            BOOLEAN NOT NULL,
  r2_key               TEXT
);

-- The history panel is "my papers, most recent first".
CREATE INDEX saved_papers_user_created_idx
  ON public.saved_papers (user_id, created_at DESC);

-- ── RLS: a user may only read/write/delete their own saved papers ───────────────────
ALTER TABLE public.saved_papers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "saved_papers: user select"
  ON public.saved_papers FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "saved_papers: user insert"
  ON public.saved_papers FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "saved_papers: user delete"
  ON public.saved_papers FOR DELETE
  USING (auth.uid() = user_id);

-- No UPDATE policy: a saved paper is write-once (insert) / removable (delete),
-- never edited in place — there is nothing about a past recipe that should change.
GRANT SELECT, INSERT, DELETE ON public.saved_papers TO authenticated;
