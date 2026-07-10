-- Mock Space attempts, stored per account rather than per browser.
--
-- Everything a student produces during a mock lives here: where they put each
-- answer box, the text inside it, which runs they crossed out, their freehand
-- strokes, and the state of the clock. The question paper itself lives in the
-- mock-space-papers storage bucket, keyed by the same attempt id.
--
-- Signing in on any machine therefore shows the same papers. Nothing about an
-- attempt is written to the browser except a pointer to whichever one is open.
--
-- Retention: rows are deleted 15 days after they are created, by the same
-- /api/prune-papers cron that sweeps the storage bucket. Answers are useless once
-- their paper is gone -- you cannot export a script without the paper it was
-- written on -- so the two expire together.

CREATE TABLE public.mock_attempts (
  id         UUID PRIMARY KEY,
  user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title      TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Page geometry in PDF points, so a resumed attempt can lay out its boxes
  -- before the PDF has finished downloading.
  pages   JSONB NOT NULL DEFAULT '[]'::jsonb,
  boxes   JSONB NOT NULL DEFAULT '[]'::jsonb,
  strokes JSONB NOT NULL DEFAULT '[]'::jsonb,

  -- { durationMs, deadlineAt, remainingMs, state }. deadlineAt is an absolute
  -- epoch, which is why closing the tab does not refund a running clock.
  timer JSONB NOT NULL
);

-- The attempt list is "my attempts, most recently touched first".
CREATE INDEX mock_attempts_user_updated_idx
  ON public.mock_attempts (user_id, updated_at DESC);

-- Lets the retention sweep find expired rows without a full scan.
CREATE INDEX mock_attempts_created_idx ON public.mock_attempts (created_at);

-- ── RLS: a user may only read/write their own attempts ──────────────────────────
ALTER TABLE public.mock_attempts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "mock_attempts: user select"
  ON public.mock_attempts FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "mock_attempts: user insert"
  ON public.mock_attempts FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "mock_attempts: user update"
  ON public.mock_attempts FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "mock_attempts: user delete"
  ON public.mock_attempts FOR DELETE
  USING (auth.uid() = user_id);
