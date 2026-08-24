-- Widen mock-space-papers to also accept a JSON sidecar.
--
-- past-papers stages an MCQ paper's answer key as {user_id}/{id}.json next to
-- the PDF handoff object {user_id}/{id}.pdf it already writes (see
-- apps/past-papers/src/lib/mockSpaceHandoff.ts's stageMcqSidecar and
-- apps/mock-space/src/lib/paperRetention.ts's sidecarPath). The bucket was
-- pinned to ARRAY['application/pdf'] in 20260710000000_mock_space_papers_storage.sql,
-- which rejects that upload outright. Same RLS policy applies unchanged — it
-- keys off the path's first segment, not the file extension or MIME type.
--
-- api/prune-papers.js sweeps every file under an expired user folder
-- regardless of extension, so the sidecar expires with its paper already;
-- nothing there needs to change.

UPDATE storage.buckets
SET allowed_mime_types = ARRAY['application/pdf', 'application/json']
WHERE id = 'mock-space-papers';
