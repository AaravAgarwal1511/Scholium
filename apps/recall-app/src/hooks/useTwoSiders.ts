import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Side, SidePoint, TwoSider, TwoSiderSide } from "@/types";

// Two-Sider content lives in Supabase (recall_two_siders + recall_two_sider_points)
// and is edited from the Admin Dashboard. A point is just its keyword and its
// full sentence; what the student memorises alongside them is the *count* per
// side and each point's position, both of which fall out of sort_order.

type PointRow = { keyword: string; point: string };

function buildSide(stance: Side, label: string, rows: PointRow[]): TwoSiderSide {
  const points: SidePoint[] = rows.map((r) => ({ keyword: r.keyword, point: r.point }));
  return { stance, label, points };
}

// Scratch essays for local work, appended after whatever the database returns.
// `import.meta.env.DEV` is true under `vite dev` and a literal `false` in every
// build, so Rollup folds this to `return []` and drops the dynamic import —
// src/data/devTwoSiders.ts is never bundled and production shows DB rows only.
async function devTwoSiders(): Promise<TwoSider[]> {
  if (!import.meta.env.DEV) return [];
  const { DEV_TWO_SIDERS } = await import("@/data/devTwoSiders");
  return DEV_TWO_SIDERS;
}

export function useTwoSiders() {
  const [twoSiders, setTwoSiders] = useState<TwoSider[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    // Returns the published essays, or [] if the database is unreachable — a
    // failed fetch must not swallow the dev essays appended below it.
    async function loadFromDb(): Promise<TwoSider[]> {
      const { data: siders } = await supabase
        .from("recall_two_siders")
        .select("id, subject, emoji, question, for_label, against_label, sort_order")
        .eq("available", true)
        .order("sort_order", { ascending: true });

      const list = siders ?? [];
      if (cancelled || list.length === 0) return [];

      const { data: points } = await supabase
        .from("recall_two_sider_points")
        .select("two_sider_id, side, keyword, point, sort_order")
        .in("two_sider_id", list.map((s) => s.id))
        .order("sort_order", { ascending: true });

      if (cancelled) return [];

      const byParent = new Map<string, { for: PointRow[]; against: PointRow[] }>();
      for (const s of list) byParent.set(s.id, { for: [], against: [] });
      for (const p of points ?? []) {
        const bucket = byParent.get(p.two_sider_id);
        if (!bucket) continue;
        (p.side === "against" ? bucket.against : bucket.for).push({ keyword: p.keyword, point: p.point });
      }

      return list.map((s) => {
        const b = byParent.get(s.id)!;
        return {
          id: s.id,
          subject: s.subject,
          emoji: s.emoji,
          question: s.question,
          sides: [
            buildSide("for", s.for_label, b.for),
            buildSide("against", s.against_label, b.against),
          ],
        };
      });
    }

    async function load() {
      const published = await loadFromDb().catch(() => [] as TwoSider[]);
      const dev = await devTwoSiders();
      if (cancelled) return;

      setTwoSiders([...published, ...dev]);
      setLoading(false);
    }

    load();
    return () => { cancelled = true; };
  }, []);

  return { twoSiders, loading };
}
