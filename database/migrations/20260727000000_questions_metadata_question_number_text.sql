-- questions_metadata.question_number: integer -> text
--
-- Every subject up to now numbered its questions with a plain integer. IGCSE
-- Economics (0455) Paper 2 is a structured paper: its unit of extraction is the
-- sub-part, labelled "2(a)", "2(b)", ... and there is no integer that identifies
-- one. The extraction index (_questions.json) already keys these records by the
-- same string, so the column has to widen to match.
--
-- Existing rows are unaffected in meaning: 5 becomes '5'. The PDF composer
-- normalises both sides of the lookup with String(), so integer subjects resolve
-- exactly as before (verified by composing a fixed sample per subject and
-- diffing the page geometry before/after).
--
-- Sorting is the one thing that does change: '10' < '5' lexicographically. No
-- query orders by this column — the composer sorts in JS with a comparator that
-- parses "2(a)" into (2, 'a') — but anything added later must not rely on
-- ORDER BY question_number.

alter table public.questions_metadata
  alter column question_number type text using question_number::text;

comment on column public.questions_metadata.question_number is
  'Question label as printed on the paper. Integer-valued for most subjects ("7"), but a sub-part label for structured papers such as 0455 Paper 2 ("2(a)"). Text, not integer — do not ORDER BY this column.';
