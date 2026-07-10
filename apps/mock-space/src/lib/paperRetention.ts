/**
 * How long an uploaded question paper is kept in Supabase Storage.
 *
 * The authoritative deletion happens server-side, in `api/prune-papers.js`, which
 * a daily Vercel Cron invokes. A client-side sweep would never run for a student
 * who does not come back, and their paper would sit in the bucket forever.
 *
 * `api/prune-papers.js` cannot import this module (it is plain JS, run by Vercel
 * outside the Vite pipeline) so it repeats the constant. `paperRetention.test.ts`
 * reads that file and fails if the two ever drift apart.
 */
export const PAPER_RETENTION_DAYS = 15;

export const PAPER_BUCKET = "mock-space-papers";

const DAY_MS = 86_400_000;

/** Per-user folder prefix is what the bucket's RLS policy keys off. */
export function paperPath(userId: string, attemptId: string): string {
  return `${userId}/${attemptId}.pdf`;
}

export function paperExpiresAt(createdAt: number): number {
  return createdAt + PAPER_RETENTION_DAYS * DAY_MS;
}

export function isPaperExpired(createdAt: number, now: number = Date.now()): boolean {
  return now >= paperExpiresAt(createdAt);
}

/** Whole days remaining, rounded up. 0 once the paper has expired. */
export function daysUntilPaperExpiry(createdAt: number, now: number = Date.now()): number {
  return Math.max(0, Math.ceil((paperExpiresAt(createdAt) - now) / DAY_MS));
}
