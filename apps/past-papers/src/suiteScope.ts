import { requireSuiteScope } from "@repo/ui";

/**
 * Subject-first suite: this tool is mounted at /:subject/past-papers. Resolved once
 * per page load from the URL; null means the tool was opened without a valid
 * subject and the browser is already on its way to /tools/past-papers.
 */
export const SCOPE = requireSuiteScope("past-papers");

/** Suite subject slug → Cambridge IGCSE syllabus code (paper_files.subject). */
const SUBJECT_CODES: Record<string, string> = {
  physics: "0625",
  chemistry: "0620",
  biology: "0610",
  maths: "0580",
  "int-maths": "0607",
  "add-maths": "0606",
  "computer-science": "0478",
  economics: "0455",
};

/** First Language English isn't in the generator's index — it's a static
 *  download list at /fle — so it gets its own flag instead of a code. */
export const SCOPED_IS_FLE = SCOPE?.subject.slug === "english-language";

export const SCOPED_SUBJECT_CODE: string | null = SCOPE
  ? SUBJECT_CODES[SCOPE.subject.slug] ?? null
  : null;
