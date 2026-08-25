import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { PDFDocumentProxy } from "pdfjs-dist";
import type { Attempt } from "@/lib/model";
import { choose, score, type Letter, type McqState } from "@/lib/mcq";
import QuestionView from "./QuestionView";
import OptionButtons from "./OptionButtons";

const SCALE = 1.5;
const LETTER_KEYS: Record<string, Letter> = { a: "A", b: "B", c: "C", d: "D" };

interface Props {
  doc: PDFDocumentProxy;
  pages: Attempt["pages"];
  mcq: McqState;
  /** Timer paused, idle or expired: navigation still works, choosing doesn't. */
  locked: boolean;
  onChange(update: (prev: Attempt) => Attempt): void;
}

/**
 * The MCQ interface's body: one question on screen at a time, big A–D
 * buttons, a running score. Owns only `current` — everything a student's
 * answer needs to survive a reload lives in `attempt.mcq` via `onChange`,
 * the same `updateAttempt` autosave path the written workspace uses.
 */
export default function McqRunner({ doc, pages, mcq, locked, onChange }: Props) {
  const total = mcq.questions.length;
  const [current, setCurrent] = useState(0);
  const question = mcq.questions[current];
  const choiceForCurrent = mcq.choices[current] ?? null;
  const { correct, answered } = score(mcq);

  const goPrev = () => setCurrent((i) => Math.max(0, i - 1));
  const goNext = () => setCurrent((i) => Math.min(total - 1, i + 1));

  const handleChoose = (letter: Letter) => {
    onChange((prev) => (prev.mcq ? { ...prev, mcq: choose(prev.mcq, current, letter) } : prev));
  };

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "ArrowRight") goNext();
      else if (e.key === "ArrowLeft") goPrev();
      else if (!locked) {
        const letter = LETTER_KEYS[e.key.toLowerCase()];
        if (letter) handleChoose(letter);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- goPrev/goNext/handleChoose close over `current`, which is already a dep
  }, [current, locked, total]);

  return (
    <div className="flex flex-col items-center gap-6 py-6">
      <div className="flex items-center gap-4">
        <span data-testid="mcq-progress" className="text-sm font-medium text-muted-foreground">
          Question {current + 1} of {total}
        </span>
        <span
          data-testid="mcq-score"
          className="rounded-full bg-muted px-3 py-1 text-sm font-semibold tabular-nums"
          title="Correct out of answered"
        >
          {correct} / {answered}
        </span>
      </div>

      <QuestionView doc={doc} pages={pages} question={question} scale={SCALE} />

      <OptionButtons
        question={question}
        choice={choiceForCurrent}
        locked={locked}
        onChoose={handleChoose}
      />

      <div className="flex items-center gap-3">
        <button
          type="button"
          data-testid="mcq-prev"
          disabled={current === 0}
          onClick={goPrev}
          className="flex items-center gap-1 rounded-lg border border-border px-4 py-2 text-sm font-semibold hover:bg-muted disabled:opacity-40"
        >
          <ChevronLeft size={16} /> Previous
        </button>
        <button
          type="button"
          data-testid="mcq-next"
          disabled={current === total - 1}
          onClick={goNext}
          className="flex items-center gap-1 rounded-lg border border-border px-4 py-2 text-sm font-semibold hover:bg-muted disabled:opacity-40"
        >
          Next <ChevronRight size={16} />
        </button>
      </div>
    </div>
  );
}
