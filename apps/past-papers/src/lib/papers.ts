import { supabase, PAPERS_BUCKET } from "@/integrations/supabase/client";

// When VITE_R2_PUBLIC_URL is set, papers are served from Cloudflare R2 and the
// folder tree is listed from the `paper_files` table (R2 can't be listed from
// the browser). Unset → fall back to the original public Supabase bucket.
const R2_PUBLIC_URL =
  (import.meta.env.VITE_R2_PUBLIC_URL as string | undefined)?.replace(/\/+$/, "") || "";
const USE_R2 = R2_PUBLIC_URL.length > 0;

function r2Url(subject: string, component: string, fileName: string): string {
  return `${R2_PUBLIC_URL}/${encodeURIComponent(subject)}/${encodeURIComponent(
    component,
  )}/${encodeURIComponent(fileName)}`;
}

// Friendly display names for subject codes. The code (e.g. "0607") stays the
// canonical identifier used in URLs, the `paper_files` index, and R2 paths —
// this map only changes what the user sees. Add new subjects here.
const SUBJECT_DISPLAY_NAMES: Record<string, string> = {
  "0455": "Economics",
  "0478": "Computer Science",
  "0606": "Additional Mathematics",
  "0607": "International Mathematics",
  "0610": "Biology",
  "0620": "Chemistry",
  "0625": "Physics",
};

export function subjectDisplayName(code: string): string {
  return SUBJECT_DISPLAY_NAMES[code] ?? code;
}

// Subjects hidden from the app without removing anything. Their PDFs stay in R2,
// their rows stay in `paper_files` and `questions_metadata`, and `pnpm
// index:papers` keeps mirroring them — so re-enabling is deleting a line here,
// not a re-upload. Hiding rather than deleting also means the index stays a true
// mirror of the bucket, which is what `index:papers` asserts.
//
// Note this hides the subject; it does not make the files unreachable. The R2
// bucket is public, so anyone holding a direct PDF URL can still fetch it.
const DISABLED_SUBJECTS = new Set<string>([]);

export function isSubjectDisabled(code: string): boolean {
  return DISABLED_SUBJECTS.has(code);
}

// Distinct subject/component values from the index table (PostgREST has no
// DISTINCT, so we dedupe client-side — the set is small).
async function distinctColumn(
  column: "subject" | "component",
  subject?: string,
): Promise<string[]> {
  let query = supabase.from("paper_files").select(column);
  if (subject) query = query.eq("subject", subject);
  const { data, error } = await query;
  if (error) throw error;
  const seen = new Set<string>();
  for (const row of (data ?? []) as Record<string, string>[]) {
    if (row[column]) seen.add(row[column]);
  }
  return Array.from(seen).sort((a, b) => a.localeCompare(b));
}

export type PaperType = "QP" | "MS";

export interface PaperFile {
  type: PaperType;
  url: string;
  fileName: string;
}

export interface ChapterEntry {
  number: number;
  name: string;
  questionPaper: PaperFile | null;
  markScheme: PaperFile | null;
}

interface ParsedFile {
  chapterNumber: number;
  chapterName: string;
  type: PaperType;
  fileName: string;
}

// Filename convention: {n}-{name}-{QP|MS}.pdf
// "name" may itself contain hyphens (e.g. "3-Number-and-Algebra-QP.pdf").
export function parseFileName(fileName: string): ParsedFile | null {
  if (!fileName.toLowerCase().endsWith(".pdf")) return null;
  const stem = fileName.slice(0, -4);

  const lastDash = stem.lastIndexOf("-");
  if (lastDash === -1) return null;
  const typeRaw = stem.slice(lastDash + 1).toUpperCase();
  if (typeRaw !== "QP" && typeRaw !== "MS") return null;

  const rest = stem.slice(0, lastDash);
  const firstDash = rest.indexOf("-");
  if (firstDash === -1) return null;

  const numberRaw = rest.slice(0, firstDash);
  const number = Number(numberRaw);
  if (!Number.isFinite(number)) return null;

  const rawName = rest.slice(firstDash + 1).trim();
  if (!rawName) return null;
  const chapterName = rawName.replace(/-+/g, " ").replace(/\s+/g, " ").trim();

  return { chapterNumber: number, chapterName, type: typeRaw, fileName };
}

async function listFolders(prefix: string): Promise<string[]> {
  const { data, error } = await supabase.storage.from(PAPERS_BUCKET).list(prefix, {
    limit: 1000,
    sortBy: { column: "name", order: "asc" },
  });
  if (error) throw error;
  // In Supabase Storage, folder entries have id === null.
  return (data ?? [])
    .filter((entry) => entry.id === null && entry.name && !entry.name.startsWith("."))
    .map((entry) => entry.name);
}

export async function listSubjects(): Promise<string[]> {
  const subjects = USE_R2 ? await distinctColumn("subject") : await listFolders("");
  return subjects.filter((code) => !isSubjectDisabled(code));
}

export async function listComponents(subject: string): Promise<string[]> {
  if (USE_R2) return distinctColumn("component", subject);
  return listFolders(subject);
}

// Group a flat list of file names into chapter entries. `urlFor` resolves each
// file name to a downloadable URL (R2 public URL or Supabase public URL).
function buildChapters(
  fileNames: string[],
  urlFor: (fileName: string) => string,
): ChapterEntry[] {
  const groups = new Map<number, ChapterEntry>();

  for (const name of fileNames) {
    const parsed = parseFileName(name);
    if (!parsed) continue;

    const file: PaperFile = {
      type: parsed.type,
      url: urlFor(name),
      fileName: parsed.fileName,
    };

    const existing = groups.get(parsed.chapterNumber);
    if (existing) {
      if (parsed.type === "QP") existing.questionPaper = file;
      else existing.markScheme = file;
      // Prefer the QP-derived chapter name if both exist; otherwise take whatever came first.
      if (parsed.type === "QP") existing.name = parsed.chapterName;
    } else {
      groups.set(parsed.chapterNumber, {
        number: parsed.chapterNumber,
        name: parsed.chapterName,
        questionPaper: parsed.type === "QP" ? file : null,
        markScheme: parsed.type === "MS" ? file : null,
      });
    }
  }

  return Array.from(groups.values()).sort((a, b) => a.number - b.number);
}

export async function listChapters(subject: string, component: string): Promise<ChapterEntry[]> {
  if (USE_R2) {
    const { data, error } = await supabase
      .from("paper_files")
      .select("file_name")
      .eq("subject", subject)
      .eq("component", component);
    if (error) throw error;
    const names = ((data ?? []) as { file_name: string }[]).map((r) => r.file_name);
    return buildChapters(names, (name) => r2Url(subject, component, name));
  }

  const prefix = `${subject}/${component}`;
  const { data, error } = await supabase.storage.from(PAPERS_BUCKET).list(prefix, {
    limit: 1000,
    sortBy: { column: "name", order: "asc" },
  });
  if (error) throw error;
  const names = (data ?? []).filter((entry) => entry.id !== null).map((entry) => entry.name);
  return buildChapters(
    names,
    (name) => supabase.storage.from(PAPERS_BUCKET).getPublicUrl(`${prefix}/${name}`).data.publicUrl,
  );
}

// Component label "Paper 2" → 2 (matches the `P<n>-` prefix on question ids).
export function paperNumOf(component: string): number {
  const m = component.match(/(\d+)/);
  return m ? parseInt(m[1], 10) : 0;
}

// questions_metadata has no year column — it's embedded in `paper`, e.g. "June-2014-1".
function yearOfPaper(paperField: string): number {
  const parts = paperField.split("-");
  return parts.length === 3 ? Number(parts[1]) : NaN;
}

export interface ChapterQuestion {
  id: string;
  year: number;
}

// Every indexed question of a component, grouped by chapter and tagged with the
// year of the exam it came from. One request for the whole component rather
// than one per chapter.
//
// Goes through /api/chapter-questions rather than querying questions_metadata
// directly: that table used to be world-readable so this same function could
// hit PostgREST from the browser, but a bare anon SELECT on ~4000 rows of
// hand-built classification made the whole index dumpable in a few paged
// requests. The server holds the same paging logic now (fetchAllRows in
// server/supabase-rows.js) with a service-role key that bypasses RLS, so
// nothing here needs to page — the endpoint always returns the complete set.
export async function getChapterQuestions(
  subject: string,
  paperNum: number,
): Promise<Map<number, ChapterQuestion[]>> {
  const params = new URLSearchParams({ subject, paperNum: String(paperNum) });
  const res = await fetch(`/api/chapter-questions?${params}`);
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { error?: string } | null;
    throw new Error(body?.error || `Failed to load question index (${res.status})`);
  }
  const { rows } = (await res.json()) as {
    rows: { id: string; chapter_num: number; paper: string }[];
  };

  const byChapter = new Map<number, ChapterQuestion[]>();
  for (const row of rows) {
    const year = yearOfPaper(row.paper);
    if (!Number.isFinite(year)) continue;
    let questions = byChapter.get(row.chapter_num);
    if (!questions) byChapter.set(row.chapter_num, (questions = []));
    questions.push({ id: row.id, year });
  }
  return byChapter;
}

interface GeneratePaperOptions {
  includeMarkScheme?: boolean;
  randomize?: boolean;
  // What the browser should save the PDF as. Only reaches the user when the paper
  // is too big to come back inline and is served from R2 instead.
  fileName?: string;
}

// How many questions one generated paper may hold. Kept in step with
// MAX_QUESTIONS in server/compose-handler.js, which is the limit that actually
// enforces it — this copy only exists so the page can head the user off before
// spending a minute on a request that will be refused.
export const MAX_GENERATED_QUESTIONS = 400;

// A composed paper comes back inline when it fits in a serverless response body,
// and as an R2 URL when it doesn't (see server/compose-handler.js). Papers of a
// dozen chapters routinely land on the second path. `key` is the R2 object key
// behind that URL — the public R2 URL has no CORS headers, so a caller that
// needs the bytes back (rather than just handing the URL to an anchor click)
// has to go through /api/proxy-paper?key=... instead of fetching `url` directly.
export type GeneratedPaper =
  | { kind: "blob"; blob: Blob }
  | { kind: "url"; url: string; key: string };

// Reads a composed paper's bytes back out by its R2 key, for a caller that
// needs the bytes themselves rather than just an anchor-click download (see
// the comment above). Also the re-download path for a saved paper's `r2Key`
// (@/lib/savedPapers) — that `_cache/` object can be pruned, so callers should
// fall back to `generatePaper` with the paper's recipe if this 404s.
export async function fetchPaperBytes(key: string): Promise<Blob> {
  const response = await fetch(`/api/proxy-paper?key=${encodeURIComponent(key)}`);
  if (!response.ok) throw new Error(`Could not fetch the paper (${response.status})`);
  return response.blob();
}

// The paper arrives inline as a blob when it is small enough for a serverless
// response body, and as an R2 URL when it isn't. Either way it is one anchor
// click: the R2 object is stored with an attachment disposition, so the browser
// saves it rather than navigating away from the app.
export function downloadPaper(paper: GeneratedPaper, fileName: string): void {
  const href = paper.kind === "blob" ? URL.createObjectURL(paper.blob) : paper.url;
  const link = document.createElement("a");
  link.href = href;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  if (paper.kind === "blob") URL.revokeObjectURL(href);
}

// Roughly how long composing a paper takes, in seconds, as a function of the
// question count — used only to drive the progress estimate the user sees while
// waiting. Now that composition always reads source PDFs from R2 over HTTP, the
// wall-clock time is dominated by fetching each *distinct exam PDF* the selection
// touches, not by the raw question count. Measured against the live bucket:
//
//     N (questions):   1    5   10   20   40   80  120
//     distinct papers: 1    5    9   16   31   56   67
//     seconds:         3.2  6.5 10.5 23.6 48.8 91.2 95.3
//
// Up to ~80 questions each one tends to pull in a new paper, so time rises almost
// linearly at ~1.15 s/question; beyond that, questions increasingly reuse papers
// already fetched (and edge-cached), so the curve flattens — 120 questions took
// 95s, not the ~140s a straight line predicts. A single linear fit `≈ 2 + 1.15·N`
// tracks the representative 1–80 range well and stays conservative past it, which
// is what a progress estimate wants: better to finish early than overrun. It is
// an estimate, not a guarantee — a cold cache or a selection spread across more
// papers runs slower.
export function estimateGenerationSeconds(questionCount: number): number {
  return Math.round(2 + 1.15 * Math.max(0, questionCount));
}

export async function generatePaper(
  subject: string,
  questionIds: string[],
  options: GeneratePaperOptions = {}
): Promise<GeneratedPaper> {
  const response = await fetch("/api/compose-paper", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      subject,
      selections: Object.fromEntries(questionIds.map((id) => [id, true])),
      includeMarkScheme: options.includeMarkScheme ?? true,
      randomize: options.randomize ?? false,
      fileName: options.fileName,
    }),
  });

  if (!response.ok) {
    let errorMessage = `Server error (${response.status})`;
    try {
      const error = await response.json();
      errorMessage = error.error || errorMessage;
    } catch {
      const text = await response.text().catch(() => "");
      if (text) errorMessage = text.slice(0, 200);
    }
    throw new Error(errorMessage);
  }

  const text = await response.text();
  if (!text) throw new Error("Empty response from server");

  const { pdfBase64, url, key } = JSON.parse(text);
  if (url) return { kind: "url", url: url as string, key: key as string };
  if (!pdfBase64) throw new Error("No PDF data in response");
  const binaryString = atob(pdfBase64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return { kind: "blob", blob: new Blob([bytes], { type: "application/pdf" }) };
}
