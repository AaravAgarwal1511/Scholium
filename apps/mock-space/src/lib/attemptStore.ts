import { supabase } from "@/integrations/supabase/client";
import type { AnswerBox, Attempt, Stroke, Timer } from "./model";
import type { PageGeometry } from "./pdfRender";

/**
 * Attempts belong to the account, not to the browser.
 *
 * Nothing a student writes is kept locally: the boxes, the text, the crossings-out,
 * the strokes and the clock all live in `mock_attempts`, and the question paper in
 * the `mock-space-papers` bucket. Sign in on another machine and your papers are
 * there. RLS confines every row and every object to `auth.uid()`.
 *
 * The one thing in localStorage is `ACTIVE_KEY` — the id of the attempt this tab
 * has open, so a reload lands back on it. That is a pointer, not data; losing it
 * costs one click on the attempt list.
 */
const TABLE = "mock_attempts";
const ACTIVE_KEY = "mock-space:active-attempt";
const LIST_LIMIT = 100;

interface AttemptRow {
  id: string;
  user_id: string;
  title: string;
  created_at: string;
  updated_at: string;
  pages: PageGeometry[];
  boxes: AnswerBox[];
  strokes: Stroke[];
  timer: Timer;
}

/** Postgres speaks ISO timestamps; the model counts epoch milliseconds. */
function fromRow(row: AttemptRow): Attempt {
  return {
    id: row.id,
    userId: row.user_id,
    title: row.title,
    createdAt: Date.parse(row.created_at),
    updatedAt: Date.parse(row.updated_at),
    pages: row.pages ?? [],
    boxes: row.boxes ?? [],
    strokes: row.strokes ?? [],
    timer: row.timer,
  };
}

function toRow(attempt: Attempt): AttemptRow {
  if (!attempt.userId) {
    throw new Error("An anonymous attempt has no account to be stored against.");
  }
  return {
    id: attempt.id,
    user_id: attempt.userId,
    title: attempt.title,
    created_at: new Date(attempt.createdAt).toISOString(),
    updated_at: new Date(attempt.updatedAt).toISOString(),
    pages: attempt.pages,
    boxes: attempt.boxes,
    strokes: attempt.strokes,
    timer: attempt.timer,
  };
}

/** Upsert, because autosave cannot know whether the row exists yet. */
export async function saveAttempt(attempt: Attempt): Promise<void> {
  // The /demo attempt is signed out and deliberately ephemeral.
  if (!attempt.userId) return;

  const { error } = await supabase.from(TABLE).upsert(toRow(attempt));
  if (error) throw new Error(error.message);
}

export async function loadAttempt(id: string): Promise<Attempt | null> {
  const { data, error } = await supabase.from(TABLE).select("*").eq("id", id).limit(1);
  if (error) throw new Error(error.message);
  const row = (data as AttemptRow[] | null)?.[0];
  return row ? fromRow(row) : null;
}

/** Most recently touched first. RLS already scopes this to the caller. */
export async function listAttempts(userId: string): Promise<Attempt[]> {
  const { data, error } = await supabase
    .from(TABLE)
    .select("*")
    .eq("user_id", userId)
    .order("updated_at", { ascending: false })
    .limit(LIST_LIMIT);

  if (error) throw new Error(error.message);
  return ((data as AttemptRow[] | null) ?? []).map(fromRow);
}

export async function deleteAttempt(id: string): Promise<void> {
  const { error } = await supabase.from(TABLE).delete().eq("id", id);
  if (error) throw new Error(error.message);
}

export function setActiveAttemptId(id: string): void {
  localStorage.setItem(ACTIVE_KEY, id);
}

export function getActiveAttemptId(): string | null {
  return localStorage.getItem(ACTIVE_KEY);
}

export function clearActiveAttemptId(): void {
  localStorage.removeItem(ACTIVE_KEY);
}
