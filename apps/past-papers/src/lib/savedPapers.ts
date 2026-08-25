import { supabase } from "@/integrations/supabase/client";
import { generatePaper, fetchPaperBytes, type GeneratedPaper } from "@/lib/papers";

/**
 * Saved papers belong to the account, not the browser — the one thing a
 * signed-in user gets that a signed-out one doesn't (the generator itself
 * stays fully usable either way; see the `no_login = true` row in
 * scholium_apps). RLS confines every row to `auth.uid()`.
 *
 * A saved row is a recipe (subject, questionIds, options), not a stored PDF —
 * `generatePaper` in `@/lib/papers` is deterministic given those inputs, so
 * re-downloading recomposes the exact same paper. `r2Key` is only a fast
 * path: set when the original composition landed in R2, so a re-download can
 * hit that cached object directly instead of recomposing from scratch.
 */
const TABLE = "saved_papers";
const LIST_LIMIT = 50;

export interface SavedPaper {
  id: string;
  userId: string;
  createdAt: string;
  subject: string;
  component: string;
  fileName: string;
  questionIds: string[];
  includeMarkScheme: boolean;
  randomize: boolean;
  r2Key: string | null;
}

interface SavedPaperRow {
  id: string;
  user_id: string;
  created_at: string;
  subject: string;
  component: string;
  file_name: string;
  question_ids: string[];
  include_mark_scheme: boolean;
  randomize: boolean;
  r2_key: string | null;
}

function fromRow(row: SavedPaperRow): SavedPaper {
  return {
    id: row.id,
    userId: row.user_id,
    createdAt: row.created_at,
    subject: row.subject,
    component: row.component,
    fileName: row.file_name,
    questionIds: row.question_ids,
    includeMarkScheme: row.include_mark_scheme,
    randomize: row.randomize,
    r2Key: row.r2_key,
  };
}

export interface SavePaperInput {
  subject: string;
  component: string;
  fileName: string;
  questionIds: string[];
  includeMarkScheme: boolean;
  randomize: boolean;
  r2Key: string | null;
}

export async function savePaper(userId: string, input: SavePaperInput): Promise<void> {
  const { error } = await supabase.from(TABLE).insert({
    user_id: userId,
    subject: input.subject,
    component: input.component,
    file_name: input.fileName,
    question_ids: input.questionIds,
    include_mark_scheme: input.includeMarkScheme,
    randomize: input.randomize,
    r2_key: input.r2Key,
  });
  if (error) throw new Error(error.message);
}

/** Most recently generated first. RLS already scopes this to the caller. */
export async function listSavedPapers(userId: string): Promise<SavedPaper[]> {
  const { data, error } = await supabase
    .from(TABLE)
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(LIST_LIMIT);

  if (error) throw new Error(error.message);
  return ((data as SavedPaperRow[] | null) ?? []).map(fromRow);
}

export async function deleteSavedPaper(id: string): Promise<void> {
  const { error } = await supabase.from(TABLE).delete().eq("id", id);
  if (error) throw new Error(error.message);
}

/**
 * Gets a saved paper's bytes back, for the "Download" action in the history
 * panel. The R2 fast path reads the cached object directly by key — same
 * mechanism as the Mock Space handoff (mockSpaceHandoff.ts), needed for the
 * same reason: the public R2 URL has no CORS headers, so fetching its bytes
 * has to go through our own server. That `_cache/` object can be pruned, so a
 * failed fetch falls back to recomposing from the recipe — same questionIds
 * and options, so this reproduces the identical paper, not a different one.
 */
export async function resolveSavedPaper(paper: SavedPaper): Promise<GeneratedPaper> {
  if (paper.r2Key) {
    try {
      return { kind: "blob", blob: await fetchPaperBytes(paper.r2Key) };
    } catch {
      // Fall through to recomposing below.
    }
  }
  return generatePaper(paper.subject, paper.questionIds, {
    includeMarkScheme: paper.includeMarkScheme,
    randomize: paper.randomize,
    fileName: paper.fileName,
  });
}
