import { useEffect, useState } from "react";
import { supabase } from "../supabase";

type SummaryRow = {
  events: number;
  visitors: number;
  papers_generated: number;
  papers_failed: number;
  first_event: string | null;
  last_event: string | null;
};

type MonthRow = {
  month: string; // first day of the month, YYYY-MM-DD
  events: number;
  visitors: number;
  papers_generated: number;
};

// Same keys as active_sessions / analytics_events.app_key.
const APP_KEYS = [
  "past-papers",
  "scholium-home",
  "language-hub",
  "recall-app",
  "mock-space",
  "poetry-notes",
];

// All dates are UTC calendar days, matching the RPCs. An empty string means
// unbounded on that side.
function todayUtc() {
  return new Date().toISOString().slice(0, 10);
}

function monthBounds(offset: number): [string, string] {
  const now = new Date();
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + offset, 1));
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + offset + 1, 0));
  return [start.toISOString().slice(0, 10), end.toISOString().slice(0, 10)];
}

function monthLabel(month: string) {
  return new Date(`${month}T00:00:00Z`).toLocaleString("en-GB", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

function rangeLabel(from: string, to: string) {
  if (!from && !to) return "all time";
  return `${from || "start"} → ${to || "today"}`;
}

const PRESETS: { label: string; range: () => [string, string] }[] = [
  { label: "All time", range: () => ["", ""] },
  { label: "This month", range: () => monthBounds(0) },
  { label: "Last month", range: () => monthBounds(-1) },
  {
    label: "Last 90 days",
    range: () => {
      const d = new Date();
      d.setUTCDate(d.getUTCDate() - 89);
      return [d.toISOString().slice(0, 10), todayUtc()];
    },
  },
];

export default function RangeTotals() {
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [appKey, setAppKey] = useState("");
  const [summary, setSummary] = useState<SummaryRow | null>(null);
  const [months, setMonths] = useState<MonthRow[] | null>(null);
  const [checkedAt, setCheckedAt] = useState<Date | null>(null);
  const [err, setErr] = useState("");
  const [copied, setCopied] = useState(false);

  const invalid = !!from && !!to && from > to;

  useEffect(() => {
    if (invalid) return;
    let cancelled = false;
    const args = { p_from: from || null, p_to: to || null, p_app_key: appKey || null };
    setErr("");
    setSummary(null);
    setMonths(null);
    Promise.all([
      supabase.rpc("admin_analytics_range_summary", args),
      supabase.rpc("admin_analytics_monthly", args),
    ]).then(([sm, mo]) => {
      if (cancelled) return;
      if (sm.error) return setErr(sm.error.message);
      if (mo.error) return setErr(mo.error.message);
      setSummary(((sm.data as SummaryRow[]) ?? [])[0] ?? null);
      setMonths((mo.data as MonthRow[]) ?? []);
      setCheckedAt(new Date());
    });
    return () => {
      cancelled = true;
    };
  }, [from, to, appKey, invalid]);

  const busiest =
    months && months.length > 0
      ? months.reduce((best, m) => (m.visitors > best.visitors ? m : best))
      : null;

  const scope = appKey || "all apps";

  const evidence =
    summary && checkedAt
      ? [
          `Scholium analytics, ${scope}, ${rangeLabel(from, to)} (UTC)`,
          `Papers generated: ${summary.papers_generated}`,
          `Unique visitors: ${summary.visitors}`,
          busiest
            ? `Busiest month: ${monthLabel(busiest.month)}, ${busiest.visitors} unique visitors`
            : null,
          summary.first_event
            ? `Data covers ${summary.first_event.slice(0, 10)} → ${summary.last_event?.slice(0, 10)}`
            : null,
          `Checked ${checkedAt.toISOString()}`,
        ]
          .filter(Boolean)
          .join("\n")
      : "";

  const copyEvidence = () => {
    navigator.clipboard.writeText(evidence).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };

  return (
    <section className="mb-10">
      <div className="flex items-end justify-between mb-2">
        <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide">
          Verified totals
        </h2>
        <button
          onClick={copyEvidence}
          disabled={!evidence}
          className="px-3 py-1.5 rounded-lg text-sm font-semibold text-slate-600 hover:bg-slate-100 disabled:opacity-40"
        >
          {copied ? "Copied" : "Copy as evidence"}
        </button>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-4 mb-4 flex flex-wrap items-end gap-4">
        <label className="text-xs font-semibold text-slate-500">
          From
          <input
            type="date"
            value={from}
            max={to || todayUtc()}
            onChange={(e) => setFrom(e.target.value)}
            className="mt-1 block rounded-lg border border-slate-300 px-2 py-1.5 text-sm text-slate-900"
          />
        </label>
        <label className="text-xs font-semibold text-slate-500">
          To
          <input
            type="date"
            value={to}
            min={from || undefined}
            max={todayUtc()}
            onChange={(e) => setTo(e.target.value)}
            className="mt-1 block rounded-lg border border-slate-300 px-2 py-1.5 text-sm text-slate-900"
          />
        </label>
        <label className="text-xs font-semibold text-slate-500">
          App
          <select
            value={appKey}
            onChange={(e) => setAppKey(e.target.value)}
            className="mt-1 block rounded-lg border border-slate-300 px-2 py-1.5 text-sm text-slate-900"
          >
            <option value="">All apps</option>
            {APP_KEYS.map((k) => (
              <option key={k} value={k}>
                {k}
              </option>
            ))}
          </select>
        </label>
        <div className="flex items-center gap-1">
          {PRESETS.map((p) => (
            <button
              key={p.label}
              onClick={() => {
                const [f, t] = p.range();
                setFrom(f);
                setTo(t);
              }}
              className="px-3 py-1.5 rounded-lg text-sm font-semibold text-slate-600 hover:bg-slate-100"
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {invalid ? (
        <div className="text-red-600 text-sm">"From" is after "To".</div>
      ) : err ? (
        <div className="text-red-600 text-sm">{err}</div>
      ) : !summary || !months ? (
        <div className="text-slate-500">Loading totals…</div>
      ) : (
        <>
          <div className="grid grid-cols-4 gap-4 mb-2">
            <Stat label="Papers generated" value={summary.papers_generated} />
            <Stat label={`Unique visitors (${scope})`} value={summary.visitors} />
            <Stat
              label={busiest ? `Busiest month · ${monthLabel(busiest.month)}` : "Busiest month"}
              value={busiest?.visitors ?? 0}
            />
            <Stat label="Events" value={summary.events} />
          </div>
          <p className="text-xs text-slate-400 mb-4">
            {from || to ? rangeLabel(from, to) : "All time"}, UTC. Papers = <code>generate_complete</code> events (
            {summary.papers_failed} failed generations not counted). A visitor is an account, or a
            device when signed out; device ids are per app, so "All apps" counts one signed-out
            person using two apps twice. Raw events are kept 180 days
            {summary.first_event
              ? `; this range has data from ${summary.first_event.slice(0, 10)}`
              : ""}
            .
          </p>

          <div className="bg-white rounded-xl shadow overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-slate-100 text-left text-slate-600">
                <tr>
                  <th className="px-4 py-2">Month</th>
                  <th className="px-4 py-2 text-right">Unique visitors</th>
                  <th className="px-4 py-2 text-right">Papers generated</th>
                  <th className="px-4 py-2 text-right">Events</th>
                </tr>
              </thead>
              <tbody>
                {months.length === 0 ? (
                  <tr>
                    <td className="px-4 py-3 text-slate-400" colSpan={4}>
                      No events in this range.
                    </td>
                  </tr>
                ) : (
                  months.map((m) => (
                    <tr
                      key={m.month}
                      className={"border-t " + (m === busiest ? "bg-amber-50 font-semibold" : "")}
                    >
                      <td className="px-4 py-2">{monthLabel(m.month)}</td>
                      <td className="px-4 py-2 text-right">{m.visitors}</td>
                      <td className="px-4 py-2 text-right">{m.papers_generated}</td>
                      <td className="px-4 py-2 text-right text-slate-500">{m.events}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-slate-400 mt-2">
            Visitors are distinct within each month, so the monthly rows don't add up to the range
            total. Months at the edge of a custom range only include the days inside it.
          </p>
        </>
      )}
    </section>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <div className="text-xs uppercase tracking-wide text-slate-500">{label}</div>
      <div className="mt-1 text-2xl font-bold tabular-nums">{value}</div>
    </div>
  );
}
