import { supabase } from "@/integrations/supabase/client";
import { PAPER_BUCKET, paperPath } from "./paperRetention";

/**
 * The uploaded question paper, kept in Supabase Storage for `PAPER_RETENTION_DAYS`.
 *
 * This is the *only* copy — nothing is cached in the browser — which is why
 * `startAttempt` refuses to begin a mock whose upload failed, and why signing in on
 * another machine reopens the same paper. The answers that go with it live in the
 * `mock_attempts` table (see attemptStore.ts).
 *
 * The bucket is private and its RLS policy admits only `auth.uid()`'s own folder,
 * so none of this is reachable by the signed-out /demo attempt.
 */
export async function uploadPaper(
  userId: string,
  attemptId: string,
  paper: Blob,
): Promise<boolean> {
  const { error } = await supabase.storage
    .from(PAPER_BUCKET)
    .upload(paperPath(userId, attemptId), paper, {
      contentType: "application/pdf",
      upsert: true,
    });

  if (error) {
    // The caller turns this into a refusal to start: there is no local fallback.
    console.warn("Could not store the paper:", error.message);
    return false;
  }
  return true;
}

export async function downloadPaper(
  userId: string,
  attemptId: string,
): Promise<ArrayBuffer | null> {
  const { data, error } = await supabase.storage
    .from(PAPER_BUCKET)
    .download(paperPath(userId, attemptId));

  if (error || !data) return null;
  return data.arrayBuffer();
}

export async function deletePaper(userId: string, attemptId: string): Promise<void> {
  await supabase.storage.from(PAPER_BUCKET).remove([paperPath(userId, attemptId)]);
}
