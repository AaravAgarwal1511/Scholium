import { EyeOff, Play } from "lucide-react";
import { formatClock } from "@/lib/useTimer";

/**
 * Pausing hides the paper outright. A pause that left the questions on screen
 * would just be free reading time, which is exactly the thing an exam clock is
 * supposed to cost you.
 */
export default function PauseCurtain({
  remainingMs,
  onResume,
}: {
  remainingMs: number;
  onResume(): void;
}) {
  return (
    <div
      data-testid="pause-curtain"
      className="fixed inset-0 z-40 flex flex-col items-center justify-center gap-5 bg-background"
    >
      <EyeOff size={28} className="text-muted-foreground" />
      <div className="text-center">
        <p className="font-display text-2xl font-bold">Paused</p>
        <p className="mt-1 text-sm text-muted-foreground">
          The paper is hidden while the clock is stopped.
        </p>
      </div>
      <p className="tabular-nums font-display text-4xl font-bold">{formatClock(remainingMs)}</p>
      <button
        data-testid="curtain-resume"
        onClick={onResume}
        className="flex items-center gap-2 rounded-lg px-5 py-2.5 text-sm font-semibold text-white"
        style={{ background: "hsl(var(--primary))" }}
      >
        <Play size={15} /> Resume exam
      </button>
    </div>
  );
}
