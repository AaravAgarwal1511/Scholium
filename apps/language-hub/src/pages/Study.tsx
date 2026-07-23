import { useEffect, useState, useCallback } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { ArrowLeft, RotateCcw, Shuffle, Trophy } from "lucide-react";
import { toast } from "sonner";
import { QuizSession, QuizQuestion, QuestionType } from "@/components/QuizSession";
import { useAnalytics } from "@repo/analytics";

interface VocabularyItem {
  id: string;
  term: string;
  definition: string;
}

const generateQuestions = (items: VocabularyItem[], lang: string): QuizQuestion[] => {
  const types: QuestionType[] = ["fr-to-en", "en-to-fr", "dictation"];
  const langLabel = lang === "spanish" ? "Spanish" : "French";
  const questions: QuizQuestion[] = [];

  items.forEach((item) => {
    types.forEach((type) => {
      let prompt = "";
      let answer = "";
      switch (type) {
        case "fr-to-en":
          prompt = `Translate to English: "${item.term}"`;
          answer = item.definition;
          break;
        case "en-to-fr":
          prompt = `Translate to ${langLabel}: "${item.definition}"`;
          answer = item.term;
          break;
        case "dictation":
          prompt = `Listen and write the ${langLabel} word:`;
          answer = item.term;
          break;
      }
      questions.push({ item, type, prompt, answer, language: lang });
    });
  });

  return questions.sort(() => Math.random() - 0.5);
};

const Study = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { track } = useAnalytics();

  const [setName, setSetName] = useState("");
  const [setLanguage, setSetLanguage] = useState("french");
  const [items, setItems] = useState<VocabularyItem[]>([]);
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [allComplete, setAllComplete] = useState(false);
  const [sessionKey, setSessionKey] = useState(0);

  const fetchSet = useCallback(async () => {
    try {
      const { data: setData, error: setError } = await supabase
        .from("vocabulary_sets")
        .select("*")
        .eq("id", id)
        .single();

      if (setError) throw setError;
      setSetName(setData.name);
      const lang = setData.language || "french";
      setSetLanguage(lang);

      const { data: itemsData, error: itemsError } = await supabase
        .from("vocabulary_items")
        .select("*")
        .eq("set_id", id);

      if (itemsError) throw itemsError;

      if (!itemsData || itemsData.length === 0) {
        toast.error("This set has no vocabulary items");
        navigate("/");
        return;
      }

      const { data: progressData } = await supabase
        .from("set_progress")
        .select("item_id, correct_count")
        .eq("set_id", id);

      const completedItems = new Set<string>();
      progressData?.forEach((p) => {
        if (p.correct_count >= 3) completedItems.add(p.item_id);
      });

      setItems(itemsData);

      const remaining = itemsData.filter((item) => !completedItems.has(item.id));
      if (remaining.length === 0) {
        setAllComplete(true);
        setQuestions(generateQuestions(itemsData, lang));
      } else {
        setQuestions(generateQuestions(remaining, lang));
      }
    } catch (error) {
      console.error("Error fetching set:", error);
      toast.error("Failed to load vocabulary set");
      navigate("/");
    } finally {
      setLoading(false);
    }
  }, [id, navigate]);

  useEffect(() => {
    if (id) fetchSet();
  }, [id, fetchSet]);

  const updateProgress = async (question: QuizQuestion) => {
    const { data: existing } = await supabase
      .from("set_progress")
      .select("id, correct_count")
      .eq("set_id", id)
      .eq("item_id", question.item.id)
      .maybeSingle();

    const newCount = (existing?.correct_count || 0) + 1;

    if (existing) {
      await supabase
        .from("set_progress")
        .update({ correct_count: newCount, mastered: newCount >= 3, last_practiced: new Date().toISOString() })
        .eq("id", existing.id);
    } else {
      await supabase.from("set_progress").insert({
        set_id: id,
        item_id: question.item.id,
        correct_count: newCount,
        mastered: newCount >= 3,
        last_practiced: new Date().toISOString(),
        user_id: user?.id,
      });
    }
  };

  const restartStudy = () => {
    setAllComplete(false);
    setQuestions(generateQuestions(items, setLanguage));
    setSessionKey((k) => k + 1);
    supabase.from("set_progress").delete().eq("set_id", id)
      .then(({ error }) => { if (error) toast.error('Failed to reset progress'); });
  };

  const completionActions = (
    <>
      <Button variant="outline" onClick={restartStudy}>
        <RotateCcw className="mr-2 h-4 w-4" />
        Study Again
      </Button>
      <Link to="/">
        <Button variant="hero">Back to Sets</Button>
      </Link>
    </>
  );

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-pulse text-muted-foreground">Loading...</div>
      </div>
    );
  }

  if (allComplete) {
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
              <h2 className="text-3xl font-bold font-display mb-2">Set Complete!</h2>
              <p className="text-xl text-muted-foreground mb-6">{setName}</p>
              <div className="text-6xl font-bold text-primary mb-2">
                100%
              </div>
              <p className="text-muted-foreground mb-8">All items already mastered</p>
              <div className="flex gap-4 justify-center">{completionActions}</div>
            </CardContent>
          </Card>
        </main>
      </div>
    );
  }

  return (
    <QuizSession
      key={sessionKey}
      questions={questions}
      title={setName}
      onComplete={(s) => track("study_complete", { set_id: id ?? "", cards: s.cards, correct: s.correct })}
      headerActions={
        <Button variant="ghost" size="sm" onClick={restartStudy}>
          <Shuffle className="h-4 w-4" />
        </Button>
      }
      onCorrectAnswer={updateProgress}
      completionTitle="Set Complete!"
      completionSubtitle={setName}
      completionActions={completionActions}
    />
  );
};

export default Study;
