import { supabase } from "@/integrations/supabase/client";
import type { GeneratedPaper } from "@/lib/papers";

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

/**
 * Uploads a generated paper into the caller's own mock-space-papers folder under
 * a fresh id, so mock-space's `/open` route can pick it up and start an attempt.
 * The object is a handoff, not the attempt's permanent copy — `/open` deletes it
 * once `startAttempt` has re-uploaded the paper under its own attempt id.
 */
export async function stageForMockSpace(userId: string, paper: GeneratedPaper): Promise<string> {
  const blob = await paperBlob(paper);
  const id = crypto.randomUUID();

  const { error } = await supabase.storage.from(PAPER_BUCKET).upload(paperPath(userId, id), blob, {
    contentType: "application/pdf",
    upsert: true,
  });
  if (error) throw new Error(error.message);

  return id;
}
