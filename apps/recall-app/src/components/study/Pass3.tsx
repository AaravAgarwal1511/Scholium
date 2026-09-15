import { useState } from "react";
import { Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { Card } from "@/types";
import { cn } from "@/lib/utils";
import { checkPass3Answer, checkPass3AnswerChemistry, chemistryPrimaryTerm } from "@/lib/answerCheck";
import { useSounds } from "@/hooks/useSounds";
import { shuffle } from "./utils";
import { CompletionScreen } from "./CompletionScreen";

interface Pass3Props {
  cards: Card[];
  onComplete: () => void;
  isChemistry?: boolean;
}

export function Pass3({ cards, onComplete, isChemistry = false }: Pass3Props) {
  const [idx, setIdx] = useState(0);
  const [input, setInput] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [correct, setCorrect] = useState(0);
  const [shuffled] = useState(() => shuffle(cards));
  // Overrides the auto-check for this card: null defers to it, "correct"/
  // "incorrect" flips it. A single tri-state (rather than two booleans) makes
  // the two override buttons mutually exclusive and freely reversible.
  const [override, setOverride] = useState<"correct" | "incorrect" | null>(null);
  const { playCorrect } = useSounds();

  if (idx >= shuffled.length)
    return <CompletionScreen score={correct} total={shuffled.length} onComplete={onComplete} />;

  const card = shuffled[idx];
  const checkAnswer = isChemistry ? checkPass3AnswerChemistry : checkPass3Answer;
  // Hint must count the shortest ACCEPTED answer ("Lithium"), not the stored
  // "Lithium, Li⁺" — otherwise it promises 12 letters for a 7-letter answer.
  const hintTerm = isChemistry ? chemistryPrimaryTerm(card.term) : card.term;
  const hint = "_ ".repeat(hintTerm.length).trim();
  const autoCorrect = submitted && checkAnswer(input, card.term);
  const isCorrect = override === null ? autoCorrect : override === "correct";

  function submit() {
    if (!input.trim()) return;
    setSubmitted(true);
    if (checkAnswer(input.trim(), card.term)) {
      setCorrect((c) => c + 1);
      playCorrect();
    }
  }

  function markCorrect() {
    setOverride("correct");
    setCorrect((c) => c + 1);
    playCorrect();
  }

  function markIncorrect() {
    setOverride("incorrect");
    setCorrect((c) => c - 1);
  }

  function next() {
    setIdx((i) => i + 1);
    setInput("");
    setSubmitted(false);
    setOverride(null);
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="bg-card rounded-xl border-2 border-success/20 p-6">
        <div className="text-xs font-bold text-success uppercase tracking-wider mb-3">Definition</div>
        <p className="text-base text-foreground leading-relaxed">{card.definition}</p>
      </div>

      <div>
        <div className="text-xs font-semibold text-muted-foreground mb-3">
          Type the term ({hintTerm.length} letters)
        </div>
        <div className="text-xs text-muted-foreground/60 font-mono mb-3 tracking-widest">{hint}</div>
        <Input
          type="text"
          value={input}
          onChange={(e) => !submitted && setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && !submitted && submit()}
          placeholder="Type the term..."
          autoFocus
          disabled={submitted}
          className={cn(
            "h-12 text-base font-semibold border-2 rounded-xl",
            submitted
              ? isCorrect
                ? "border-success bg-success/10 text-success"
                : "border-destructive bg-destructive/10 text-destructive"
              : "border-input",
          )}
        />
      </div>

      {!submitted && (
        <Button onClick={submit} disabled={!input.trim()}>Check Answer</Button>
      )}

      {submitted && (
        <div
          className={cn(
            "rounded-xl p-4 flex items-center justify-between animate-slide-up",
            isCorrect ? "bg-success/10 border border-success/30" : "bg-destructive/10 border border-destructive/30",
          )}
        >
          <span className={cn("font-semibold text-sm flex items-center gap-2", isCorrect ? "text-success" : "text-destructive")}>
            {isCorrect ? (
              <><Check size={16} /> Correct!</>
            ) : (
              <><X size={16} /> The answer was: <strong>{card.term}</strong></>
            )}
          </span>
          <div className="flex gap-2">
            {!isCorrect && (
              <Button size="sm" variant="outline" onClick={markCorrect}>
                Mark Correct
              </Button>
            )}
            {isCorrect && (
              <Button size="sm" variant="outline" onClick={markIncorrect}>
                Mark Incorrect
              </Button>
            )}
            <Button size="sm" variant={isCorrect ? "success" : "default"} onClick={next}>
              {idx + 1 >= shuffled.length ? "Finish" : "Next →"}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
