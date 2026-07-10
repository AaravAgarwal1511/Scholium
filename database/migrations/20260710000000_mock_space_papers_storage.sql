-- Storage bucket for Mock Space question papers.
--
-- Each user's uploads live under: mock-space-papers/{user_id}/{attempt_id}.pdf
--
-- Only the PDF is stored here. A student's answers, their timer and their
-- crossings-out stay in IndexedDB on the machine they sat the mock on; the bucket
-- exists so that a cleared cache or an evicted blob does not lose the paper
-- itself part-way through an attempt.
--
-- Retention: papers are deleted 15 days after upload by apps/mock-space's
-- /api/prune-papers serverless function, which a daily Vercel Cron invokes with
-- the service role key. Nothing in this file enforces that — deleting a row from
-- storage.objects would orphan the underlying file rather than remove it, so the
-- deletion has to go through the Storage API.

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'mock-space-papers',
  'mock-space-papers',
  false,
  20971520, -- 20 MB; a question paper, not a composed topical bundle
  ARRAY['application/pdf']
)
ON CONFLICT (id) DO NOTHING;

-- Users can do anything with their own folder (path prefix = their user ID).
-- Matches the poetry-notes-projects policy shape.
CREATE POLICY "mock-space: user owns their papers"
ON storage.objects
FOR ALL
USING (
  bucket_id = 'mock-space-papers'
  AND auth.uid()::text = (string_to_array(name, '/'))[1]
)
WITH CHECK (
  bucket_id = 'mock-space-papers'
  AND auth.uid()::text = (string_to_array(name, '/'))[1]
);
