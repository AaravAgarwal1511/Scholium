import { useState } from "react";
import { Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { SidePoint, TwoSiderSide } from "@/types";
import { cn } from "@/lib/utils";
import { sideTheme, type SideTheme } from "./meta";

type Grade = "got" | "hint" | "miss";

// Stage 3 — Blank Slate. The real exam task: an empty page. Recall each point
// cold; if you stall, a hint gives up only the letter, then the keyword, then
// the full line. Using a hint means it wasn't unaided, so it counts as queued
// for the next pass. Honest self-grading drives what resurfaces tomorrow.
function Slot({
  index,
  point,
  theme,
  hint,
  grade,
  onReveal,
  onGrade,
}: {
  index: number;
  point: SidePoint;
  theme: SideTheme;
  hint: number;
  grade: Grade | undefined;
  onReveal: () => void;
  onGrade: (g: "got" | "miss") => void;
}) {
  return (
    <div
      className={cn(
        "rounded-xl border p-3 bg-card transition-colors",
        grade === "got" ? "border-success"
        : grade === "hint" || grade === "miss" ? "border-destructive"
        : "border-border",
      )}
    >
      <div className="flex items-center gap-3">
        <span className="text-sm text-muted-foreground tabular-nums w-4">{index + 1}</span>
        <button
          type="button"
          onClick={onReveal}
          className="flex-1 min-w-0 text-left text-sm py-0.5"
        >
          {hint === 0 && <span className="text-muted-foreground/70">tap for a hint…</span>}
          {hint >= 1 && <span className={cn("font-display font-bold", theme.text)}>{point.letter}</span>}
          {hint === 1 && <span className="text-muted-foreground/70"> — tap for the keyword</span>}
          {hint >= 2 && <span className="font-semibold text-foreground"> {point.keyword}</span>}
          {hint === 2 && <span className="text-muted-foreground/70"> — tap for the full point</span>}
          {hint >= 3 && <span className="block text-muted-foreground mt-1 leading-snug">{point.point}</span>}
        </button>
        <div className="flex gap-1.5 flex-shrink-0">
          <button
            type="button"
            onClick={() => onGrade("got")}
            aria-label="Recalled unaided"
            className={cn(
              "px-2 py-1 rounded-md text-xs font-semibold border transition-colors",
              grade === "got" ? "bg-success/15 border-success text-success" : "border-border text-muted-foreground hover:text-foreground",
            )}
          >
            <Check size={14} />
          </button>
          <button
            type="button"
            onClick={() => onGrade("miss")}
            aria-label="Missed"
            className={cn(
              "px-2 py-1 rounded-md text-xs font-semibold border transition-colors",
              grade === "hint" || grade === "miss" ? "bg-destructive/15 border-destructive text-destructive" : "border-border text-muted-foreground hover:text-foreground",
            )}
          >
            <X size={14} />
          </button>
        </div>
      </div>
    </div>
  );
}

export function BlankSlate({
  sides,
  onComplete,
}: {
  sides: TwoSiderSide[];
  onComplete: () => void;
}) {
  const [hints, setHints] = useState<Record<string, number>>({});
  const [grades, setGrades] = useState<Record<string, Grade>>({});

  const total = sides.reduce((n, s) => n + s.points.length, 0);

  function reveal(key: string) {
    setHints((h) => ({ ...h, [key]: Math.min(3, (h[key] ?? 0) + 1) }));
    // a revealed hint means it wasn't recalled unaided
    setGrades((g) => (g[key] === "got" || g[key] === undefined ? { ...g, [key]: "hint" } : g));
  }

  function grade(key: string, g: "got" | "miss") {
    // once a hint was used, "got" can only mean "got it with help"
    const resolved: Grade = g === "got" && (hints[key] ?? 0) > 0 ? "hint" : g;
    setGrades((prev) => ({ ...prev, [key]: resolved }));
  }

  const counts = Object.values(grades).reduce(
    (acc, g) => { acc[g]++; return acc; },
    { got: 0, hint: 0, miss: 0 } as Record<Grade, number>,
  );
  const graded = counts.got + counts.hint + counts.miss;
  const open = total - graded;
  const queued = counts.hint + counts.miss;
  const pct = (n: number) => `${(n / total) * 100}%`;

  return (
    <div className="flex flex-col gap-5">
      <div className="rounded-xl border border-border bg-secondary/40 px-4 py-3 text-sm text-muted-foreground">
        Recall each point cold — tap a slot only if you stall, then grade yourself honestly.
      </div>

      <div className="grid sm:grid-cols-2 gap-5">
        {sides.map((side) => {
          const theme = sideTheme(side.stance);
          return (
            <div key={side.stance} className="flex flex-col gap-2">
              <span className={cn("inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold w-fit", theme.softBg, theme.text)}>
                <span className={cn("w-2 h-2 rounded-sm", theme.solid)} />
                {side.label}
              </span>
              {side.points.map((p, i) => {
                const key = `${side.stance}-${i}`;
                return (
                  <Slot
                    key={key}
                    index={i}
                    point={p}
                    theme={theme}
                    hint={hints[key] ?? 0}
                    grade={grades[key]}
                    onReveal={() => reveal(key)}
                    onGrade={(g) => grade(key, g)}
                  />
                );
              })}
            </div>
          );
        })}
      </div>

      {/* tally */}
      <div className="rounded-xl border border-border bg-card p-4">
        <div className="flex h-3 rounded-full overflow-hidden bg-secondary mb-3">
          <span className="bg-success transition-all" style={{ width: pct(counts.got) }} />
          <span className="bg-accent transition-all" style={{ width: pct(counts.hint) }} />
          <span className="bg-destructive transition-all" style={{ width: pct(counts.miss) }} />
        </div>
        <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
          <span><i className="inline-block w-2.5 h-2.5 rounded-sm bg-success mr-1.5 align-middle" />Unaided <b className="text-foreground tabular-nums">{counts.got}</b></span>
          <span><i className="inline-block w-2.5 h-2.5 rounded-sm bg-accent mr-1.5 align-middle" />Needed a hint <b className="text-foreground tabular-nums">{counts.hint}</b></span>
          <span><i className="inline-block w-2.5 h-2.5 rounded-sm bg-destructive mr-1.5 align-middle" />Missed <b className="text-foreground tabular-nums">{counts.miss}</b></span>
          <span><i className="inline-block w-2.5 h-2.5 rounded-sm bg-border mr-1.5 align-middle" />Ungraded <b className="text-foreground tabular-nums">{open}</b></span>
        </div>
        <p className="text-sm text-muted-foreground mt-3">
          {open > 0
            ? "Grade every slot to finish — anything not recalled unaided is queued for tomorrow's pass."
            : queued === 0
              ? "All recalled unaided — this Two-Sider advances to a longer interval. 🎉"
              : <><b className="text-foreground">{queued}</b> point{queued > 1 ? "s" : ""} queued for tomorrow's pass; the {counts.got} unaided move to a longer interval.</>}
        </p>
      </div>

      <div className="flex justify-center">
        <Button size="lg" disabled={open > 0} onClick={onComplete}>
          {open > 0 ? `Grade all ${total} points to finish` : "Finish session ✓"}
        </Button>
      </div>
    </div>
  );
}
