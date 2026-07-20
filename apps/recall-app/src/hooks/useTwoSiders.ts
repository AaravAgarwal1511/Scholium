import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Side, SidePoint, TwoSider, TwoSiderSide } from "@/types";

// Two-Sider content lives in Supabase (recall_two_siders + recall_two_sider_points)
// and is edited from the Admin Dashboard. Only the keyword and full point are
// stored — a point's mnemonic letter is its keyword's initial, and a side's
// mnemonic is those initials in order — so both are derived here on read.

type PointRow = { keyword: string; point: string };

function buildSide(stance: Side, label: string, rows: PointRow[]): TwoSiderSide {
  const points: SidePoint[] = rows.map((r) => ({
    letter: (r.keyword.trim()[0] ?? "").toUpperCase(),
    keyword: r.keyword,
    point: r.point,
  }));
  return { stance, label, mnemonic: points.map((p) => p.letter).join(""), points };
}

export function useTwoSiders() {
  const [twoSiders, setTwoSiders] = useState<TwoSider[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const { data: siders } = await supabase
        .from("recall_two_siders")
        .select("id, subject, emoji, question, for_label, against_label, sort_order")
        .eq("available", true)
        .order("sort_order", { ascending: true });

      if (cancelled) return;
      const list = siders ?? [];
      if (list.length === 0) {
        setTwoSiders([]);
        setLoading(false);
        return;
      }

      const { data: points } = await supabase
        .from("recall_two_sider_points")
        .select("two_sider_id, side, keyword, point, sort_order")
        .in("two_sider_id", list.map((s) => s.id))
        .order("sort_order", { ascending: true });

      if (cancelled) return;

      const byParent = new Map<string, { for: PointRow[]; against: PointRow[] }>();
      for (const s of list) byParent.set(s.id, { for: [], against: [] });
      for (const p of points ?? []) {
        const bucket = byParent.get(p.two_sider_id);
        if (!bucket) continue;
        (p.side === "against" ? bucket.against : bucket.for).push({ keyword: p.keyword, point: p.point });
      }

      const assembled: TwoSider[] = list.map((s) => {
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

      setTwoSiders(assembled);
      setLoading(false);
    }

    load();
    return () => { cancelled = true; };
  }, []);

  return { twoSiders, loading };
}
