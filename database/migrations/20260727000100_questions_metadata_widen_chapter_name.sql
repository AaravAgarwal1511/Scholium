-- questions_metadata.chapter_name: varchar(50) -> text
--
-- The 50-character cap was sized against the maths syllabuses. IGCSE Economics
-- (0455) has "Differences in Economic Development Between Countries" at 53, so
-- the import fails with 22001 "value too long". The cap buys nothing here — the
-- name is display text mirrored from the R2 filename — so drop the limit rather
-- than pick a new arbitrary number the next syllabus will exceed.
--
-- Widening a varchar to text rewrites no rows and cannot truncate.

alter table public.questions_metadata
  alter column chapter_name type text;
