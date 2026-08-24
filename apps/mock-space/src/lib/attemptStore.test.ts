import { describe, expect, it, vi } from "vitest";

// attemptStore imports the Supabase client, which is built at module scope with
// `storage: localStorage` — undefined in this node test env. fromRow/toRow never
// touch it, so a bare stub lets the module import without a DOM.
vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));

import { fromRow, toRow } from "./attemptStore";
import type { Attempt, Timer } from "./model";
import { createMcqState, type McqState } from "./mcq";

/**
 * The row ↔ model boundary. Postgres speaks ISO timestamps and nullable JSON
 * columns; the model counts epoch milliseconds and never-null arrays. Get this
 * wrong and a resumed attempt loses its boxes or its clock.
 */

const timer: Timer = { durationMs: 90 * 60_000, deadlineAt: null, remainingMs: 90 * 60_000, state: "idle" };

function attempt(over: Partial<Attempt> = {}): Attempt {
  return {
    id: "att-1",
    userId: "user-1",
    title: "Physics Paper 2",
    createdAt: Date.UTC(2026, 6, 10, 9, 0, 0),
    updatedAt: Date.UTC(2026, 6, 10, 10, 30, 0),
    pages: [],
    boxes: [],
    strokes: [],
    timer,
    mcq: null,
    ...over,
  };
}

const mcqState: McqState = createMcqState([
  { seq: 1, label: "June 2018 Q1", answer: "A", bands: [{ page: 0, yTopPt: 72, yBotPt: 183 }] },
]);

describe("toRow", () => {
  it("refuses to serialise an attempt with no account", () => {
    // The integrity guard: an attempt row must never exist without an owner, or
    // RLS could never scope it. Signed-out /demo attempts are ephemeral by design.
    expect(() => toRow(attempt({ userId: null }))).toThrow(/anonymous attempt/i);
    expect(() => toRow(attempt({ userId: "" }))).toThrow(/anonymous attempt/i);
  });

  it("maps the account onto user_id and epoch millis onto ISO timestamps", () => {
    const row = toRow(attempt());
    expect(row.user_id).toBe("user-1");
    expect(row.created_at).toBe("2026-07-10T09:00:00.000Z");
    expect(row.updated_at).toBe("2026-07-10T10:30:00.000Z");
  });
});

describe("fromRow", () => {
  const baseRow = {
    id: "att-1",
    user_id: "user-1",
    title: "Physics Paper 2",
    created_at: "2026-07-10T09:00:00.000Z",
    updated_at: "2026-07-10T10:30:00.000Z",
    pages: [],
    boxes: [],
    strokes: [],
    timer,
    mcq: null,
  };

  it("parses ISO timestamps back into epoch millis", () => {
    const a = fromRow(baseRow);
    expect(a.createdAt).toBe(Date.UTC(2026, 6, 10, 9, 0, 0));
    expect(a.updatedAt).toBe(Date.UTC(2026, 6, 10, 10, 30, 0));
  });

  it("coalesces null JSON columns to empty arrays", () => {
    // A freshly-inserted row can come back with nulls before the first autosave;
    // the model must never see null where it expects an array.
    const a = fromRow({ ...baseRow, pages: null as never, boxes: null as never, strokes: null as never });
    expect(a.pages).toEqual([]);
    expect(a.boxes).toEqual([]);
    expect(a.strokes).toEqual([]);
  });

  it("passes mcq through as-is — null for a written attempt", () => {
    expect(fromRow(baseRow).mcq).toBeNull();
  });

  it("round-trips a written attempt (mcq: null) through toRow unchanged", () => {
    const original = attempt();
    expect(fromRow(toRow(original))).toEqual(original);
  });

  it("round-trips an MCQ attempt's questions and choices unchanged", () => {
    const original = attempt({ mcq: mcqState });
    expect(fromRow(toRow(original))).toEqual(original);
  });
});
