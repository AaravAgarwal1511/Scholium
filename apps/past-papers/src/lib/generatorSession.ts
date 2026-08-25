import type { GeneratedPaper } from "@/lib/papers";

// Keeps the generator's in-progress selections and last result across a
// remount — most importantly the /signin round trip, since Auth.tsx always
// navigates away from and back to this page. Session-scoped (cleared when the
// tab closes), not the signed-out "saved papers" feature: this is resilience
// against navigating within the tab, not an account-scoped value proposition.
const KEY = "pastpapers:generator-session";

export type SelectionMap = Record<number, number>;

export interface GeneratorResult {
  paper: GeneratedPaper;
  fileName: string;
  subject: string;
  questionIds: string[];
  includeMarkScheme: boolean;
  randomize: boolean;
}

export interface PersistedResultRecipe {
  fileName: string;
  subject: string;
  questionIds: string[];
  includeMarkScheme: boolean;
  randomize: boolean;
  // Set only when the composed paper came back as an R2 URL — a string, so it
  // survives JSON serialisation. A `{kind:"blob"}` result carries an actual
  // Blob, which does not: the caller recomposes those from questionIds
  // instead, which is deterministic (same ids + options => same PDF).
  r2: { url: string; key: string } | null;
}

export interface GeneratorSessionState {
  selectedSubject: string | null;
  selectedComponent: string | null;
  selections: SelectionMap;
  pickedFrom: number | null;
  pickedTo: number | null;
  includeMarkScheme: boolean;
  randomize: boolean;
  resultRecipe: PersistedResultRecipe | null;
}

export function loadGeneratorSession(): GeneratorSessionState | null {
  try {
    const raw = sessionStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as GeneratorSessionState) : null;
  } catch {
    return null;
  }
}

export function saveGeneratorSession(state: GeneratorSessionState): void {
  try {
    sessionStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    // Private-browsing / quota edge cases can throw here. Losing the
    // resilience net is fine; losing the page to an uncaught error is not.
  }
}

export function resultToRecipe(result: GeneratorResult | null): PersistedResultRecipe | null {
  if (!result) return null;
  return {
    fileName: result.fileName,
    subject: result.subject,
    questionIds: result.questionIds,
    includeMarkScheme: result.includeMarkScheme,
    randomize: result.randomize,
    r2: result.paper.kind === "url" ? { url: result.paper.url, key: result.paper.key } : null,
  };
}
