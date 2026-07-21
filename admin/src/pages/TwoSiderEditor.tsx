import { useEffect, useState } from "react";
import { supabase } from "../supabase";
import { parseCards, serializeCards } from "../lib/parse";

export type TwoSiderRow = {
  id: string;
  subject: string;
  emoji: string;
  question: string;
  for_label: string;
  against_label: string;
  available: boolean;
  sort_order: number;
};

// One point per line, "Keyword : Full point" — same parser as the card editor.
// The keyword's initial is the mnemonic letter, so the mnemonic previews live
// as you type. term → keyword, definition → point.
function toPoints(text: string) {
  return parseCards(text).map((c) => ({ keyword: c.term, point: c.definition }));
}
function mnemonic(text: string) {
  return toPoints(text)
    .map((p) => (p.keyword.trim()[0] ?? "").toUpperCase())
    .join("");
}

export default function TwoSiderEditor({
  twoSiderId,
  existing,
  existingIds,
  nextSortOrder,
  onBack,
}: {
  twoSiderId: string;
  existing: TwoSiderRow | null;
  existingIds: Set<string>;
  nextSortOrder: number;
  onBack: () => void;
}) {
  const isNew = twoSiderId.startsWith("new:");

  const [question, setQuestion] = useState(existing?.question ?? "");
  const [subject, setSubject] = useState(existing?.subject ?? "Economics");
  const [emoji, setEmoji] = useState(existing?.emoji ?? "📈");
  const [forLabel, setForLabel] = useState(existing?.for_label ?? "For");
  const [againstLabel, setAgainstLabel] = useState(existing?.against_label ?? "Against");
  const [forText, setForText] = useState("");
  const [againstText, setAgainstText] = useState("");
  const [loadingPoints, setLoadingPoints] = useState(!isNew);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  useEffect(() => {
    if (isNew || !existing) return;
    supabase
      .from("recall_two_sider_points")
      .select("side, keyword, point, sort_order")
      .eq("two_sider_id", existing.id)
      .order("sort_order", { ascending: true })
      .then(({ data, error }) => {
        if (error) setErr(error.message);
        else {
          const rows = data ?? [];
          const ser = (side: string) =>
            serializeCards(
              rows
                .filter((r) => r.side === side)
                .map((r) => ({ term: r.keyword, definition: r.point })),
            );
          setForText(ser("for"));
          setAgainstText(ser("against"));
        }
        setLoadingPoints(false);
      });
  }, [existing, isNew]);

  const forPts = toPoints(forText);
  const againstPts = toPoints(againstText);

  async function save() {
    setErr("");
    if (!question.trim()) return setErr("Question is required");
    if (!subject.trim()) return setErr("Subject is required");
    if (forPts.length === 0 || againstPts.length === 0)
      return setErr("Add at least one point to each side");

    const id = existing?.id ?? makeId(question.trim(), existingIds);
    const sortOrder = existing?.sort_order ?? nextSortOrder;

    setBusy(true);
    const { error } = await supabase.rpc("admin_save_two_sider", {
      p_id: id,
      p_subject: subject.trim(),
      p_emoji: emoji.trim() || "📝",
      p_question: question.trim(),
      p_for_label: forLabel.trim() || "For",
      p_against_label: againstLabel.trim() || "Against",
      p_sort_order: sortOrder,
      p_for: forPts,
      p_against: againstPts,
    });
    setBusy(false);
    if (error) setErr(error.message);
    else onBack();
  }

  async function del() {
    if (isNew || !existing) return;
    if (!confirm(`Delete "${existing.question}" and all its points?`)) return;
    setBusy(true);
    const { error } = await supabase.rpc("admin_delete_two_sider", { p_id: existing.id });
    setBusy(false);
    if (error) setErr(error.message);
    else onBack();
  }

  return (
    <div className="max-w-4xl mx-auto p-8">
      <button onClick={onBack} className="text-sm text-slate-600 hover:text-slate-900 mb-4">
        ← Back
      </button>
      <h1 className="text-2xl font-bold mb-6">{isNew ? "New essay" : "Edit essay"}</h1>

      {/* essay metadata */}
      <div className="bg-white rounded-xl shadow p-6 flex flex-col gap-4 mb-6">
        <label className="flex flex-col gap-1">
          <span className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Question</span>
          <textarea
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            className="border rounded-lg px-3 py-2 w-full min-h-[64px]"
            placeholder="Evaluate the case for and against…"
            autoFocus={isNew}
          />
        </label>
        <div className="grid grid-cols-3 gap-3">
          <label className="flex flex-col gap-1">
            <span className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Emoji</span>
            <input value={emoji} onChange={(e) => setEmoji(e.target.value)} className="border rounded-lg px-2 py-2 text-center" />
          </label>
          <label className="flex flex-col gap-1 col-span-2">
            <span className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Subject</span>
            <input value={subject} onChange={(e) => setSubject(e.target.value)} className="border rounded-lg px-3 py-2" />
          </label>
        </div>
      </div>

      {/* the two sides */}
      {loadingPoints ? (
        <div className="text-slate-500 text-sm">Loading points…</div>
      ) : (
        <div className="grid md:grid-cols-2 gap-4">
          <SidePanel
            heading="Side 1 (For)"
            label={forLabel}
            onLabel={setForLabel}
            text={forText}
            onText={setForText}
            mnemonic={mnemonic(forText)}
            count={forPts.length}
          />
          <SidePanel
            heading="Side 2 (Against)"
            label={againstLabel}
            onLabel={setAgainstLabel}
            text={againstText}
            onText={setAgainstText}
            mnemonic={mnemonic(againstText)}
            count={againstPts.length}
          />
        </div>
      )}

      {err && (
        <div className="mt-4 text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-2 text-sm">{err}</div>
      )}

      <div className="mt-6 flex items-center justify-between">
        <button
          onClick={del}
          disabled={isNew || busy}
          className="text-red-600 text-sm hover:underline disabled:opacity-40 disabled:no-underline"
        >
          Delete essay
        </button>
        <div className="flex gap-2">
          <button onClick={onBack} className="px-4 py-2 rounded-lg border border-slate-300 text-sm font-semibold hover:bg-slate-50">
            Cancel
          </button>
          <button onClick={save} disabled={busy} className="px-4 py-2 rounded-lg bg-slate-900 text-white text-sm font-semibold disabled:opacity-50">
            {busy ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}

function SidePanel({
  heading,
  label,
  onLabel,
  text,
  onText,
  mnemonic,
  count,
}: {
  heading: string;
  label: string;
  onLabel: (v: string) => void;
  text: string;
  onText: (v: string) => void;
  mnemonic: string;
  count: number;
}) {
  return (
    <div className="bg-white rounded-xl shadow p-5 flex flex-col gap-3">
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-xs font-semibold text-slate-600 uppercase tracking-wide">{heading}</span>
        <span className="font-mono font-bold tracking-[0.15em] text-indigo-600 text-sm">
          {mnemonic || "—"}
        </span>
      </div>
      <input
        value={label}
        onChange={(e) => onLabel(e.target.value)}
        className="border rounded-lg px-3 py-1.5 text-sm"
        placeholder="Side label, e.g. FOR tariffs"
      />
      <textarea
        value={text}
        onChange={(e) => onText(e.target.value)}
        className="border rounded-lg px-3 py-2 w-full font-mono text-sm min-h-[220px]"
        placeholder={"Dumping : Shields domestic firms from goods sold below cost.\nRevenue : Tariffs raise government revenue."}
      />
      <div className="text-xs text-slate-500">
        {count} point{count === 1 ? "" : "s"} · one per line, <code>Keyword : Point</code>. The keyword initials form the mnemonic above.
      </div>
    </div>
  );
}

function slugify(s: string) {
  return s.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

function makeId(question: string, taken: Set<string>) {
  const base = slugify(question).split("-").slice(0, 6).join("-") || "essay";
  if (!taken.has(base)) return base;
  let i = 2;
  while (taken.has(`${base}-${i}`)) i++;
  return `${base}-${i}`;
}
