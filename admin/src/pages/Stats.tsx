import { useEffect, useState } from "react";
import { supabase } from "../supabase";

type Row = {
  id: string;
  email: string;
  signed_up_at: string;
  last_sign_in_at: string | null;
  last_active_at: string | null;
  recall_chapters: number;
  recall_pass_sum: number;
  language_rows: number;
};

function timeAgo(iso: string | null) {
  if (!iso) return "—";
  const ms = Date.now() - new Date(iso).getTime();
  const m = Math.round(ms / 60000);
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 48) return `${h}h ago`;
  const d = Math.round(h / 24);
  return `${d}d ago`;
}

export default function Stats() {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [err, setErr] = useState("");

  useEffect(() => {
    supabase.rpc("get_user_stats").then(({ data, error }) => {
      if (error) setErr(error.message);
      else setRows(data as Row[]);
    });
  }, []);

  if (err) return <div className="p-10 text-red-600">{err}</div>;
  if (!rows) return <div className="p-10 text-slate-500">Loading stats…</div>;

  const now = Date.now();
  const within = (iso: string | null, days: number) =>
    !!iso && now - new Date(iso).getTime() < days * 86400_000;
  const active7 = rows.filter((r) => within(r.last_active_at, 7)).length;
  const active30 = rows.filter((r) => within(r.last_active_at, 30)).length;

  return (
    <div className="max-w-6xl mx-auto p-8">
      <h1 className="text-2xl font-bold mb-6">User Stats</h1>

      <div className="grid grid-cols-3 gap-4 mb-6">
        <Stat label="Total users" value={rows.length} />
        <Stat label="Active last 7d" value={active7} />
        <Stat label="Active last 30d" value={active30} />
      </div>

      <div className="bg-white rounded-xl shadow overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-100 text-left text-slate-600">
            <tr>
              <th className="px-4 py-2">Email</th>
              <th className="px-4 py-2">Signed up</th>
              <th className="px-4 py-2">Last active</th>
              <th className="px-4 py-2 text-right">Recall chapters</th>
              <th className="px-4 py-2 text-right">Pass sum</th>
              <th className="px-4 py-2 text-right">Language rows</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-t">
                <td className="px-4 py-2 font-medium">{r.email}</td>
                <td className="px-4 py-2 text-slate-500">
                  {new Date(r.signed_up_at).toLocaleDateString()}
                </td>
                <td className="px-4 py-2 text-slate-500">
                  {timeAgo(r.last_active_at)}
                </td>
                <td className="px-4 py-2 text-right">{r.recall_chapters}</td>
                <td className="px-4 py-2 text-right">{r.recall_pass_sum}</td>
                <td className="px-4 py-2 text-right">{r.language_rows}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="bg-white rounded-xl shadow p-5">
      <div className="text-xs text-slate-500 uppercase tracking-wide">
        {label}
      </div>
      <div className="text-3xl font-bold mt-1">{value}</div>
    </div>
  );
}
