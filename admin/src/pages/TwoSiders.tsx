import { useEffect, useState } from "react";
import { supabase } from "../supabase";
import TwoSiderEditor, { type TwoSiderRow } from "./TwoSiderEditor";

type Counts = Record<string, { for: number; against: number }>;

export default function TwoSiders() {
  const [list, setList] = useState<TwoSiderRow[]>([]);
  const [counts, setCounts] = useState<Counts>({});
  const [openId, setOpenId] = useState<string | null>(null);
  const [err, setErr] = useState("");

  async function load() {
    const [sidersRes, pointsRes] = await Promise.all([
      supabase
        .from("recall_two_siders")
        .select("id, subject, emoji, question, for_label, against_label, available, sort_order")
        .order("sort_order", { ascending: true }),
      supabase.from("recall_two_sider_points").select("two_sider_id, side"),
    ]);
    if (sidersRes.error) return setErr(sidersRes.error.message);
    setList((sidersRes.data as TwoSiderRow[]) ?? []);
    const c: Counts = {};
    for (const p of (pointsRes.data ?? []) as { two_sider_id: string; side: string }[]) {
      const bucket = (c[p.two_sider_id] ??= { for: 0, against: 0 });
      if (p.side === "against") bucket.against += 1;
      else bucket.for += 1;
    }
    setCounts(c);
  }

  useEffect(() => { load(); }, []);

  async function toggleAvailable(row: TwoSiderRow) {
    const next = !row.available;
    setList((prev) => prev.map((r) => (r.id === row.id ? { ...r, available: next } : r)));
    const { error } = await supabase.rpc("admin_set_two_sider_available", {
      p_id: row.id,
      p_available: next,
    });
    if (error) {
      setList((prev) => prev.map((r) => (r.id === row.id ? { ...r, available: !next } : r)));
      setErr(error.message);
    }
  }

  async function swap(a: TwoSiderRow, b: TwoSiderRow) {
    setList((prev) =>
      prev
        .map((r) =>
          r.id === a.id ? { ...r, sort_order: b.sort_order }
          : r.id === b.id ? { ...r, sort_order: a.sort_order }
          : r,
        )
        .sort((x, y) => x.sort_order - y.sort_order),
    );
    await supabase.rpc("admin_swap_two_sider_order", { p_id_a: a.id, p_id_b: b.id });
  }

  if (openId) {
    const existing = list.find((r) => r.id === openId) ?? null;
    const nextSortOrder = list.reduce((m, r) => Math.max(m, r.sort_order), 0) + 1;
    return (
      <TwoSiderEditor
        twoSiderId={openId}
        existing={existing}
        existingIds={new Set(list.map((r) => r.id))}
        nextSortOrder={nextSortOrder}
        onBack={() => { setOpenId(null); load(); }}
      />
    );
  }

  if (err) return <div className="p-10 text-red-600">{err}</div>;

  return (
    <div className="max-w-4xl mx-auto p-8">
      <div className="flex items-baseline justify-between mb-4">
        <h1 className="text-2xl font-bold">Essay Two-Siders</h1>
        <span className="text-sm text-slate-500">{list.length} essay{list.length === 1 ? "" : "s"}</span>
      </div>
      <p className="text-sm text-slate-500 mb-6">
        Each essay is argued on two sides. Toggle availability to publish or hide it in RecallApp; the points are edited inside.
      </p>

      <div className="flex flex-col gap-2">
        {list.map((row, i) => {
          const c = counts[row.id] ?? { for: 0, against: 0 };
          return (
            <div
              key={row.id}
              className={
                "rounded-xl shadow hover:shadow-md transition-shadow flex items-stretch overflow-hidden " +
                (row.available ? "bg-white" : "bg-slate-100 opacity-60")
              }
            >
              <div className="flex flex-col justify-center gap-0.5 px-2 border-r border-slate-100 flex-shrink-0">
                <button
                  onClick={() => i > 0 && swap(row, list[i - 1])}
                  disabled={i === 0}
                  className="text-slate-400 hover:text-slate-700 disabled:opacity-20 leading-none px-1"
                  aria-label="Move up"
                >▲</button>
                <button
                  onClick={() => i < list.length - 1 && swap(row, list[i + 1])}
                  disabled={i === list.length - 1}
                  className="text-slate-400 hover:text-slate-700 disabled:opacity-20 leading-none px-1"
                  aria-label="Move down"
                >▼</button>
              </div>
              <button onClick={() => setOpenId(row.id)} className="flex-1 p-4 text-left min-w-0">
                <div className="font-semibold truncate">
                  {row.emoji} {row.question}
                </div>
                <div className="text-xs text-slate-500 mt-1">
                  {row.subject} · {c.for} + {c.against} points
                  {!row.available && <span className="text-amber-600 font-medium"> · Hidden</span>}
                </div>
              </button>
              <div className="flex items-center gap-2 pr-3 flex-shrink-0">
                <AvailToggle available={row.available} onToggle={() => toggleAvailable(row)} />
                <span className="text-slate-400 text-sm">Edit →</span>
              </div>
            </div>
          );
        })}
        <button
          onClick={() => setOpenId(`new:${crypto.randomUUID()}`)}
          className="rounded-xl border-2 border-dashed border-slate-300 text-slate-500 py-5 hover:border-slate-400 hover:text-slate-700"
        >
          + New essay
        </button>
      </div>
    </div>
  );
}

function AvailToggle({ available, onToggle }: { available: boolean; onToggle: () => void }) {
  return (
    <button
      onClick={(e) => { e.stopPropagation(); onToggle(); }}
      title={available ? "Available — click to hide" : "Hidden — click to publish"}
      className={
        "w-8 h-5 rounded-full transition-colors flex-shrink-0 " +
        (available ? "bg-emerald-500" : "bg-slate-300")
      }
    >
      <span
        className={
          "block w-3.5 h-3.5 bg-white rounded-full shadow transition-transform mx-0.5 " +
          (available ? "translate-x-3" : "translate-x-0")
        }
      />
    </button>
  );
}
