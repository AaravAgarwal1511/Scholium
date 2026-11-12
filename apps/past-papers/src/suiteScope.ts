import { requireSuiteScope } from "@repo/ui";

/**
 * Subject-first suite: this tool is mounted at /:subject/past-papers. Resolved once
 * per page load from the URL; null means the tool was opened without a valid
 * subject and the browser is already on its way to /tools/past-papers.
 */
export const SCOPE = requireSuiteScope("past-papers");

/** Suite subject slug → Cambridge IGCSE syllabus code (paper_files.subject). */
const SUBJECT_CODES: Record<string, string> = { physics: "0625" };

export const SCOPED_SUBJECT_CODE: string | null = SCOPE
  ? SUBJECT_CODES[SCOPE.subject.slug] ?? null
  : null;
