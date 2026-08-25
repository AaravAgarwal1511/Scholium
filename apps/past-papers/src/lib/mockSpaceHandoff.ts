import { supabase } from "@/integrations/supabase/client";
import type { GeneratedPaper, McqAnswerKey } from "@/lib/papers";

export { MOCK_SPACE_URL } from "@/lib/mockSpaceUrl";

// mock-space owns this bucket (apps/mock-space/src/lib/paperRetention.ts) — its
// RLS policy keys off the first path segment being auth.uid(), which is exactly
// the folder a signed-in past-papers user already writes into here. Kept as a
// duplicated constant rather than a cross-app import, which `pnpm boundaries`
// forbids; mockSpaceHandoff.test.ts reads that file and fails if the two drift.
const PAPER_BUCKET = "mock-space-papers";

function paperPath(userId: string, id: string): string {
  return `${userId}/${id}.pdf`;
}

// The MCQ answer key's handoff object, staged next to the paper under the
// same id — mirrors mock-space's own sidecarPath in paperRetention.ts, which
// is what /open downloads from.
function sidecarPath(userId: string, id: string): string {
  return `${userId}/${id}.json`;
}

async function paperBlob(paper: GeneratedPaper): Promise<Blob> {
  if (paper.kind === "blob") return paper.blob;
  // The public R2 URL has no CORS headers configured, so a direct fetch(paper.url)
  // is blocked cross-origin — a plain anchor-click download works around exactly
  // this (a navigation, not a fetch), which is why downloadPaper() never hit it.
  // Reading the bytes back out (rather than just navigating to them) has to go
  // through our own server instead, which already holds R2 credentials.
  const response = await fetch(`/api/proxy-paper?key=${encodeURIComponent(paper.key)}`);
  if (!response.ok) throw new Error(`Could not fetch the generated paper (${response.status})`);
  return response.blob();
}

// Non-fatal by design: OpenPaperPage falls back to an ordinary written attempt
// whenever it can't find (or can't validate) a sidecar, so a failed sidecar
// upload should cost the MCQ interface, not the whole handoff — the paper
// itself is already safely staged by the time this runs.
async function stageMcqSidecar(userId: string, id: string, mcq: McqAnswerKey): Promise<void> {
  const blob = new Blob([JSON.stringify(mcq)], { type: "application/json" });
  const { error } = await supabase.storage
    .from(PAPER_BUCKET)
    .upload(sidecarPath(userId, id), blob, { contentType: "application/json", upsert: true });
  if (error) console.warn("Could not stage the MCQ answer key:", error.message);
}

/**
 * Uploads a generated paper into the caller's own mock-space-papers folder under
 * a fresh id, so mock-space's `/open` route can pick it up and start an attempt.
 * The object is a handoff, not the attempt's permanent copy — `/open` deletes it
 * once `startAttempt` has re-uploaded the paper under its own attempt id.
 *
 * When `paper.mcq` is set, also stages the answer key as a JSON sidecar under
 * the same id (see stageMcqSidecar) — the caller signals this happened by
 * appending `&mcq=1` to the /open URL itself (see GeneratePaperPage.tsx),
 * since that's the one piece of information this function's `string` return
 * can't carry without breaking every existing caller.
 */
export async function stageForMockSpace(userId: string, paper: GeneratedPaper): Promise<string> {
  const blob = await paperBlob(paper);
  const id = crypto.randomUUID();

  const { error } = await supabase.storage.from(PAPER_BUCKET).upload(paperPath(userId, id), blob, {
    contentType: "application/pdf",
    upsert: true,
  });
  if (error) throw new Error(error.message);

  if (paper.mcq) await stageMcqSidecar(userId, id, paper.mcq);

  return id;
}
