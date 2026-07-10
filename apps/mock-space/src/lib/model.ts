import { addStrike, wordAt, type Range } from "./textLayout";
import type { PageGeometry } from "./pdfRender";

export interface AnswerBox {
  id: string;
  /** 0-based page index. */
  page: number;
  /** Top-left corner, model space (PDF points from the page's top-left). */
  xPt: number;
  yPt: number;
  /** Text column width in points. Height is derived from the wrapped line count. */
  wPt: number;
  fontSizePt: number;
  text: string;
  /** Sorted, merged, half-open. Strikes are permanent, so this only ever grows. */
  struck: Range[];
  /** `text[0..commitIndex)` is frozen: backspace can never reach it. */
  commitIndex: number;
}

export interface Stroke {
  id: string;
  page: number;
  /** Flat `[x0, y0, x1, y1, …]` in model space. */
  points: number[];
  widthPt: number;
}

export type TimerState = "idle" | "running" | "paused" | "expired";

export interface Timer {
  durationMs: number;
  /** Absolute epoch ms. Set only while running — see useTimer(). */
  deadlineAt: number | null;
  /** Meaningful only while paused or idle. */
  remainingMs: number;
  state: TimerState;
}

export interface Attempt {
  id: string;
  /** null only for the signed-out /demo attempt, which is never stored. */
  userId: string | null;
  title: string;
  createdAt: number;
  updatedAt: number;
  pages: PageGeometry[];
  boxes: AnswerBox[];
  strokes: Stroke[];
  timer: Timer;
}

// ── The append-only rules ────────────────────────────────────────────────────
//
// These four functions are the entire integrity guarantee. They are pure and
// live outside React on purpose: the guarantee should be provable by a unit test,
// not merely observable by poking at the DOM.

/** Space, newline and tab end a word. Tab is handled by the caller — it commits
 *  without inserting anything, since a literal tab in an exam answer is meaningless. */
function isWordBreak(ch: string): boolean {
  return ch === " " || ch === "\n" || ch === "\t";
}

/** Index just past the last word break — i.e. the start of the trailing word. */
function lastBreakEnd(text: string): number {
  for (let i = text.length - 1; i >= 0; i--) {
    if (isWordBreak(text[i])) return i + 1;
  }
  return 0;
}

/**
 * Appends to the end of the box. There is no other way to add text: no insertion
 * point exists anywhere else, by construction.
 *
 * `commitIndex` never moves backwards (hence the `max`). So after a blur commits
 * the whole text, typing "ld" onto "…wor" leaves only "ld" erasable — the blur
 * really did freeze "wor", which is the point.
 */
export function appendText(box: AnswerBox, insert: string): AnswerBox {
  if (!insert) return box;
  const text = box.text + insert;
  return {
    ...box,
    text,
    commitIndex: Math.max(box.commitIndex, lastBreakEnd(text)),
  };
}

/** Deletes the last character, but only if it is inside the uncommitted word. */
export function backspace(box: AnswerBox): AnswerBox {
  if (box.text.length <= box.commitIndex) return box;
  return { ...box, text: box.text.slice(0, -1) };
}

/** Freezes everything typed so far. Triggered by Tab, by blur, and by any strike. */
export function commit(box: AnswerBox): AnswerBox {
  if (box.commitIndex >= box.text.length) return box;
  return { ...box, commitIndex: box.text.length };
}

/**
 * Crossing out is permanent and always commits the pending word first — otherwise
 * a student could strike a half-typed word and then backspace into the strike,
 * which has no coherent meaning.
 */
export function strikeRange(box: AnswerBox, start: number, end: number): AnswerBox {
  const lo = Math.max(0, Math.min(start, box.text.length));
  const hi = Math.max(0, Math.min(end, box.text.length));
  if (hi <= lo) return box;
  return { ...commit(box), struck: addStrike(box.struck, lo, hi) };
}

/** Strikes the whole whitespace-delimited word containing `index`. */
export function strikeWordAt(box: AnswerBox, index: number): AnswerBox {
  const word = wordAt(box.text, index);
  if (!word) return box;
  return strikeRange(box, word.start, word.end);
}

/** A box that has never been typed in may be removed; one with text may not. */
export function isDeletable(box: AnswerBox): boolean {
  return box.text.length === 0;
}

export function createBox(page: number, xPt: number, yPt: number, wPt: number): AnswerBox {
  return {
    id: crypto.randomUUID(),
    page,
    xPt,
    yPt,
    wPt,
    fontSizePt: 11,
    text: "",
    struck: [],
    commitIndex: 0,
  };
}
