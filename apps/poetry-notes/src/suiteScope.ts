import { requireSuiteScope } from "@repo/ui";

/**
 * Subject-first suite: this tool is mounted at /:subject/poetry-notes. Resolved once
 * per page load from the URL; null means the tool was opened without a valid
 * subject and the browser is already on its way to /tools/poetry-notes.
 */
export const SCOPE = requireSuiteScope("poetry-notes");
