import { describe, it, expect } from "vitest";
import {
  advance,
  applyMarkCorrect,
  applyResult,
  isAnswerCorrect,
  scorePercentage,
  shouldRequeue,
} from "./quizMachine";

describe("isAnswerCorrect", () => {
  it("matches ignoring case and surrounding/internal whitespace", () => {
    expect(isAnswerCorrect("Bonjour", "bonjour")).toBe(true);
    expect(isAnswerCorrect("  le   chat ", "le chat")).toBe(true);
  });

  it("rejects a genuinely different answer", () => {
    expect(isAnswerCorrect("chien", "chat")).toBe(false);
  });
});

describe("applyResult", () => {
  it("counts the question and scores a correct answer", () => {
    expect(applyResult({ correct: 2, total: 5 }, true)).toEqual({ correct: 3, total: 6 });
  });

  it("counts the question but not the point on a wrong answer", () => {
    expect(applyResult({ correct: 2, total: 5 }, false)).toEqual({ correct: 2, total: 6 });
  });
});

describe("applyMarkCorrect", () => {
  it("scores the point without counting another question", () => {
    // The question was already tallied by the failed check; marking a synonym
    // only awards the point, so total must not move.
    expect(applyMarkCorrect({ correct: 2, total: 6 })).toEqual({ correct: 3, total: 6 });
  });
});

describe("shouldRequeue", () => {
  it("requeues only a shown, genuinely-missed card when requeue is on", () => {
    expect(shouldRequeue(true, true, false)).toBe(true);
  });

  it("never requeues when the feature is off (Study mode)", () => {
    expect(shouldRequeue(false, true, false)).toBe(false);
  });

  it("does not requeue a correct card, or one marked correct as a synonym", () => {
    expect(shouldRequeue(true, true, true)).toBe(false);
  });

  it("does not requeue before the result is shown", () => {
    expect(shouldRequeue(true, false, false)).toBe(false);
  });
});

describe("advance", () => {
  it("moves to the next card when there is one", () => {
    expect(advance(0, 3, false)).toEqual({ index: 1, completed: false });
  });

  it("completes when the last card is answered", () => {
    expect(advance(2, 3, false)).toEqual({ index: 2, completed: true });
  });

  it("does not complete on the old last card when one was just requeued", () => {
    // queue was length 3, but a missed card was appended, so index 2 is no longer
    // the end — the requeued card at index 3 is still to come.
    expect(advance(2, 3, true)).toEqual({ index: 3, completed: false });
  });

  it("completes at the requeued card once it is reached", () => {
    // After the requeue the deck is length 4; index 3 with no further requeue ends it.
    expect(advance(3, 4, false)).toEqual({ index: 3, completed: true });
  });
});

describe("scorePercentage", () => {
  it("rounds to the nearest whole percent", () => {
    expect(scorePercentage({ correct: 2, total: 3 })).toBe(67);
    expect(scorePercentage({ correct: 5, total: 5 })).toBe(100);
  });

  it("is 0 rather than NaN when nothing was answered", () => {
    expect(scorePercentage({ correct: 0, total: 0 })).toBe(0);
  });
});
