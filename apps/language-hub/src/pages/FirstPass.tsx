import { useCallback, useEffect, useRef, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { supabase } from "@/integrations/supabase/client";
import { ArrowLeft, Check, Volume2, Sparkles, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { useSounds } from "@/hooks/use-sounds";
import { useSpeak } from "@/hooks/use-speak";
import { normalizeAnswer } from "@/lib/answer";
import { AccentButtons } from "@/components/AccentButtons";

interface VocabularyItem {
  id: string;
  term: string;
  definition: string;
}

const FirstPass = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { playCorrect } = useSounds();
  const speak = useSpeak();

  const [setName, setSetName] = useState("");
  const [language, setLanguage] = useState("french");
  const [items, setItems] = useState<VocabularyItem[]>([]);
  const [loading, setLoading] = useState(true);

  const [currentIndex, setCurrentIndex] = useState(0);
  const [termInput, setTermInput] = useState("");
  const [definitionInput, setDefinitionInput] = useState("");
  const [completed, setCompleted] = useState(false);

  const termRef = useRef<HTMLInputElement>(null);
  const definitionRef = useRef<HTMLInputElement>(null);

  const currentItem = items[currentIndex];
  const langLabel = language === "spanish" ? "Spanish" : "French";

  const termMatches = !!currentItem && normalizeAnswer(termInput) === normalizeAnswer(currentItem.term);
  const definitionMatches =
    !!currentItem && normalizeAnswer(definitionInput) === normalizeAnswer(currentItem.definition);
  const bothMatch = termMatches && definitionMatches;

  const fetchSet = useCallback(async (setId: string) => {
    try {
      const { data: setData, error: setError } = await supabase
        .from("vocabulary_sets")
        .select("*")
        .eq("id", setId)
        .single();

      if (setError) throw setError;
      setSetName(setData.name);
      setLanguage(setData.language || "french");

      const { data: itemsData, error: itemsError } = await supabase
        .from("vocabulary_items")
        .select("*")
        .eq("set_id", setId)
        .order("created_at");

      if (itemsError) throw itemsError;

      if (!itemsData || itemsData.length === 0) {
        toast.error("This set has no vocabulary items");
        navigate("/");
        return;
      }

      setItems(itemsData);
    } catch (error) {
      console.error("Error fetching set:", error);
      toast.error("Failed to load vocabulary set");
      navigate("/");
    } finally {
      setLoading(false);
    }
  }, [navigate]);

  useEffect(() => {
    if (id) fetchSet(id);
  }, [id, fetchSet]);

  const nextItem = useCallback(() => {
    playCorrect();
    if (currentIndex < items.length - 1) {
      setCurrentIndex((i) => i + 1);
      setTermInput("");
      setDefinitionInput("");
      termRef.current?.focus();
    } else {
      setCompleted(true);
    }
  }, [currentIndex, items.length, playCorrect]);

  const restart = useCallback(() => {
    setCurrentIndex(0);
    setTermInput("");
    setDefinitionInput("");
    setCompleted(false);
  }, []);

  const handleKeyPress = useCallback(
    (e: KeyboardEvent) => {
      if (e.key !== "Enter" || completed) return;
      if (bothMatch) {
        nextItem();
      } else if (termMatches) {
        definitionRef.current?.focus();
      } else {
        termRef.current?.focus();
      }
    },
    [completed, bothMatch, termMatches, nextItem],
  );

  useEffect(() => {
    window.addEventListener("keydown", handleKeyPress);
    return () => window.removeEventListener("keydown", handleKeyPress);
  }, [handleKeyPress]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-pulse text-muted-foreground">Loading first pass...</div>
      </div>
    );
  }

  if (completed) {
    return (
      <div className="min-h-screen bg-background">
        <header className="border-b border-border bg-card/50 backdrop-blur-sm">
          <div className="container mx-auto max-w-2xl px-6 py-4">
            <Link to="/" aria-label="Back to home">
              <Button variant="ghost" size="icon" aria-label="Back to home">
                <ArrowLeft className="h-5 w-5" />
              </Button>
            </Link>
          </div>
        </header>
        <main className="container mx-auto max-w-2xl px-6 py-12">
          <Card className="shadow-card text-center py-12 animate-slide-up">
            <CardContent>
              <Sparkles className="h-20 w-20 mx-auto text-accent mb-6" />
              <h2 className="text-3xl font-bold font-display mb-2">First Pass Complete!</h2>
              <p className="text-xl text-muted-foreground mb-6">{setName}</p>
              <p className="text-muted-foreground mb-8">
                You wrote out all {items.length} {items.length === 1 ? "term" : "terms"}. Now try
                recalling them from memory.
              </p>
              <div className="flex gap-4 justify-center">
                <Button variant="outline" onClick={restart}>
                  <RotateCcw className="mr-2 h-4 w-4" />
                  Run It Again
                </Button>
                <Link to={`/study/${id}`}>
                  <Button variant="hero">Study This Set</Button>
                </Link>
              </div>
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
          <div className="flex items-center gap-4">
            <Link to="/" aria-label="Back to home">
              <Button variant="ghost" size="icon" aria-label="Back to home">
                <ArrowLeft className="h-5 w-5" />
              </Button>
            </Link>
            <div>
              <h1 className="font-bold font-display">{setName}</h1>
              <p className="text-sm text-muted-foreground">
                Term {currentIndex + 1} of {items.length}
              </p>
            </div>
          </div>
        </div>
      </header>

      <div className="container mx-auto max-w-2xl px-6 pt-4">
        <Progress
          value={((currentIndex + 1) / items.length) * 100}
          className="h-2"
          aria-label={`First pass progress: term ${currentIndex + 1} of ${items.length}`}
        />
      </div>

      <main className="container mx-auto max-w-2xl px-6 py-8">
        <Card className="shadow-card animate-slide-up">
          <CardContent className="p-8">
            <div className="flex justify-center mb-6">
              <span className="px-3 py-1 rounded-full text-sm font-medium bg-accent/10 text-accent">
                ✍️ First Pass — copy what you see
              </span>
            </div>

            <div className="text-center mb-8">
              <div className="flex items-center justify-center gap-3 mb-2">
                <p className="text-3xl font-serif font-semibold text-foreground">{currentItem.term}</p>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => speak(currentItem.term, language)}
                  aria-label={`Hear the ${langLabel} word`}
                >
                  <Volume2 className="h-5 w-5" />
                </Button>
              </div>
              <p className="text-xl text-muted-foreground">{currentItem.definition}</p>
            </div>

            <div className="space-y-6">
              <div className="space-y-2">
                <label className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  {langLabel} word
                  {termMatches && <Check className="h-4 w-4 text-success" />}
                </label>
                <Input
                  ref={termRef}
                  placeholder={`Retype the ${langLabel} word...`}
                  value={termInput}
                  onChange={(e) => setTermInput(e.target.value)}
                  className={`text-lg text-center py-6 ${
                    termInput ? (termMatches ? "border-success bg-success/5" : "border-destructive/40") : ""
                  }`}
                  autoFocus
                />
                <AccentButtons
                  inputRef={termRef}
                  value={termInput}
                  onChange={setTermInput}
                  language={language}
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  English meaning
                  {definitionMatches && <Check className="h-4 w-4 text-success" />}
                </label>
                <Input
                  ref={definitionRef}
                  placeholder="Retype the English meaning..."
                  value={definitionInput}
                  onChange={(e) => setDefinitionInput(e.target.value)}
                  className={`text-lg text-center py-6 ${
                    definitionInput
                      ? definitionMatches
                        ? "border-success bg-success/5"
                        : "border-destructive/40"
                      : ""
                  }`}
                />
              </div>

              <Button variant="hero" className="w-full" onClick={nextItem} disabled={!bothMatch}>
                {currentIndex < items.length - 1 ? "Next Term" : "Finish First Pass"}
              </Button>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

export default FirstPass;
