import { requireSuiteScope } from "@repo/ui";

/**
 * Subject-first suite: this tool is mounted at /:subject/recall. Resolved once
 * per page load from the URL; null means the tool was opened without a valid
 * subject and the browser is already on its way to /tools/recall.
 */
export const SCOPE = requireSuiteScope("recall-app");

/** Suite subject slug → recall_chapters.subject_id. */
const RECALL_SUBJECT_IDS: Record<string, string> = { physics: "physics" };

export const RECALL_SUBJECT_ID: string | null = SCOPE
  ? RECALL_SUBJECT_IDS[SCOPE.subject.slug] ?? SCOPE.subject.slug
  : null;
