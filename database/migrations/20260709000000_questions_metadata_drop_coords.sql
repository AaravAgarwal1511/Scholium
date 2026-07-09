-- Drop the per-question crop coordinates from questions_metadata.
--
-- Crop geometry is sourced exclusively from the R2 index files
--   _source/<subject>/Paper <n>/_questions.json
--   _source/<subject>/Paper <n>/_mark_schemes.json
-- which _build_topicals.py produces and server/compose-pdf.js reads (pageSpecs
-- uses qRecord.y_start / y_end / page). The columns below were an unenforced
-- mirror of that state: they were SELECTed but never used for geometry, and had
-- already drifted on 12 rows.
--
-- ms_y_start/ms_y_end were read only for null-ness, as a proxy for "does
-- _mark_schemes.json cover this question". compose-pdf.js now asks the index
-- directly, so the proxy is gone.
--
-- Pre-drop values (DB and JSON side by side) are archived to
--   database/archive/0607_November2020-41_drifted_coords_20260709.csv
--
-- ORDERING: the code that stops SELECTing these columns must be deployed BEFORE
-- this migration runs, or every /api/compose-paper call returns a PostgREST 400.

ALTER TABLE questions_metadata
  DROP COLUMN IF EXISTS y_start,
  DROP COLUMN IF EXISTS y_end,
  DROP COLUMN IF EXISTS ms_y_start,
  DROP COLUMN IF EXISTS ms_y_end;
