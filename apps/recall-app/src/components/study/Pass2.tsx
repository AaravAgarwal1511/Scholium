import { useMemo, useState } from "react";
import type { Card } from "@/types";
import { shuffle, pickDistractors } from "./utils";
import { CompletionScreen } from "./CompletionScreen";
import { ChooseCard, type ChooseQuestion } from "@/components/ChooseSession";

interface Pass2Props {
  cards: Card[];
  onComplete: () => void;
}

// Pass 2 ("choose") — read the definition, choose the term. Shares ChooseCard
// with the demo and the Practice screen so every choose pass looks identical.
export function Pass2({ cards, onComplete }: Pass2Props) {
  const questions = useMemo<ChooseQuestion[]>(() => {
    // Shuffle the question order (previously always the stored sort_order —
    // the one pass that didn't shuffle like Pass 1/3/4). `order`, not `cards`,
    // must back pickDistractors too: it excludes by index, and that index has
    // to refer to the same array being mapped or it excludes the wrong card.
    const order = shuffle(cards);
    return order.map((card, i) => ({
      term: card.term,
      definition: card.definition,
      options: shuffle([card.term, ...pickDistractors(order, i, 3).map((c) => c.term)]),
    }));
  }, [cards]);

  const [idx, setIdx] = useState(0);
  const [picked, setPicked] = useState<string | null>(null);
  const [correct, setCorrect] = useState(0);
  const [finished, setFinished] = useState(false);

  if (finished || idx >= questions.length)
    return <CompletionScreen score={correct} total={questions.length} onComplete={onComplete} />;

  function pick(option: string) {
    if (picked !== null) return;
    setPicked(option);
    if (option === questions[idx].term) setCorrect((c) => c + 1);
  }

  function next() {
    if (idx + 1 >= questions.length) {
      setFinished(true);
      return;
    }
    setIdx((i) => i + 1);
    setPicked(null);
  }

  return (
    <ChooseCard questions={questions} index={idx} picked={picked} onPick={pick} onNext={next} />
  );
}
