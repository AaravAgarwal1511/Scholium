import { useState } from "react";
import { Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import type { Card } from "@/types";
import { cn } from "@/lib/utils";
import { checkPass4Answer, checkPass4AnswerChemistry, type Pass4Result } from "@/lib/answerCheck";
import { useSounds } from "@/hooks/useSounds";
import { shuffle } from "./utils";
import { CompletionScreen } from "./CompletionScreen";

interface Pass4Props {
  cards: Card[];
  onComplete: () => void;
  isChemistry?: boolean;
}

export function Pass4({ cards, onComplete, isChemistry = false }: Pass4Props) {
  const [idx, setIdx] = useState(0);
  const [input, setInput] = useState("");
  const [revealed, setRevealed] = useState(false);
  const [score, setScore] = useState(0);
  const [shuffled] = useState(() => shuffle(cards));
  const [autoResult, setAutoResult] = useState<Pass4Result | null>(null);
  const { playCorrect } = useSounds();

  if (idx >= shuffled.length)
    return <CompletionScreen score={score} total={shuffled.length} onComplete={onComplete} />;

  const card = shuffled[idx];

  function reveal() {
    if (!input.trim()) return;
    const result = isChemistry
      ? checkPass4AnswerChemistry(input, card.definition, cards.map((c) => c.definition))
      : checkPass4Answer(input, card.definition);
    setAutoResult(result);
    setRevealed(true);
    if (result.correct) {
      setScore((s) => s + 1);
      playCorrect();
    }
  }

  // `override` both adjusts the score relative to the auto-check and advances
  // to the next card — mirrors this component's existing "Mark Correct" flow
  // rather than Pass3's stay-on-card toggle, since Pass4 has no "undo before
  // moving on" step today either.
  function advance(override?: "correct" | "incorrect") {
    if (override === "correct" && !autoResult?.correct) {
      setScore((s) => s + 1);
      playCorrect();
    }
    if (override === "incorrect" && autoResult?.correct) setScore((s) => s - 1);
    setIdx((i) => i + 1);
    setInput("");
    setRevealed(false);
    setAutoResult(null);
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="bg-card rounded-xl border-2 border-pass4/20 p-6">
        <div className="text-xs font-bold text-pass4 uppercase tracking-wider mb-3">Term</div>
        <div className="text-3xl font-bold text-foreground font-display">{card.term}</div>
      </div>

      <div>
        <div className="text-xs font-semibold text-muted-foreground mb-3">
          Write the complete definition from memory
        </div>
        <Textarea
          value={input}
          onChange={(e) => !revealed && setInput(e.target.value)}
          disabled={revealed}
          placeholder="Write everything you can recall about this term..."
          rows={4}
        />
      </div>

      {!revealed && (
        <Button onClick={reveal} disabled={!input.trim()}>Reveal Answer</Button>
      )}

      {revealed && (
        <div className="flex flex-col gap-4 animate-slide-up">
          <div className="bg-card rounded-xl border-2 border-primary/20 p-5">
            <div className="text-xs font-bold text-primary uppercase tracking-wider mb-2">
              Correct Definition
            </div>
            <p className="text-sm text-foreground leading-relaxed">{card.definition}</p>
          </div>
          {autoResult && (
            <div
              className={cn(
                "rounded-xl p-4 flex items-center justify-between",
                autoResult.correct
                  ? "bg-success/10 border border-success/30"
                  : "bg-destructive/10 border border-destructive/30",
              )}
            >
              <span className={cn("font-semibold text-sm flex items-center gap-2", autoResult.correct ? "text-success" : "text-destructive")}>
                {autoResult.correct ? (
                  <><Check size={16} /> Correct! ({autoResult.matched}/{autoResult.total} key concepts)</>
                ) : (
                  <><X size={16} /> {autoResult.matched}/{autoResult.total} key concepts matched</>
                )}
              </span>
              <div className="flex gap-2">
                {!autoResult.correct && (
                  <Button size="sm" variant="outline" onClick={() => advance("correct")}>Mark Correct</Button>
                )}
                {autoResult.correct && (
                  <Button size="sm" variant="outline" onClick={() => advance("incorrect")}>Mark Incorrect</Button>
                )}
                <Button size="sm" variant={autoResult.correct ? "success" : "default"} onClick={() => advance()}>
                  {idx + 1 >= shuffled.length ? "Finish" : "Next →"}
                </Button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
