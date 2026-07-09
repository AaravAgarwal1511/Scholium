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
  "0606": "Additional Mathematics",
  "0607": "International Mathematics",
};

export function subjectDisplayName(code: string): string {
  return SUBJECT_DISPLAY_NAMES[code] ?? code;
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

// The browser only ever needs the id — /api/compose-paper re-fetches everything
// else server-side, and the crop geometry lives in the R2 index files.
export interface Question {
  id: string;
}

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
  if (USE_R2) return distinctColumn("subject");
  return listFolders("");
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

// PostgREST caps every response at 1000 rows and reports no error — a truncated
// result looks exactly like a complete one. `questions_metadata` holds ~4000
// rows, so page through it rather than trusting a bare select().
const PAGE_SIZE = 1000;

interface PageResult<T> {
  data: T[] | null;
  error: { message: string } | null;
}

// `page(from, to)` must apply `.range(from, to)` to an ordered query.
async function fetchAllRows<T>(
  page: (from: number, to: number) => PromiseLike<PageResult<T>>,
): Promise<T[]> {
  const rows: T[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await page(from, from + PAGE_SIZE - 1);
    if (error) throw new Error(error.message);
    const batch = data ?? [];
    rows.push(...batch);
    if (batch.length < PAGE_SIZE) break;
  }
  return rows;
}

// Which exam years each chapter of a component actually has questions for, so a
// chapter card can offer exactly those years and recognise when the user has
// asked for the full range (which the prebuilt topical PDF already covers).
//
// One query for the whole component rather than one per chapter — hence the
// paging: a truncated result would silently understate a chapter's latest year.
export async function getChapterYears(
  subject: string,
  paperNum: number,
): Promise<Map<number, number[]>> {
  const rows = await fetchAllRows<{ chapter_num: number; paper: string }>((from, to) =>
    supabase
      .from("questions_metadata")
      .select("chapter_num, paper")
      .eq("subject", subject)
      .like("id", `P${paperNum}-%`)
      .order("id")
      .range(from, to),
  );

  const byChapter = new Map<number, Set<number>>();
  for (const row of rows) {
    const year = yearOfPaper(row.paper);
    if (!Number.isFinite(year)) continue;
    let years = byChapter.get(row.chapter_num);
    if (!years) byChapter.set(row.chapter_num, (years = new Set()));
    years.add(year);
  }

  return new Map(
    Array.from(byChapter, ([chapter, years]) => [chapter, Array.from(years).sort((a, b) => a - b)]),
  );
}

export type PaperOrder = "oldest" | "newest";

export interface ChapterPaperRequest {
  subject: string;
  paperNum: number;
  chapter: number;
  yearFrom: number;
  yearTo: number;
  order: PaperOrder;
  kind: "qp" | "ms";
}

// Compose one chapter over a year range / ordering the prebuilt PDFs don't cover.
// The server caches the result in R2 and hands back a public URL — a whole chapter
// is far too large to return inline.
export async function requestChapterPaper(req: ChapterPaperRequest): Promise<string> {
  const response = await fetch("/api/chapter-paper", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(req),
  });

  if (!response.ok) {
    let message = `Server error (${response.status})`;
    try {
      const body = await response.json();
      message = body.error || message;
    } catch {
      const text = await response.text().catch(() => "");
      if (text) message = text.slice(0, 200);
    }
    throw new Error(message);
  }

  const { url } = await response.json();
  if (!url) throw new Error("No PDF URL in response");
  return url as string;
}

// Questions for one chapter of one subject + paper. The paper is matched on the
// `P<n>-` id prefix (e.g. paperNum 2 → ids like "P2-Q001"), so generation stays
// restricted to the selected component.
export async function getQuestionsByChapter(
  subject: string,
  paperNum: number,
  chapter: number,
): Promise<Question[]> {
  return fetchAllRows<Question>((from, to) =>
    supabase
      .from("questions_metadata")
      .select("id")
      .eq("subject", subject)
      .eq("chapter_num", chapter)
      .like("id", `P${paperNum}-%`)
      .order("id")
      .range(from, to),
  );
}

interface GeneratePaperOptions {
  includeMarkScheme?: boolean;
  randomize?: boolean;
}

export async function generatePaper(
  subject: string,
  questionIds: string[],
  options: GeneratePaperOptions = {}
): Promise<Blob> {
  const response = await fetch("/api/compose-paper", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      subject,
      selections: Object.fromEntries(questionIds.map((id) => [id, true])),
      includeMarkScheme: options.includeMarkScheme ?? true,
      randomize: options.randomize ?? false,
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

  const { pdfBase64 } = JSON.parse(text);
  if (!pdfBase64) throw new Error("No PDF data in response");
  const binaryString = atob(pdfBase64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return new Blob([bytes], { type: "application/pdf" });
}
