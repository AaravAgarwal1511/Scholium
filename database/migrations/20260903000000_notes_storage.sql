-- Storage bucket for the Notes app (apps/notes).
--
-- A flat bucket of study-note PDFs — no per-user folders, no subject hierarchy,
-- no index table. apps/notes lists it directly with
-- `supabase.storage.from('notes').list()` (possible because this is Supabase
-- Storage, not R2) and serves each PDF to the browser as a short-lived signed
-- URL.
--
-- Layout inside the bucket:
--   notes/{n}-{Name}.pdf        e.g. notes/3-Electricity-and-Magnetism.pdf
-- The optional leading "{n}-" only sets the display order; the rest is the title.
--
-- Writes are admin-only via the Supabase dashboard / service role — same posture
-- as the `papers` and `app-screenshots` buckets. There is no upload path in the
-- app and no ingestion script.

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'notes',
  'notes',
  false,               -- private: no public URL, reads go through signed URLs
  52428800,            -- 50 MB per file
  ARRAY['application/pdf']
)
ON CONFLICT (id) DO NOTHING;

-- Any signed-in user may read every note; nobody may write.
--
-- `TO authenticated` is what makes the login gate real. `anon` has no SELECT
-- policy on this bucket, so a signed-out caller — even one holding a direct
-- object path or an old signed URL whose token has expired — gets nothing. This
-- is the one place the Notes app's "login required" promise is actually
-- enforced; the route guard in the client is only a convenience.
CREATE POLICY "notes: authenticated read"
ON storage.objects
FOR SELECT
TO authenticated
USING (bucket_id = 'notes');

-- No INSERT / UPDATE / DELETE policy: uploads happen through the dashboard or
-- the service role, both of which bypass RLS.
