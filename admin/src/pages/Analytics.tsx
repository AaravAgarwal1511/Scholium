import { useEffect, useState } from "react";
import { supabase } from "../supabase";

type OverviewRow = {
  app_key: string;
  dau: number;
  wau: number;
  mau: number;
  events: number;
  sessions: number;
  signed_out_pct: number | null;
};

type EventRow = {
  event_name: string;
  events: number;
  visitors: number;
};

type DailyRow = {
  day: string;
  events: number;
  visitors: number;
  sessions: number;
  signed_out_events: number;
};

const DAY_OPTIONS = [7, 30, 90];

export default function Analytics() {
  const [days, setDays] = useState(30);
  const [overview, setOverview] = useState<OverviewRow[] | null>(null);
  const [events, setEvents] = useState<EventRow[] | null>(null);
  const [daily, setDaily] = useState<DailyRow[] | null>(null);
  const [err, setErr] = useState("");

  useEffect(() => {
    let cancelled = false;
    setErr("");
    setOverview(null);
    setEvents(null);
    setDaily(null);
    Promise.all([
      supabase.rpc("admin_analytics_overview", { p_days: days }),
      supabase.rpc("admin_analytics_events", { p_days: days, p_app_key: null }),
      supabase.rpc("admin_analytics_daily", { p_app_key: null, p_days: days }),
    ]).then(([ov, ev, dy]) => {
      if (cancelled) return;
      if (ov.error) return setErr(ov.error.message);
      if (ev.error) return setErr(ev.error.message);
      if (dy.error) return setErr(dy.error.message);
      setOverview((ov.data as OverviewRow[]) ?? []);
      setEvents((ev.data as EventRow[]) ?? []);
      setDaily((dy.data as DailyRow[]) ?? []);
    });
    return () => {
      cancelled = true;
    };
  }, [days]);

  if (err) return <div className="p-10 text-red-600">{err}</div>;

  const totals = overview
    ? overview.reduce(
        (a, r) => ({
          dau: a.dau + r.dau,
          wau: a.wau + r.wau,
          mau: a.mau + r.mau,
          events: a.events + r.events,
        }),
        { dau: 0, wau: 0, mau: 0, events: 0 },
      )
    : null;

  return (
    <div className="max-w-6xl mx-auto p-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Product Analytics</h1>
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

      {!overview || !events || !daily ? (
        <div className="text-slate-500">Loading analytics…</div>
      ) : overview.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white p-8 text-slate-500">
          No events yet. First-party analytics stays dormant until{" "}
          <code className="text-slate-700">VITE_ANALYTICS_ENABLED=true</code> is set in each app's
          Vercel environment.
        </div>
      ) : (
        <>
          {totals && (
            <div className="grid grid-cols-4 gap-4 mb-6">
              <Stat label="DAU (all apps)" value={totals.dau} />
              <Stat label="WAU (all apps)" value={totals.wau} />
              <Stat label="MAU (all apps)" value={totals.mau} />
              <Stat label={`Events (${days}d)`} value={totals.events} />
            </div>
          )}

          <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-2">
            Per app
          </h2>
          <div className="bg-white rounded-xl shadow overflow-hidden mb-8">
            <table className="w-full text-sm">
              <thead className="bg-slate-100 text-left text-slate-600">
                <tr>
                  <th className="px-4 py-2">App</th>
                  <th className="px-4 py-2 text-right">DAU</th>
                  <th className="px-4 py-2 text-right">WAU</th>
                  <th className="px-4 py-2 text-right">MAU</th>
                  <th className="px-4 py-2 text-right">Events ({days}d)</th>
                  <th className="px-4 py-2 text-right">Sessions ({days}d)</th>
                  <th className="px-4 py-2 text-right">Signed-out</th>
                </tr>
              </thead>
              <tbody>
                {overview.map((r) => (
                  <tr key={r.app_key} className="border-t">
                    <td className="px-4 py-2 font-medium">{r.app_key}</td>
                    <td className="px-4 py-2 text-right">{r.dau}</td>
                    <td className="px-4 py-2 text-right">{r.wau}</td>
                    <td className="px-4 py-2 text-right">{r.mau}</td>
                    <td className="px-4 py-2 text-right">{r.events}</td>
                    <td className="px-4 py-2 text-right">{r.sessions}</td>
                    <td className="px-4 py-2 text-right text-slate-500">
                      {r.signed_out_pct == null ? "—" : `${r.signed_out_pct}%`}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-2">
            Top events ({days}d)
          </h2>
          <div className="bg-white rounded-xl shadow overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-slate-100 text-left text-slate-600">
                <tr>
                  <th className="px-4 py-2">Event</th>
                  <th className="px-4 py-2 text-right">Count</th>
                  <th className="px-4 py-2 text-right">Unique visitors</th>
                </tr>
              </thead>
              <tbody>
                {events.map((r) => (
                  <tr key={r.event_name} className="border-t">
                    <td className="px-4 py-2 font-mono text-slate-700">{r.event_name}</td>
                    <td className="px-4 py-2 text-right">{r.events}</td>
                    <td className="px-4 py-2 text-right text-slate-500">{r.visitors}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-2 mt-8">
            Daily activity ({days}d, all apps)
          </h2>
          <p className="text-xs text-slate-400 mb-2">
            From the nightly <code>analytics_daily</code> rollup — refreshed at 04:37 UTC, kept
            beyond the 180-day raw retention.
          </p>
          <div className="bg-white rounded-xl shadow overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-slate-100 text-left text-slate-600">
                <tr>
                  <th className="px-4 py-2">Day</th>
                  <th className="px-4 py-2 text-right">Events</th>
                  <th className="px-4 py-2 text-right">Visitors</th>
                  <th className="px-4 py-2 text-right">Sessions</th>
                  <th className="px-4 py-2 text-right">Signed-out events</th>
                </tr>
              </thead>
              <tbody>
                {daily.length === 0 ? (
                  <tr>
                    <td className="px-4 py-3 text-slate-400" colSpan={5}>
                      No rollup rows yet.
                    </td>
                  </tr>
                ) : (
                  daily.map((r) => (
                    <tr key={r.day} className="border-t">
                      <td className="px-4 py-2 text-slate-500">{r.day}</td>
                      <td className="px-4 py-2 text-right">{r.events}</td>
                      <td className="px-4 py-2 text-right">{r.visitors}</td>
                      <td className="px-4 py-2 text-right">{r.sessions}</td>
                      <td className="px-4 py-2 text-right text-slate-500">{r.signed_out_events}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
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
