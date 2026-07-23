import { useEffect, useState, useCallback, useMemo } from "react";
import { useNavigate, Link, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { Dumbbell } from "lucide-react";
import { toast } from "sonner";
import { QuizSession, QuizQuestion, QuestionType } from "@/components/QuizSession";
import { useAnalytics } from "@repo/analytics";

interface VocabularyItem {
  id: string;
  term: string;
  definition: string;
  set_id: string;
}

const generateQuestions = (
  items: VocabularyItem[],
  setLanguageMap: Record<string, string>,
  allowedTypes: QuestionType[],
): QuizQuestion[] => {
  const types = allowedTypes.length > 0 ? allowedTypes : (["fr-to-en", "en-to-fr", "dictation"] as QuestionType[]);
  const questions: QuizQuestion[] = [];

  items.forEach((item) => {
    const language = setLanguageMap[item.set_id] || "french";
    const langLabel = language === "spanish" ? "Spanish" : "French";
    const type = types[Math.floor(Math.random() * types.length)];
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

    questions.push({ item, type, prompt, answer, language });
  });

  return questions.sort(() => Math.random() - 0.5);
};

const VALID_TYPES: QuestionType[] = ["fr-to-en", "en-to-fr", "dictation"];

const Practice = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const rawCount = parseInt(searchParams.get("count") || "20", 10);
  const count = Number.isFinite(rawCount) ? Math.min(Math.max(rawCount, 5), 200) : 20;
  const typesParam = searchParams.get("types") || "fr-to-en,en-to-fr,dictation";
  // Memoised on the raw param string: a fresh array each render would change the
  // identity of the fetch callback below and refetch on every render.
  const allowedTypes = useMemo(
    () => typesParam.split(",").filter((t): t is QuestionType => VALID_TYPES.includes(t as QuestionType)),
    [typesParam],
  );
  // When set, practice is scoped to the mastered items in one folder's sets.
  const folderId = searchParams.get("folder");
  const backTo = folderId ? `/folder/${folderId}` : "/";
  const { track } = useAnalytics();

  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchMasteredItems = useCallback(async () => {
    try {
      // Sample the session in Postgres: one round trip returns exactly `count`
      // random mastered items with their set language already joined, instead of
      // downloading the whole mastered library to shuffle and slice on the client.
      // Folder practice runs the same sampling, filtered to that folder's sets.
      const { data, error } = folderId
        ? await supabase.rpc("practice_sample_folder", { sample_count: count, target_folder: folderId })
        : await supabase.rpc("practice_sample", { sample_count: count });

      if (error) throw error;

      if (!data || data.length === 0) {
        toast.error(
          folderId
            ? "No mastered items in this folder yet. Study its sets first!"
            : "No mastered items found. Complete some vocabulary sets first!",
        );
        navigate(backTo);
        return;
      }

      if (data.length < count) {
        toast.info(`Only ${data.length} mastered items available`);
      }

      const items: VocabularyItem[] = data.map((r) => ({
        id: r.id,
        term: r.term,
        definition: r.definition,
        set_id: r.set_id,
      }));

      const setLanguageMap: Record<string, string> = {};
      data.forEach((r) => {
        setLanguageMap[r.set_id] = r.language || "french";
      });

      setQuestions(generateQuestions(items, setLanguageMap, allowedTypes));
    } catch (error) {
      console.error("Error fetching mastered items:", error);
      toast.error("Failed to load practice items");
      navigate(backTo);
    } finally {
      setLoading(false);
    }
  }, [count, folderId, allowedTypes, backTo, navigate]);

  useEffect(() => {
    fetchMasteredItems();
  }, [fetchMasteredItems]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-pulse text-muted-foreground">Loading practice session...</div>
      </div>
    );
  }

  return (
    <>
      <QuizSession
        questions={questions}
        onComplete={(s) => track("practice_complete", { size: s.cards, source: folderId ? "folder" : "cross_set" })}
        title="Practice Mode"
      requeueIncorrect
      completionTitle="Practice Complete!"
      completionSubtitle={folderId ? "Folder Review" : "Cross-Set Review"}
      completionActions={
        <>
          <Link to={folderId ? `/practice-setup?folder=${folderId}` : "/practice-setup"}>
            <Button variant="outline">
              <Dumbbell className="mr-2 h-4 w-4" />
              Practice Again
            </Button>
          </Link>
          <Link to={backTo}>
            <Button variant="hero">{folderId ? "Back to Folder" : "Back to Sets"}</Button>
          </Link>
        </>
      }
      />
    </>
  );
};

export default Practice;
