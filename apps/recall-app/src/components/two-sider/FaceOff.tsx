import { useEffect, useRef, useState } from "react";
import { RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Side, SidePoint, TwoSiderSide } from "@/types";
import { cn } from "@/lib/utils";
import { shuffle } from "@/components/study/utils";
import { sideTheme } from "./meta";

interface DeckCard extends SidePoint {
  stance: Side;
}

// Stage 2 — Face-Off. All points from both sides are shuffled together and
// thrown at you one at a time. Interleaving forces you to *tell the sides
// apart*, which is the exact skill a "for and against" question tests.
export function FaceOff({
  sides,
  onComplete,
}: {
  sides: TwoSiderSide[];
  onComplete: () => void;
}) {
  const build = () =>
    shuffle(sides.flatMap((s) => s.points.map((p) => ({ ...p, stance: s.stance }))));

  const [deck, setDeck] = useState<DeckCard[]>(build);
  const [idx, setIdx] = useState(0);
  const [score, setScore] = useState(0);
  const [results, setResults] = useState<("good" | "bad" | null)[]>([]);
  const [feedback, setFeedback] = useState<{ ok: boolean; stance: Side } | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  const labelFor = (stance: Side) => sides.find((s) => s.stance === stance)?.label ?? stance;

  function reset() {
    if (timer.current) clearTimeout(timer.current);
    setDeck(build());
    setIdx(0);
    setScore(0);
    setResults([]);
    setFeedback(null);
  }

  function answer(stance: Side) {
    if (feedback) return;
    const card = deck[idx];
    const ok = stance === card.stance;
    setFeedback({ ok, stance: card.stance });
    setResults((r) => { const c = [...r]; c[idx] = ok ? "good" : "bad"; return c; });
    if (ok) setScore((s) => s + 1);
    timer.current = setTimeout(() => {
      setFeedback(null);
      setIdx((i) => i + 1);
    }, ok ? 650 : 1050);
  }

  // ── result screen ──
  if (idx >= deck.length) {
    const pct = Math.round((score / deck.length) * 100);
    const msg =
      pct === 100 ? "Flawless — both sides locked in."
      : pct >= 75 ? "Solid. Drill the ones you flipped."
      : "Sides still muddled — run Anchor again first.";
    return (
      <div className="flex flex-col items-center text-center gap-5 py-6 animate-slide-up">
        <div className="text-6xl font-bold font-display">
          {score}
          <span className="text-muted-foreground text-3xl">/{deck.length}</span>
        </div>
        <p className="text-muted-foreground text-sm max-w-xs">{msg}</p>
        <div className="flex flex-wrap justify-center gap-1.5 max-w-sm">
          {results.map((r, i) => (
            <span key={i} className={cn("w-5 h-1.5 rounded-full", r === "good" ? "bg-success" : "bg-destructive")} />
          ))}
        </div>
        <div className="flex gap-2 pt-1">
          <Button variant="outline" onClick={reset}><RotateCcw size={16} /> Reshuffle</Button>
          <Button onClick={onComplete}>Continue to Blank Slate →</Button>
        </div>
      </div>
    );
  }

  const card = deck[idx];

  return (
    <div className="flex flex-col gap-5 max-w-xl mx-auto w-full">
      {/* progress */}
      <div className="flex flex-wrap justify-center gap-1.5">
        {deck.map((_, i) => (
          <span
            key={i}
            className={cn(
              "w-5 h-1.5 rounded-full transition-colors",
              results[i] === "good" ? "bg-success"
              : results[i] === "bad" ? "bg-destructive"
              : i === idx ? "bg-foreground"
              : "bg-border",
            )}
          />
        ))}
      </div>

      {/* the point */}
      <div
        className={cn(
          "relative rounded-2xl border-2 p-6 min-h-[112px] grid place-items-center text-center shadow-card transition-colors",
          feedback == null ? "bg-card border-border"
          : feedback.ok ? "bg-success/10 border-success"
          : "bg-destructive/10 border-destructive animate-shake",
        )}
      >
        {feedback && (
          <span className={cn("absolute top-3 right-4 text-xs font-bold uppercase tracking-wide", feedback.ok ? "text-success" : "text-destructive")}>
            {feedback.ok ? `✓ ${labelFor(feedback.stance)}` : `✗ it's ${labelFor(feedback.stance)}`}
          </span>
        )}
        <span className="text-lg font-medium text-foreground leading-snug">{card.point}</span>
      </div>

      {/* the two sides */}
      <div className="grid grid-cols-2 gap-3">
        {sides.map((side) => {
          const theme = sideTheme(side.stance);
          return (
            <button
              key={side.stance}
              type="button"
              disabled={!!feedback}
              onClick={() => answer(side.stance)}
              className={cn(
                "py-4 px-3 rounded-xl font-semibold transition-all duration-150 disabled:opacity-50 active:translate-y-px",
                theme.solid,
                theme.solidText,
                theme.solidHover,
              )}
            >
              {side.label}
            </button>
          );
        })}
      </div>

      <div className="flex justify-center gap-6 text-sm text-muted-foreground tabular-nums">
        <span>Point <b className="text-foreground">{idx + 1}</b> / {deck.length}</span>
        <span>Correct <b className="text-foreground">{score}</b></span>
      </div>
    </div>
  );
}
