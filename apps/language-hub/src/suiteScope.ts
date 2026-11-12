import { requireSuiteScope } from "@repo/ui";

/**
 * Subject-first suite: this tool is mounted at /:subject/language-hub. Resolved once
 * per page load from the URL; null means the tool was opened without a valid
 * subject and the browser is already on its way to /tools/language-hub.
 */
export const SCOPE = requireSuiteScope("language-hub");

/** Suite subject slug → vocabulary_sets.language. */
const LANGUAGES: Record<string, "french" | "spanish"> = { french: "french" };

export const SCOPED_LANGUAGE: "french" | "spanish" | null = SCOPE
  ? LANGUAGES[SCOPE.subject.slug] ?? null
  : null;
