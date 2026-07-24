import { useState } from "react";
import { Button } from "@/components/ui/button";
import type { SidePoint, TwoSiderSide } from "@/types";
import { cn } from "@/lib/utils";
import { sideTheme, type SideTheme } from "./meta";

// Stage 1 — Anchor. Compress each point to one keyword and learn the side's
// count, so a missing point announces itself ("five of six"). Tapping a rung is
// an active-recall beat: try to say the point, then reveal to check. A rung
// cycles hidden → keyword → full point.
function Rung({
  index,
  point,
  theme,
  onRevealed,
}: {
  index: number;
  point: SidePoint;
  theme: SideTheme;
  onRevealed: () => void;
}) {
  const [state, setState] = useState(0); // 0 hidden · 1 keyword · 2 full

  return (
    <button
      type="button"
      onClick={() =>
        setState((s) => {
          const next = Math.min(2, s + 1);
          if (next === 2 && s < 2) onRevealed();
          return next;
        })
      }
      className={cn(
        "w-full text-left grid grid-cols-[44px_1fr] gap-3 items-center rounded-xl border-2 p-3 transition-all duration-200",
        state === 2 ? cn(theme.softBg, theme.border) : "bg-card border-border hover:border-muted-foreground/30",
      )}
    >
      <span
        className={cn(
          "w-11 h-11 rounded-lg grid place-items-center font-bold text-xl font-display tabular-nums",
          theme.softBg,
          theme.text,
        )}
      >
        {index + 1}
      </span>
      <span className="min-w-0">
        {state === 0 ? (
          <span className="text-xs text-muted-foreground italic">tap to recall…</span>
        ) : (
          <span className="font-semibold text-foreground">{point.keyword}</span>
        )}
        {state === 2 && (
          <span className="block text-sm text-muted-foreground mt-1 leading-snug">{point.point}</span>
        )}
      </span>
    </button>
  );
}

function Column({ side, onRevealed }: { side: TwoSiderSide; onRevealed: () => void }) {
  const theme = sideTheme(side.stance);
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2 mb-1">
        <span className={cn("inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold", theme.softBg, theme.text)}>
          <span className={cn("w-2 h-2 rounded-sm", theme.solid)} />
          {side.label}
        </span>
        <span className={cn("font-display font-bold text-sm tabular-nums", theme.text)}>
          {side.points.length} point{side.points.length === 1 ? "" : "s"}
        </span>
      </div>
      {side.points.map((p, i) => (
        <Rung key={i} index={i} point={p} theme={theme} onRevealed={onRevealed} />
      ))}
    </div>
  );
}

export function Anchor({
  sides,
  onComplete,
}: {
  sides: TwoSiderSide[];
  onComplete: () => void;
}) {
  const total = sides.reduce((n, s) => n + s.points.length, 0);
  const [revealed, setRevealed] = useState(0);
  const done = revealed >= total;

  return (
    <div className="flex flex-col gap-6">
      <p className="text-sm text-muted-foreground">
        Each point shrinks to one keyword. Two numbers to hold onto:{" "}
        {sides.map((s, i) => (
          <span key={s.stance}>
            <b className={cn("font-display tabular-nums", sideTheme(s.stance).text)}>{s.points.length}</b>{" "}
            {s.label.toLowerCase()}
            {i < sides.length - 1 ? " and " : ""}
          </span>
        ))}
        . Tap a rung, try to say the point aloud, then reveal to check.
      </p>

      <div className="grid sm:grid-cols-2 gap-5">
        {sides.map((side) => (
          <Column key={side.stance} side={side} onRevealed={() => setRevealed((r) => r + 1)} />
        ))}
      </div>

      <div className="flex flex-col items-center gap-3 pt-2">
        <Button size="lg" disabled={!done} onClick={onComplete}>
          {done ? "Continue to Face-Off →" : `Reveal every point to continue (${revealed}/${total})`}
        </Button>
        {!done && (
          <p className="text-xs text-muted-foreground">Learn the counts and a gap announces itself — name five of six and you know one is still missing.</p>
        )}
      </div>
    </div>
  );
}
