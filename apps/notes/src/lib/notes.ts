import { supabase, NOTES_BUCKET } from "@/integrations/supabase/client";

// One note. There is no index table — everything shown to the reader is derived
// from the object name in the bucket, so renaming a file in the Supabase
// dashboard is the whole way to retitle or reorder a note.
export interface NoteFile {
  /** The object key in the bucket, e.g. "3-Electricity-and-Magnetism.pdf". */
  fileName: string;
  /** Human title derived from the file name. */
  title: string;
  /** Leading "NN-" prefix, if any. Numbered notes sort before unnumbered ones. */
  order: number | null;
}

// "3-Electricity-and-Magnetism.pdf" -> { title: "Electricity and Magnetism", order: 3 }
// "Kinematics reference.pdf"        -> { title: "Kinematics reference", order: null }
// Modelled on parseFileName() in apps/past-papers/src/lib/papers.ts.
export function parseNoteFileName(fileName: string): { title: string; order: number | null } | null {
  if (!fileName.toLowerCase().endsWith(".pdf")) return null;
  const stem = fileName.slice(0, -4).trim();
  if (!stem) return null;

  let order: number | null = null;
  let rest = stem;

  // Optional leading integer, separated from the rest by "-", "_" or whitespace.
  // `.*` (not `.+`) so "5-.pdf" matches here and is then rejected below for
  // having no title, rather than falling through with a title of "5".
  const prefix = stem.match(/^(\d+)\s*[-_ ]\s*(.*)$/);
  if (prefix) {
    order = Number(prefix[1]);
    rest = prefix[2];
  }

  const title = rest.replace(/[-_]+/g, " ").replace(/\s+/g, " ").trim();
  if (!title) return null;

  return { title, order };
}

// Numbered notes first, in ascending order; then unnumbered, alphabetically.
// Titles break every tie so the order is stable.
export function compareNotes(a: NoteFile, b: NoteFile): number {
  if (a.order !== null && b.order !== null && a.order !== b.order) return a.order - b.order;
  if (a.order !== null && b.order === null) return -1;
  if (a.order === null && b.order !== null) return 1;
  return a.title.localeCompare(b.title, undefined, { sensitivity: "base" });
}

// Lists the private bucket. This is possible client-side only because the bucket
// is Supabase Storage, not R2 (R2 has no browser-safe listing — that is the
// whole reason past-papers needs its `paper_files` table). The bucket's
// `authenticated`-only SELECT policy gates the call, so a signed-out caller gets
// nothing.
export async function listNotes(): Promise<NoteFile[]> {
  const { data, error } = await supabase.storage.from(NOTES_BUCKET).list("", {
    limit: 1000,
    sortBy: { column: "name", order: "asc" },
  });
  if (error) throw error;

  const notes: NoteFile[] = [];
  for (const entry of data ?? []) {
    // Folder/prefix entries have id === null; skip them and dotfiles.
    if (entry.id === null || !entry.name || entry.name.startsWith(".")) continue;
    const parsed = parseNoteFileName(entry.name);
    if (!parsed) continue;
    notes.push({ fileName: entry.name, title: parsed.title, order: parsed.order });
  }
  return notes.sort(compareNotes);
}

// A short-lived URL for the <iframe> and the Download anchor. The bucket is
// private, so there is no public URL — every view mints a fresh signed one.
const SIGNED_URL_TTL_SECONDS = 60 * 60;

export async function signedUrlFor(fileName: string): Promise<string> {
  const { data, error } = await supabase.storage
    .from(NOTES_BUCKET)
    .createSignedUrl(fileName, SIGNED_URL_TTL_SECONDS);
  if (error || !data) throw error ?? new Error("Could not open this note.");
  return data.signedUrl;
}
