import { useCallback, useEffect, useRef, useState } from "react";
import type { Timer } from "./model";

const TICK_MS = 250;

export interface TimerControls {
  remainingMs: number;
  state: Timer["state"];
  start(): void;
  pause(): void;
  resume(): void;
  finish(): void;
}

/**
 * While the clock runs, the only stored quantity is `deadlineAt` — an absolute
 * epoch timestamp. Remaining time is always `deadlineAt - now`, so a student who
 * reloads the tab, or closes it and comes back, cannot recover the seconds that
 * elapsed while they were away.
 *
 * Pause is the sole operation that converts a deadline back into a duration;
 * resume converts it forward again. That asymmetry is the whole design.
 *
 * A determined student can still wind back the system clock. Defending against that
 * needs an authoritative clock on a server, and the timer deliberately never asks
 * one — it must keep running offline. The easy exploits (reload, reopen) are
 * closed; this one is not.
 */
export function useTimer(timer: Timer, onChange: (next: Timer) => void): TimerControls {
  const [now, setNow] = useState(() => Date.now());

  // Kept in a ref so the expiry effect does not re-subscribe on every render.
  const fire = useRef(onChange);
  fire.current = onChange;

  useEffect(() => {
    if (timer.state !== "running") return;
    const id = window.setInterval(() => setNow(Date.now()), TICK_MS);
    return () => window.clearInterval(id);
  }, [timer.state]);

  const running = timer.state === "running" && timer.deadlineAt !== null;
  const remainingMs = running ? Math.max(0, timer.deadlineAt! - now) : timer.remainingMs;

  // Expiry is derived from the wall clock, not from counting ticks, so a
  // backgrounded tab (where intervals are throttled) still expires on time.
  useEffect(() => {
    if (timer.state !== "running" || timer.deadlineAt === null) return;
    if (Date.now() < timer.deadlineAt) return;
    fire.current({ ...timer, state: "expired", deadlineAt: null, remainingMs: 0 });
  }, [timer, now]);

  const start = useCallback(() => {
    fire.current({
      ...timer,
      state: "running",
      deadlineAt: Date.now() + timer.remainingMs,
    });
  }, [timer]);

  const pause = useCallback(() => {
    if (timer.state !== "running" || timer.deadlineAt === null) return;
    fire.current({
      ...timer,
      state: "paused",
      remainingMs: Math.max(0, timer.deadlineAt - Date.now()),
      deadlineAt: null,
    });
  }, [timer]);

  const finish = useCallback(() => {
    fire.current({ ...timer, state: "expired", deadlineAt: null, remainingMs: 0 });
  }, [timer]);

  return { remainingMs, state: timer.state, start, pause, resume: start, finish };
}

/** Restores a timer read back from storage, charging it for any time it was away. */
export function reviveTimer(timer: Timer): Timer {
  if (timer.state !== "running" || timer.deadlineAt === null) return timer;
  if (Date.now() >= timer.deadlineAt) {
    return { ...timer, state: "expired", deadlineAt: null, remainingMs: 0 };
  }
  return timer;
}

export function formatClock(ms: number): string {
  const total = Math.ceil(ms / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
}
