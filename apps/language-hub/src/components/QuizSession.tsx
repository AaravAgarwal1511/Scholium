import { useEffect, useState, useCallback, useRef } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { ArrowLeft, Volume2, Check, X, Trophy } from "lucide-react";
import { toast } from "sonner";
import { useSounds } from "@/hooks/use-sounds";
import { useSpeak } from "@/hooks/use-speak";
import { normalizeAnswer } from "@/lib/answer";
import { AccentButtons } from "@/components/AccentButtons";

export interface QuizItem {
  id: string;
  term: string;
  definition: string;
}

export type QuestionType = "fr-to-en" | "en-to-fr" | "dictation";

export interface QuizQuestion {
  item: QuizItem;
  type: QuestionType;
  prompt: string;
  answer: string;
  language: string;
}

interface QuizSessionProps {
  questions: QuizQuestion[];
  title: string;
  headerActions?: React.ReactNode;
  onCorrectAnswer?: (question: QuizQuestion) => void;
  /**
   * When true, a card answered incorrectly is appended to the end of the deck so
   * it comes back around after the in-the-moment retype. Practice enables this;
   * Study leaves the deck fixed.
   */
  requeueIncorrect?: boolean;
  completionTitle: string;
  completionSubtitle: string;
  completionActions: React.ReactNode;
}

export const QuizSession = ({
  questions,
  title,
  headerActions,
  onCorrectAnswer,
  requeueIncorrect = false,
  completionTitle,
  completionSubtitle,
  completionActions,
}: QuizSessionProps) => {
  const { playCorrect, playIncorrect } = useSounds();
  const speak = useSpeak();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [userAnswer, setUserAnswer] = useState("");
  const [showResult, setShowResult] = useState(false);
  const [isCorrect, setIsCorrect] = useState(false);
  const [retypeMode, setRetypeMode] = useState(false);
  const [retypeAnswer, setRetypeAnswer] = useState("");
  const [score, setScore] = useState({ correct: 0, total: 0 });
  const [completed, setCompleted] = useState(false);
  // The live deck. Starts as the given questions; in practice a missed card is
  // appended here so it reappears at the end. Snapshotted at mount — Study
  // remounts (via key) to restart, so this never needs to re-sync to the prop.
  const [queue, setQueue] = useState<QuizQuestion[]>(questions);

  const mainInputRef = useRef<HTMLInputElement>(null);
  const retypeInputRef = useRef<HTMLInputElement>(null);

  const currentQuestion = queue[currentIndex];

  const nextQuestion = useCallback(() => {
    // Re-queue only a genuinely missed card — one the learner did not mark as a
    // synonym (markAsCorrect flips isCorrect back to true).
    const requeue = requeueIncorrect && showResult && !isCorrect;
    if (requeue) setQueue((q) => [...q, currentQuestion]);
    const lastIndex = queue.length - 1 + (requeue ? 1 : 0);
    if (currentIndex < lastIndex) {
      setCurrentIndex((i) => i + 1);
      setUserAnswer("");
      setShowResult(false);
      setRetypeMode(false);
      setRetypeAnswer("");
    } else {
      setCompleted(true);
    }
  }, [currentIndex, queue.length, requeueIncorrect, showResult, isCorrect, currentQuestion]);

  const checkAnswer = useCallback(() => {
    const correct = normalizeAnswer(userAnswer) === normalizeAnswer(currentQuestion.answer);
    setIsCorrect(correct);
    setShowResult(true);
    setScore((prev) => ({
      correct: prev.correct + (correct ? 1 : 0),
      total: prev.total + 1,
    }));
    if (correct) {
      playCorrect();
      onCorrectAnswer?.(currentQuestion);
    } else {
      playIncorrect();
    }
  }, [userAnswer, currentQuestion, playCorrect, playIncorrect, onCorrectAnswer]);

  const markAsCorrect = () => {
    setIsCorrect(true);
    setScore((prev) => ({ correct: prev.correct + 1, total: prev.total }));
    playCorrect();
    onCorrectAnswer?.(currentQuestion);
    toast.success("Marked as correct");
  };

  const handleKeyPress = useCallback(
    (e: KeyboardEvent) => {
      if (e.key !== "Enter") return;
      if (showResult && isCorrect) {
        nextQuestion();
      } else if (showResult && !isCorrect && !retypeMode) {
        setRetypeMode(true);
      } else if (retypeMode) {
        if (normalizeAnswer(retypeAnswer) === normalizeAnswer(currentQuestion?.answer || "")) {
          nextQuestion();
        }
      } else if (userAnswer.trim() && !showResult) {
        checkAnswer();
      }
    },
    [showResult, isCorrect, retypeMode, retypeAnswer, userAnswer, currentQuestion, nextQuestion, checkAnswer],
  );

  useEffect(() => {
    window.addEventListener("keydown", handleKeyPress);
    return () => window.removeEventListener("keydown", handleKeyPress);
  }, [handleKeyPress]);

  if (completed) {
    const percentage = Math.round((score.correct / score.total) * 100);
    return (
      <div className="min-h-screen bg-background">
        <header className="border-b border-border bg-card/50 backdrop-blur-sm">
          <div className="container mx-auto max-w-2xl px-6 py-4">
            <Link to="/">
              <Button variant="ghost" size="icon">
                <ArrowLeft className="h-5 w-5" />
              </Button>
            </Link>
          </div>
        </header>
        <main className="container mx-auto max-w-2xl px-6 py-12">
          <Card className="shadow-card text-center py-12 animate-slide-up">
            <CardContent>
              <Trophy className="h-20 w-20 mx-auto text-accent mb-6" />
              <h2 className="text-3xl font-bold font-display mb-2">{completionTitle}</h2>
              <p className="text-xl text-muted-foreground mb-6">{completionSubtitle}</p>
              <div className="text-6xl font-bold text-primary mb-2">
                {percentage}%
              </div>
              <p className="text-muted-foreground mb-8">
                {score.correct} correct out of {score.total} questions
              </p>
              <div className="flex gap-4 justify-center">{completionActions}</div>
            </CardContent>
          </Card>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="container mx-auto max-w-2xl px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link to="/">
                <Button variant="ghost" size="icon">
                  <ArrowLeft className="h-5 w-5" />
                </Button>
              </Link>
              <div>
                <h1 className="font-bold font-display">{title}</h1>
                <p className="text-sm text-muted-foreground">
                  Question {currentIndex + 1} of {queue.length}
                </p>
              </div>
            </div>
            {headerActions}
          </div>
        </div>
      </header>

      <div className="container mx-auto max-w-2xl px-6 pt-4">
        <Progress value={((currentIndex + 1) / queue.length) * 100} className="h-2" />
      </div>

      <main className="container mx-auto max-w-2xl px-6 py-8">
        <Card className="shadow-card animate-slide-up">
          <CardContent className="p-8">
            <div className="flex justify-center mb-6">
              <span
                className={`px-3 py-1 rounded-full text-sm font-medium ${
                  currentQuestion.type === "fr-to-en"
                    ? "bg-primary/10 text-primary"
                    : currentQuestion.type === "en-to-fr"
                      ? "bg-accent/10 text-accent"
                      : "bg-success/10 text-success"
                }`}
              >
                {currentQuestion.type === "fr-to-en"
                  ? `${currentQuestion.language === "spanish" ? "🇪🇸" : "🇫🇷"} → 🇬🇧 Translation`
                  : currentQuestion.type === "en-to-fr"
                    ? `🇬🇧 → ${currentQuestion.language === "spanish" ? "🇪🇸" : "🇫🇷"} Translation`
                    : "🎧 Dictation"}
              </span>
            </div>

            <div className="text-center mb-8">
              <p className="text-lg text-muted-foreground mb-4">{currentQuestion.prompt}</p>
              <div className="min-h-11 flex items-center justify-center">
                {currentQuestion.type === "dictation" ? (
                  <Button
                    variant="outline"
                    size="lg"
                    onClick={() => speak(currentQuestion.item.term, currentQuestion.language)}
                  >
                    <Volume2 className="mr-2 h-5 w-5" />
                    Play Audio
                  </Button>
                ) : (
                  <p className="text-2xl font-serif font-semibold text-foreground">
                    {currentQuestion.type === "fr-to-en"
                      ? currentQuestion.item.term
                      : currentQuestion.item.definition}
                  </p>
                )}
              </div>
            </div>

            <div className="space-y-4">
              <Input
                ref={mainInputRef}
                placeholder="Type your answer..."
                value={userAnswer}
                onChange={(e) => setUserAnswer(e.target.value)}
                disabled={showResult}
                className={`text-lg text-center py-6 ${
                  showResult
                    ? isCorrect
                      ? "border-success bg-success/5"
                      : "border-destructive bg-destructive/5"
                    : ""
                }`}
                autoFocus
              />
              <AccentButtons
                inputRef={mainInputRef}
                value={userAnswer}
                onChange={setUserAnswer}
                language={currentQuestion.language}
                disabled={showResult}
              />

              {showResult && (
                <div
                  className={`p-4 rounded-lg ${isCorrect ? "bg-success/10" : "bg-destructive/10"} animate-slide-up`}
                >
                  <div className="flex items-center justify-center gap-2 mb-2">
                    {isCorrect ? (
                      <>
                        <Check className="h-5 w-5 text-success" />
                        <span className="font-semibold text-success">Correct!</span>
                      </>
                    ) : (
                      <>
                        <X className="h-5 w-5 text-destructive" />
                        <span className="font-semibold text-destructive">Incorrect</span>
                      </>
                    )}
                  </div>
                  {!isCorrect && (
                    <>
                      <p className="text-center text-foreground mb-3">
                        Correct answer:{" "}
                        <span className="font-semibold">{currentQuestion.answer}</span>
                        {currentQuestion.type === "dictation" && (
                          <span className="block text-muted-foreground text-sm mt-1">
                            ({currentQuestion.item.definition})
                          </span>
                        )}
                      </p>
                      <Button variant="outline" size="sm" onClick={markAsCorrect} className="w-full">
                        <Check className="mr-2 h-4 w-4" />
                        Mark as Correct (synonym)
                      </Button>
                    </>
                  )}
                  {isCorrect && currentQuestion.type === "dictation" && (
                    <p className="text-center text-muted-foreground text-sm mt-2">
                      ({currentQuestion.item.definition})
                    </p>
                  )}
                </div>
              )}

              {!showResult ? (
                <Button variant="hero" className="w-full" onClick={checkAnswer} disabled={!userAnswer.trim()}>
                  Check Answer
                </Button>
              ) : isCorrect ? (
                <Button variant="hero" className="w-full" onClick={nextQuestion}>
                  {currentIndex < queue.length - 1 ? "Next Question" : "See Results"}
                </Button>
              ) : !retypeMode ? (
                <Button variant="hero" className="w-full" onClick={() => setRetypeMode(true)}>
                  Retype Answer to Continue
                </Button>
              ) : (
                <div className="space-y-3">
                  <Input
                    ref={retypeInputRef}
                    placeholder="Retype the correct answer..."
                    value={retypeAnswer}
                    onChange={(e) => setRetypeAnswer(e.target.value)}
                    className={`text-lg text-center py-6 ${
                      retypeAnswer &&
                      normalizeAnswer(retypeAnswer) === normalizeAnswer(currentQuestion.answer)
                        ? "border-success bg-success/5"
                        : ""
                    }`}
                    autoFocus
                  />
                  <AccentButtons
                    inputRef={retypeInputRef}
                    value={retypeAnswer}
                    onChange={setRetypeAnswer}
                    language={currentQuestion.language}
                  />
                  <Button
                    variant="hero"
                    className="w-full"
                    onClick={nextQuestion}
                    disabled={
                      normalizeAnswer(retypeAnswer) !== normalizeAnswer(currentQuestion.answer)
                    }
                  >
                    {currentIndex < queue.length - 1 ? "Next Question" : "See Results"}
                  </Button>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <div className="text-center mt-6 text-muted-foreground">
          Score: {score.correct}/{score.total}
        </div>
      </main>
    </div>
  );
};
