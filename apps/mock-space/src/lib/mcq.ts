// The MCQ interface's model — pure, outside React, the same way model.ts holds
// the append-only rules for a written attempt. `McqState` is what an MCQ
// `Attempt.mcq` actually stores; everything else here builds or reads one.

export type Letter = "A" | "B" | "C" | "D";
const LETTERS: readonly Letter[] = ["A", "B", "C", "D"];

/** One question's placement in the composed PDF, top-origin points on a
 *  0-based output page — the same model space PageGeometry already uses
 *  (see coords.ts), so no flip is needed to render it. */
export interface McqBand {
  page: number;
  yTopPt: number;
  yBotPt: number;
}

export interface McqQuestion {
  seq: number;
  label: string;
  answer: Letter;
  bands: McqBand[];
}

export interface McqState {
  questions: McqQuestion[];
  /** Parallel to `questions`. null = unanswered. */
  choices: (Letter | null)[];
}

/** The freshly-opened state for an MCQ attempt: every question unanswered. */
export function createMcqState(questions: McqQuestion[]): McqState {
  return { questions, choices: questions.map(() => null) };
}

/**
 * Records a choice — but only once. This is the MCQ analogue of model.ts's
 * `setPending` never moving `commitIndex` backwards: once a question has been
 * answered, nothing in this module can change what was recorded for it. A
 * second click at the same index is a no-op, not an overwrite.
 */
export function choose(state: McqState, index: number, letter: Letter): McqState {
  if (index < 0 || index >= state.choices.length) return state;
  if (state.choices[index] !== null) return state;
  const choices = state.choices.slice();
  choices[index] = letter;
  return { ...state, choices };
}

export interface McqScore {
  correct: number;
  answered: number;
  total: number;
}

export function score(state: McqState): McqScore {
  let correct = 0;
  let answered = 0;
  for (let i = 0; i < state.questions.length; i++) {
    const choice = state.choices[i];
    if (choice === null || choice === undefined) continue;
    answered++;
    if (choice === state.questions[i].answer) correct++;
  }
  return { correct, answered, total: state.questions.length };
}

function isLetter(value: unknown): value is Letter {
  return typeof value === "string" && (LETTERS as readonly string[]).includes(value);
}

function isBand(value: unknown): value is McqBand {
  if (!value || typeof value !== "object") return false;
  const b = value as Record<string, unknown>;
  return (
    typeof b.page === "number" &&
    Number.isInteger(b.page) &&
    b.page >= 0 &&
    typeof b.yTopPt === "number" &&
    typeof b.yBotPt === "number" &&
    Number.isFinite(b.yTopPt) &&
    Number.isFinite(b.yBotPt) &&
    b.yTopPt < b.yBotPt
  );
}

function isQuestion(value: unknown): value is McqQuestion {
  if (!value || typeof value !== "object") return false;
  const q = value as Record<string, unknown>;
  return (
    typeof q.seq === "number" &&
    typeof q.label === "string" &&
    q.label.length > 0 &&
    isLetter(q.answer) &&
    Array.isArray(q.bands) &&
    q.bands.length > 0 &&
    q.bands.every(isBand)
  );
}

/**
 * Validates a downloaded sidecar before trusting it enough to start an
 * attempt from it. Deliberately strict and total, not best-effort: a sidecar
 * that fails this check is treated exactly like a missing one — OpenPaperPage
 * falls back to an ordinary written attempt rather than open a broken MCQ
 * interface with, say, an answer key one question short of the paper.
 */
export function isMcqPayload(value: unknown): value is { questions: McqQuestion[] } {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  return Array.isArray(v.questions) && v.questions.length > 0 && v.questions.every(isQuestion);
}
