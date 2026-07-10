import { Pause, Play, Flag } from "lucide-react";
import { formatClock, type TimerControls } from "@/lib/useTimer";

const WARN_MS = 5 * 60_000;

export default function TimerBar({ timer }: { timer: TimerControls }) {
  const { state, remainingMs, start, pause, resume, finish } = timer;
  const low = state === "running" && remainingMs <= WARN_MS;

  return (
    <div className="flex items-center gap-2">
      <span
        data-testid="clock"
        className="tabular-nums text-sm font-semibold"
        style={{ color: low ? "hsl(var(--destructive))" : undefined }}
      >
        {formatClock(remainingMs)}
      </span>

      {state === "idle" && (
        <button
          data-testid="timer-start"
          onClick={start}
          className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold text-white"
          style={{ background: "hsl(var(--primary))" }}
        >
          <Play size={13} /> Start
        </button>
      )}

      {state === "running" && (
        <>
          <button
            data-testid="timer-pause"
            onClick={pause}
            className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-semibold hover:bg-muted"
          >
            <Pause size={13} /> Pause
          </button>
          <button
            data-testid="timer-finish"
            onClick={finish}
            className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold text-white"
            style={{ background: "hsl(var(--accent))" }}
          >
            <Flag size={13} /> Finish
          </button>
        </>
      )}

      {state === "paused" && (
        <button
          data-testid="timer-resume"
          onClick={resume}
          className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold text-white"
          style={{ background: "hsl(var(--primary))" }}
        >
          <Play size={13} /> Resume
        </button>
      )}
    </div>
  );
}
