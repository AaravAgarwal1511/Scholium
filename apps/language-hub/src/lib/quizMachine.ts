import { normalizeAnswer } from "@/lib/answer";

/**
 * The pure decisions behind QuizSession — extracted so the scoring, re-queue and
 * advance rules can be tested without driving the component. QuizSession holds the
 * React state; these functions decide what that state should become.
 */

export interface Score {
  correct: number;
  total: number;
}

/** A typed answer matches when it normalises to the same string as the expected one. */
export function isAnswerCorrect(userAnswer: string, expected: string): boolean {
  return normalizeAnswer(userAnswer) === normalizeAnswer(expected);
}

/** Checking an answer always counts a question; a correct one also scores a point. */
export function applyResult(score: Score, correct: boolean): Score {
  return { correct: score.correct + (correct ? 1 : 0), total: score.total + 1 };
}

/**
 * "Mark as correct (synonym)" scores the point WITHOUT counting another question —
 * the question was already counted when the answer was first checked.
 */
export function applyMarkCorrect(score: Score): Score {
  return { correct: score.correct + 1, total: score.total };
}

/**
 * A card is sent back to the end of the deck only when requeue is enabled AND the
 * result is showing AND it was genuinely missed (marking it a synonym flips
 * isCorrect back to true, so it is not requeued).
 */
export function shouldRequeue(
  requeueIncorrect: boolean,
  showResult: boolean,
  isCorrect: boolean,
): boolean {
  return requeueIncorrect && showResult && !isCorrect;
}

/**
 * Where the deck goes next. `requeued` means a card was just appended, so the last
 * reachable index grows by one. Returns the next index, or completion when the
 * current card was the last.
 */
export function advance(
  currentIndex: number,
  queueLength: number,
  requeued: boolean,
): { index: number; completed: boolean } {
  const lastIndex = queueLength - 1 + (requeued ? 1 : 0);
  return currentIndex < lastIndex
    ? { index: currentIndex + 1, completed: false }
    : { index: currentIndex, completed: true };
}

/** Final percentage for the completion screen; 0 when nothing was answered. */
export function scorePercentage(score: Score): number {
  return score.total === 0 ? 0 : Math.round((score.correct / score.total) * 100);
}
