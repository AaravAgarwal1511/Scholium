import { afterEach, describe, expect, it, vi } from "vitest";
import { formatClock, reviveTimer } from "./useTimer";
import type { Timer } from "./model";

/**
 * The exam clock's integrity claim: while it runs, the only stored quantity is
 * `deadlineAt`, an absolute timestamp. Remaining time is always deadline − now,
 * so closing the tab and coming back cannot refund the seconds spent away.
 * reviveTimer() is what enforces that on the way back in.
 *
 * The hook itself is not covered here — mock-space's vitest runs in `node`, with
 * no DOM to render into.
 */

const MIN = 60_000;

function timer(over: Partial<Timer> = {}): Timer {
    return {
        durationMs: 90 * MIN,
        deadlineAt: null,
        remainingMs: 90 * MIN,
        state: "idle",
        ...over,
    };
}

afterEach(() => {
    vi.useRealTimers();
});

describe("formatClock", () => {
    it("shows mm:ss under an hour", () => {
        expect(formatClock(0)).toBe("00:00");
        expect(formatClock(1_000)).toBe("00:01");
        expect(formatClock(59_000)).toBe("00:59");
        expect(formatClock(60_000)).toBe("01:00");
        expect(formatClock(59 * MIN + 59_000)).toBe("59:59");
    });

    it("adds an hours field at exactly one hour", () => {
        expect(formatClock(60 * MIN)).toBe("1:00:00");
        expect(formatClock(90 * MIN)).toBe("1:30:00");
        expect(formatClock(2 * 60 * MIN + 5 * MIN + 7_000)).toBe("2:05:07");
    });

    it("rounds part-seconds up, so the clock never shows a time already gone", () => {
        // Ceil, not floor: with 1ms left the student still has "00:01", and the
        // display only reaches 00:00 when the time really is up.
        expect(formatClock(1)).toBe("00:01");
        expect(formatClock(999)).toBe("00:01");
        expect(formatClock(1_001)).toBe("00:02");
    });

    it("does not go negative if called past expiry", () => {
        // useTimer clamps at 0 before formatting, but a stray negative must not
        // render as "-1:-1".
        expect(formatClock(-500)).toBe("00:00");
    });
});

describe("reviveTimer — charging for time spent away", () => {
    it("expires a timer whose deadline passed while the tab was closed", () => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date("2026-07-24T12:00:00Z"));
        const deadline = Date.now() - 5 * MIN; // passed five minutes ago

        expect(reviveTimer(timer({ state: "running", deadlineAt: deadline }))).toEqual(
            expect.objectContaining({ state: "expired", deadlineAt: null, remainingMs: 0 }),
        );
    });

    it("leaves a still-running timer alone, deadline intact", () => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date("2026-07-24T12:00:00Z"));
        const deadline = Date.now() + 20 * MIN;
        const running = timer({ state: "running", deadlineAt: deadline });

        // Unchanged: remaining time is recomputed from the deadline on each tick,
        // so there is nothing to adjust here.
        expect(reviveTimer(running)).toBe(running);
    });

    it("expires exactly at the deadline, not a tick later", () => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date("2026-07-24T12:00:00Z"));
        expect(reviveTimer(timer({ state: "running", deadlineAt: Date.now() })).state).toBe(
            "expired",
        );
    });

    it("does not resume a paused timer or start an idle one", () => {
        // Only `running` carries a deadline; pausing converts it back to a
        // duration, and that duration must survive a reload untouched.
        const paused = timer({ state: "paused", remainingMs: 42 * MIN });
        expect(reviveTimer(paused)).toBe(paused);

        const idle = timer({ state: "idle" });
        expect(reviveTimer(idle)).toBe(idle);
    });

    it("leaves an already-expired timer expired", () => {
        const expired = timer({ state: "expired", deadlineAt: null, remainingMs: 0 });
        expect(reviveTimer(expired)).toBe(expired);
    });

    it("ignores a running timer with no deadline rather than crashing", () => {
        // Should not occur, but a malformed row read back from mock_attempts
        // must not take the attempt page down with it.
        const odd = timer({ state: "running", deadlineAt: null, remainingMs: 10 * MIN });
        expect(reviveTimer(odd)).toBe(odd);
    });

    it("a reload mid-exam does not refund the elapsed time", () => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date("2026-07-24T12:00:00Z"));

        // Started with 90 minutes on the clock.
        const started = timer({ state: "running", deadlineAt: Date.now() + 90 * MIN });

        // Student closes the tab, comes back an hour later.
        vi.setSystemTime(new Date("2026-07-24T13:00:00Z"));
        const revived = reviveTimer(started);

        // Still running, and the deadline is untouched — so the clock will read
        // 30 minutes, not the 90 it was started with.
        expect(revived.state).toBe("running");
        expect(revived.deadlineAt! - Date.now()).toBe(30 * MIN);
    });
});
