import { useEffect, useMemo, useState } from "react";
import { supabase } from "../supabase";

// Reads/triages public.feedback through the admin-gated RPCs in
// database/migrations/20261122000000_feedback.sql. The table itself is closed to
// every client role, so these RPCs are the only way in.

type Status = "new" | "triaged" | "done";

type FeedbackRow = {
  id: number;
  created_at: string;
  user_email: string | null;
  app_key: string;
  source: "form" | "prompt" | "error";
  category: "bug" | "idea" | "other";
  rating: number | null;
  message: string | null;
  path: string | null;
  app_version: string | null;
  user_agent: string | null;
  status: Status;
};

const APPS = ["recall-app", "language-hub", "poetry-notes", "past-papers", "mock-space", "scholium-home"];
const CATEGORIES = ["bug", "idea", "other"] as const;
const STATUSES: Status[] = ["new", "triaged", "done"];
const DAY_OPTIONS = [7, 30, 90, 365];

const CATEGORY_STYLE: Record<FeedbackRow["category"], string> = {
  bug: "bg-red-50 text-red-700",
  idea: "bg-indigo-50 text-indigo-700",
  other: "bg-slate-100 text-slate-700",
};

export default function Feedback() {
  const [days, setDays] = useState(30);
  const [app, setApp] = useState<string>("");
  const [category, setCategory] = useState<string>("");
  const [status, setStatus] = useState<string>("new");
  const [rows, setRows] = useState<FeedbackRow[] | null>(null);
  const [err, setErr] = useState("");

  useEffect(() => {
    let cancelled = false;
    setErr("");
    setRows(null);
    supabase
      .rpc("admin_list_feedback", {
        p_app_key: app || null,
        p_category: category || null,
        p_status: status || null,
        p_days: days,
        p_limit: 500,
      })
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) return setErr(error.message);
        setRows((data as FeedbackRow[]) ?? []);
      });
    return () => {
      cancelled = true;
    };
  }, [days, app, category, status]);

  const summary = useMemo(() => {
    if (!rows) return null;
    const rated = rows.filter((r) => r.rating != null);
    const avg = rated.length ? rated.reduce((a, r) => a + (r.rating ?? 0), 0) / rated.length : null;
    return {
      total: rows.length,
      bugs: rows.filter((r) => r.category === "bug").length,
      avg,
      rated: rated.length,
    };
  }, [rows]);

  async function updateStatus(id: number, next: Status) {
    const prev = rows;
    setRows((rs) => rs?.map((r) => (r.id === id ? { ...r, status: next } : r)) ?? null);
    const { error } = await supabase.rpc("admin_update_feedback_status", { p_id: id, p_status: next });
    if (error) {
      setRows(prev);
      setErr(error.message);
    }
  }

  if (err) return <div className="p-10 text-red-600">{err}</div>;

  return (
    <div className="max-w-6xl mx-auto p-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Feedback</h1>
        <div className="flex items-center gap-1">
          {DAY_OPTIONS.map((d) => (
            <button
              key={d}
              onClick={() => setDays(d)}
              className={
                "px-3 py-1.5 rounded-lg text-sm font-semibold transition-colors " +
                (days === d ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-100")
              }
            >
              {d}d
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap gap-3 mb-6">
        <Select label="App" value={app} onChange={setApp} options={APPS} />
        <Select label="Category" value={category} onChange={setCategory} options={[...CATEGORIES]} />
        <Select label="Status" value={status} onChange={setStatus} options={STATUSES} />
      </div>

      {summary && (
        <div className="grid grid-cols-3 gap-4 mb-6">
          <Stat label="Submissions" value={String(summary.total)} />
          <Stat label="Bugs" value={String(summary.bugs)} />
          <Stat
            label={`Avg rating (${summary.rated} rated)`}
            value={summary.avg == null ? "—" : `${summary.avg.toFixed(1)} / 5`}
          />
        </div>
      )}

      {!rows ? (
        <div className="text-slate-500">Loading feedback…</div>
      ) : rows.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white p-8 text-slate-500">
          Nothing matches these filters.
        </div>
      ) : (
        <ul className="space-y-3">
          {rows.map((r) => (
            <li key={r.id} className="bg-white rounded-xl shadow p-4">
              <div className="flex flex-wrap items-center gap-2 text-xs mb-2">
                <span className={"px-2 py-0.5 rounded-full font-semibold " + CATEGORY_STYLE[r.category]}>
                  {r.category}
                </span>
                <span className="font-mono text-slate-600">{r.app_key}</span>
                {r.rating != null && (
                  <span className="text-amber-500" aria-label={`${r.rating} out of 5`}>
                    {"★".repeat(r.rating)}
                    <span className="text-slate-300">{"★".repeat(5 - r.rating)}</span>
                  </span>
                )}
                <span className="text-slate-400">via {r.source}</span>
                <span className="text-slate-400 ml-auto">
                  {new Date(r.created_at).toLocaleString()}
                </span>
              </div>
              <p className="text-sm text-slate-800 whitespace-pre-wrap break-words">
                {r.message ?? <span className="italic text-slate-400">Rating only — no message.</span>}
              </p>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-3 text-xs text-slate-500">
                <span>{r.user_email ?? "signed out"}</span>
                {r.path && <span className="font-mono">{r.path}</span>}
                {r.user_agent && (
                  <span className="truncate max-w-md" title={r.user_agent}>
                    {r.user_agent}
                  </span>
                )}
                <div className="ml-auto flex gap-1">
                  {STATUSES.map((s) => (
                    <button
                      key={s}
                      onClick={() => updateStatus(r.id, s)}
                      disabled={r.status === s}
                      className={
                        "px-2 py-1 rounded-md font-semibold " +
                        (r.status === s ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-100")
                      }
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Select({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: readonly string[];
}) {
  return (
    <label className="text-sm text-slate-600 flex items-center gap-2">
      {label}
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="border border-slate-200 rounded-lg px-2 py-1.5 bg-white text-slate-900"
      >
        <option value="">All</option>
        {options.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
    </label>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-white rounded-xl shadow p-4">
      <div className="text-xs text-slate-500">{label}</div>
      <div className="text-2xl font-bold mt-1">{value}</div>
    </div>
  );
}
