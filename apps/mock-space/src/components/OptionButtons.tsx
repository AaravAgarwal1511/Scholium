import type { Letter, McqQuestion } from "@/lib/mcq";

const LETTERS: Letter[] = ["A", "B", "C", "D"];

interface Props {
  question: McqQuestion;
  /** null = not yet answered. */
  choice: Letter | null;
  /** Timer paused, idle or expired: options are visible but inert. */
  locked: boolean;
  onChoose(letter: Letter): void;
}

type Variant = "neutral" | "chosen-correct" | "chosen-wrong" | "reveal-correct" | "muted";

function variantOf(letter: Letter, question: McqQuestion, choice: Letter | null): Variant {
  if (choice === null) return "neutral";
  if (letter === choice) return letter === question.answer ? "chosen-correct" : "chosen-wrong";
  if (letter === question.answer) return "reveal-correct";
  return "muted";
}

const VARIANT_CLASSES: Record<Variant, string> = {
  neutral:
    "border-border bg-card text-foreground hover:border-primary hover:bg-primary/5",
  "chosen-correct": "border-success bg-success/15 text-success",
  "chosen-wrong": "border-destructive bg-destructive/15 text-destructive",
  "reveal-correct": "border-success bg-success/5 text-success",
  muted: "border-border bg-card text-muted-foreground opacity-60",
};

/**
 * Clicking an option locks it in immediately — the MCQ analogue of the
 * written workspace's append-only rule (mcq.ts's `choose` never overwrites an
 * answered slot) — and reveals the verdict: the chosen button turns
 * green/red, the correct letter is outlined green when the choice was wrong.
 */
export default function OptionButtons({ question, choice, locked, onChoose }: Props) {
  const answered = choice !== null;
  const correct = answered && choice === question.answer;

  return (
    <div className="w-full max-w-md">
      <div
        role="group"
        aria-label={`Answer options for question ${question.seq}`}
        className="grid grid-cols-2 gap-3 sm:grid-cols-4"
      >
        {LETTERS.map((letter) => (
          <button
            key={letter}
            type="button"
            data-testid={`mcq-option-${letter}`}
            aria-label={`Option ${letter}`}
            aria-pressed={choice === letter}
            disabled={locked || answered}
            onClick={() => onChoose(letter)}
            className={`flex h-16 items-center justify-center rounded-xl border-2 text-xl font-bold transition-colors disabled:cursor-not-allowed ${VARIANT_CLASSES[variantOf(letter, question, choice)]}`}
          >
            {letter}
          </button>
        ))}
      </div>
      <p
        aria-live="polite"
        data-testid="mcq-verdict"
        className="mt-3 min-h-[1.25rem] text-sm font-medium"
      >
        {answered
          ? correct
            ? "Correct."
            : `Incorrect — the correct answer is ${question.answer}.`
          : null}
      </p>
    </div>
  );
}
