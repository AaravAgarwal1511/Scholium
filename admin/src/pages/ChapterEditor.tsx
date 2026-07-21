import { useEffect, useState } from "react";
import { supabase } from "../supabase";
import { parseCards, serializeCards } from "../lib/parse";

type Chapter = {
  id: string;
  subject_id: string;
  subject_name: string;
  subject_emoji: string;
  section_id: string;
  section_name: string;
  name: string;
  sort_order: number;
};

type Defaults = {
  subject_id: string;
  subject_name: string;
  subject_emoji: string;
  section_id: string;
  section_name: string;
};

export default function ChapterEditor({
  chapterId,
  existing,
  defaults,
  allChapters,
  onBack,
}: {
  chapterId: string;
  existing: Chapter | null;
  defaults?: Defaults;
  allChapters: Chapter[];
  onBack: () => void;
}) {
  const isNew = chapterId.startsWith("new:");

  const ctx = existing
    ? {
        subject_id: existing.subject_id,
        subject_name: existing.subject_name,
        subject_emoji: existing.subject_emoji,
        section_id: existing.section_id,
        section_name: existing.section_name,
      }
    : defaults;

  const [name, setName] = useState(existing?.name ?? "");
  const [cardsText, setCardsText] = useState("");
  const [loadingCards, setLoadingCards] = useState(!isNew);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  useEffect(() => {
    if (isNew) return;
    supabase
      .from("recall_cards")
      .select("term, definition, sort_order")
      .eq("chapter_id", chapterId)
      .order("sort_order", { ascending: true })
      .then(({ data, error }) => {
        if (error) setErr(error.message);
        else setCardsText(serializeCards(data ?? []));
        setLoadingCards(false);
      });
  }, [chapterId, isNew]);

  const parsed = parseCards(cardsText);

  async function save() {
    setErr("");
    if (!ctx) return setErr("Missing subject/section context");
    if (!name.trim()) return setErr("Chapter name is required");
    if (parsed.length === 0) return setErr("Add at least one term");

    const id = existing?.id ?? makeUniqueId(ctx.subject_id, name.trim(), allChapters);
    const sortOrder =
      existing?.sort_order ?? nextSortOrder(ctx.section_id, allChapters);

    setBusy(true);
    const { error } = await supabase.rpc("admin_save_chapter", {
      p_cards: parsed,
      p_id: id,
      p_name: name.trim(),
      p_section_id: ctx.section_id,
      p_section_name: ctx.section_name,
      p_sort_order: sortOrder,
      p_subject_emoji: ctx.subject_emoji,
      p_subject_id: ctx.subject_id,
      p_subject_name: ctx.subject_name,
    });
    setBusy(false);
    if (error) setErr(error.message);
    else onBack();
  }

  async function del() {
    if (isNew || !existing) return;
    if (!confirm(`Delete "${existing.name}" and all its cards?`)) return;
    setBusy(true);
    const { error } = await supabase.rpc("admin_delete_chapter", {
      p_id: existing.id,
    });
    setBusy(false);
    if (error) setErr(error.message);
    else onBack();
  }

  return (
    <div className="max-w-4xl mx-auto p-8">
      <button
        onClick={onBack}
        className="text-sm text-slate-600 hover:text-slate-900 mb-4"
      >
        ← Back
      </button>

      {ctx && (
        <div className="text-sm text-slate-500 mb-2">
          {ctx.subject_emoji} {ctx.subject_name} · {ctx.section_name}
        </div>
      )}
      <h1 className="text-2xl font-bold mb-6">
        {isNew ? "New chapter" : existing?.name}
      </h1>

      <div className="bg-white rounded-xl shadow p-6 flex flex-col gap-4 mb-6">
        <label className="flex flex-col gap-1">
          <span className="text-xs font-semibold text-slate-600 uppercase tracking-wide">
            Chapter name
          </span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="border rounded-lg px-3 py-2 w-full"
            autoFocus={isNew}
          />
        </label>
      </div>

      <div className="bg-white rounded-xl shadow p-6 flex flex-col gap-3">
        <div className="flex items-baseline justify-between">
          <div>
            <h2 className="font-semibold">Cards</h2>
            <p className="text-xs text-slate-500">
              One per line. Format: <code>Term : Definition</code> (also
              accepts <code>-</code> or <code>=</code>). Use <code>\-</code> for
              a literal hyphen inside a term or definition.
            </p>
          </div>
          <div className="text-sm text-slate-500">
            {parsed.length} detected
          </div>
        </div>
        {loadingCards ? (
          <div className="text-slate-500 text-sm">Loading cards…</div>
        ) : (
          <textarea
            value={cardsText}
            onChange={(e) => setCardsText(e.target.value)}
            className="border rounded-lg px-3 py-2 w-full font-mono text-sm min-h-[320px]"
            placeholder={"Scarcity : The fundamental economic problem…\nOpportunity Cost : The value of the next best alternative…"}
          />
        )}
      </div>

      {err && (
        <div className="mt-4 text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-2 text-sm">
          {err}
        </div>
      )}

      <div className="mt-6 flex items-center justify-between">
        <button
          onClick={del}
          disabled={isNew || busy}
          className="text-red-600 text-sm hover:underline disabled:opacity-40 disabled:no-underline"
        >
          Delete chapter
        </button>
        <div className="flex gap-2">
          <button
            onClick={onBack}
            className="px-4 py-2 rounded-lg border border-slate-300 text-sm font-semibold hover:bg-slate-50"
          >
            Cancel
          </button>
          <button
            onClick={save}
            disabled={busy}
            className="px-4 py-2 rounded-lg bg-slate-900 text-white text-sm font-semibold disabled:opacity-50"
          >
            {busy ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}

function slugify(s: string) {
  return s
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function makeUniqueId(subjectId: string, name: string, all: Chapter[]) {
  const base = `${subjectId}-${slugify(name)}`;
  const taken = new Set(all.map((c) => c.id));
  if (!taken.has(base)) return base;
  let i = 2;
  while (taken.has(`${base}-${i}`)) i++;
  return `${base}-${i}`;
}

function nextSortOrder(sectionId: string, all: Chapter[]) {
  const inSection = all.filter((c) => c.section_id === sectionId);
  if (inSection.length === 0) return 0;
  return Math.max(...inSection.map((c) => c.sort_order)) + 1;
}
