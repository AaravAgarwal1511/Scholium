import { useState, useEffect, useMemo, useRef } from "react";
import { useNavigate, useLocation, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { useAnalytics } from "@repo/analytics";
import { Zap, Download, AlertCircle, CheckCircle2, ExternalLink } from "lucide-react";
import Layout from "@/components/Layout";
import Tetris from "@/components/Tetris";
import CalculatorAlert from "@/components/CalculatorAlert";
import { EmptyState } from "@/components/StateViews";
import SavedPapersPanel from "@/components/SavedPapersPanel";
import { useAsync } from "@/hooks/useAsync";
import { useAuth } from "@/contexts/AuthContext";
import { stageForMockSpace, MOCK_SPACE_URL } from "@/lib/mockSpaceHandoff";
import { savePaper } from "@/lib/savedPapers";
import {
  loadGeneratorSession,
  saveGeneratorSession,
  resultToRecipe,
  type GeneratorResult,
} from "@/lib/generatorSession";
import {
  listSubjects,
  listComponents,
  listChapters,
  getChapterQuestions,
  generatePaper,
  downloadPaper,
  paperNumOf,
  subjectDisplayName,
  estimateGenerationSeconds,
  MAX_GENERATED_QUESTIONS,
  type ChapterQuestion,
} from "@/lib/papers";

type SelectionMap = {
  [chapterNum: number]: number; // chapter -> question count
};

type ChapterInfo = { number: number; name: string; questions: ChapterQuestion[] };

const selectClass =
  "rounded-lg border border-border bg-background px-2.5 py-1.5 text-sm font-medium text-foreground focus:outline-none focus:border-primary";

// Same control as the one on ChaptersPage, applied to the pool the generator
// draws from rather than to a prebuilt chapter download.
function YearRangeBar({
  years,
  yearFrom,
  yearTo,
  onFrom,
  onTo,
}: {
  years: number[];
  yearFrom: number;
  yearTo: number;
  onFrom: (y: number) => void;
  onTo: (y: number) => void;
}) {
  return (
    <div className="mb-4 rounded-xl border border-border bg-card p-4">
      <div className="flex flex-wrap items-center gap-2">
        <label className="text-sm font-medium text-foreground" htmlFor="generate-year-from">
          Years
        </label>
        <select
          id="generate-year-from"
          className={selectClass}
          value={yearFrom}
          onChange={(e) => onFrom(Number(e.target.value))}
        >
          {years.map((y) => (
            <option key={y} value={y}>
              {y}
            </option>
          ))}
        </select>
        <span className="text-sm text-muted-foreground">to</span>
        <select
          className={selectClass}
          value={yearTo}
          aria-label="Latest year"
          onChange={(e) => onTo(Number(e.target.value))}
        >
          {years
            .filter((y) => y >= yearFrom)
            .map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
        </select>
      </div>
      <p className="mt-3 text-xs text-muted-foreground">
        Questions are drawn only from exams in this range. Narrowing it lowers how many each
        chapter can offer.
      </p>
    </div>
  );
}

// Shown while the server composes the paper. Large papers read every source PDF
// from R2 over HTTP, so this can run tens of seconds — the progress bar tracks a
// measured estimate (see estimateGenerationSeconds) and there's a game of Tetris
// to pass the time.
function GeneratingOverlay({
  elapsed,
  estimate,
}: {
  elapsed: number;
  estimate: number;
}) {
  const progress = Math.min(elapsed / Math.max(estimate, 1), 0.99);
  const remaining = Math.max(0, Math.ceil(estimate - elapsed));

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "hsl(var(--background) / 0.8)", backdropFilter: "blur(4px)" }}
      role="dialog"
      aria-label="Generating paper"
    >
      <div
        className="w-full max-w-md rounded-2xl border border-border bg-card p-6"
        style={{ boxShadow: "var(--shadow-card)" }}
      >
        <div className="flex items-center gap-3 mb-1">
          <div className="p-2 rounded-lg bg-accent/10">
            <Zap size={18} className="text-accent" />
          </div>
          <h2 className="font-display font-bold text-lg">Building your paper…</h2>
        </div>
        <p className="text-sm text-muted-foreground mb-4">
          {elapsed < estimate
            ? `About ${remaining}s to go — cropping and stitching questions from each exam.`
            : "Almost there — finishing up the last few pages."}
        </p>

        <div className="h-2 w-full rounded-full bg-muted overflow-hidden mb-2">
          <div
            className="h-full rounded-full transition-[width] duration-200 ease-linear"
            style={{ width: `${progress * 100}%`, background: "hsl(var(--primary))" }}
          />
        </div>
        <div className="flex justify-between text-xs text-muted-foreground tabular-nums mb-5">
          <span>{elapsed.toFixed(0)}s elapsed</span>
          <span>~{estimate}s estimated</span>
        </div>

        <div className="rounded-xl border border-border bg-background/50 p-4">
          <p className="text-xs font-medium text-muted-foreground mb-3 text-center">
            A game while you wait
          </p>
          <Tetris />
        </div>
      </div>
    </div>
  );
}

interface GeneratePaperPageProps {
  description?: string | null;
}

export default function GeneratePaperPage({ description }: GeneratePaperPageProps = {}) {
  const { track } = useAnalytics();
  const { user, loadingAuth } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  // Every field below hydrates from the last-saved generator session on first
  // render, so a remount — most importantly the /signin round trip, since
  // Auth.tsx always navigates away from and back to this page — doesn't lose
  // the user's selections. See the persistence effect further down and
  // `@/lib/generatorSession` for what's actually stored and why.
  const [selectedSubject, setSelectedSubject] = useState<string | null>(
    () => loadGeneratorSession()?.selectedSubject ?? null
  );
  const [selectedComponent, setSelectedComponent] = useState<string | null>(
    () => loadGeneratorSession()?.selectedComponent ?? null
  );
  const [selections, setSelections] = useState<SelectionMap>(
    () => loadGeneratorSession()?.selections ?? {}
  );
  const [chapters, setChapters] = useState<ChapterInfo[]>([]);
  const [loadingChapters, setLoadingChapters] = useState(false);
  const [pickedFrom, setPickedFrom] = useState<number | null>(
    () => loadGeneratorSession()?.pickedFrom ?? null
  );
  const [pickedTo, setPickedTo] = useState<number | null>(
    () => loadGeneratorSession()?.pickedTo ?? null
  );
  const [includeMarkScheme, setIncludeMarkScheme] = useState(
    () => loadGeneratorSession()?.includeMarkScheme ?? true
  );
  const [randomize, setRandomize] = useState(() => loadGeneratorSession()?.randomize ?? true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [estimate, setEstimate] = useState(0);
  const [generateError, setGenerateError] = useState<string | null>(null);
  // The blob variant can't be restored directly (a Blob doesn't survive
  // sessionStorage's JSON serialisation) — only the r2-backed variant hydrates
  // here. The mount-time restore effect below recomposes a pending blob
  // result from its recipe instead.
  const [result, setResult] = useState<GeneratorResult | null>(() => {
    const recipe = loadGeneratorSession()?.resultRecipe;
    if (!recipe?.r2) return null;
    return {
      paper: { kind: "url", url: recipe.r2.url, key: recipe.r2.key, mcq: null },
      fileName: recipe.fileName,
      subject: recipe.subject,
      questionIds: recipe.questionIds,
      includeMarkScheme: recipe.includeMarkScheme,
      randomize: recipe.randomize,
    };
  });
  const [handingOff, setHandingOff] = useState(false);
  // Bumped after a successful save so SavedPapersPanel re-fetches its list —
  // simpler than lifting the panel's own list state up into this component.
  const [savedPapersRefresh, setSavedPapersRefresh] = useState(0);
  // True for a few seconds right after a paper finishes generating, driving the
  // one-shot attention ring on the primary action below (see the effect below).
  const [justGenerated, setJustGenerated] = useState(false);
  const resultSectionRef = useRef<HTMLElement>(null);

  // Recomposes a pending `{kind:"blob"}` result on mount — the one case the
  // lazy `result` initializer above can't restore directly, since a Blob
  // doesn't survive sessionStorage's JSON serialisation. Same questionIds and
  // options as the original generation, so this reproduces the identical PDF
  // rather than re-sampling a different one. Mount-only: this restores
  // whatever was pending when the page last unmounted, not a live sync.
  useEffect(() => {
    const recipe = loadGeneratorSession()?.resultRecipe;
    if (!recipe || recipe.r2) return;
    let cancelled = false;
    setEstimate(estimateGenerationSeconds(recipe.questionIds.length));
    setIsGenerating(true);
    generatePaper(recipe.subject, recipe.questionIds, {
      includeMarkScheme: recipe.includeMarkScheme,
      randomize: recipe.randomize,
      fileName: recipe.fileName,
    })
      .then((paper) => {
        if (cancelled) return;
        setResult({
          paper,
          fileName: recipe.fileName,
          subject: recipe.subject,
          questionIds: recipe.questionIds,
          includeMarkScheme: recipe.includeMarkScheme,
          randomize: recipe.randomize,
        });
      })
      .catch(() => {
        // The paper genuinely can't be reconstructed (e.g. a source PDF
        // moved). Drop it quietly rather than surface an error for a page
        // the user didn't just act on — they can just generate again.
      })
      .finally(() => {
        if (!cancelled) setIsGenerating(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Write-through: keeps the saved session in sync with every change, so
  // whichever value is current is what a remount restores. Cheap (a few KB of
  // JSON, sessionStorage is synchronous) and safe to run on every change —
  // the very first run just re-saves the values the state above already
  // hydrated from, so nothing is lost between hydration and this effect.
  useEffect(() => {
    saveGeneratorSession({
      selectedSubject,
      selectedComponent,
      selections,
      pickedFrom,
      pickedTo,
      includeMarkScheme,
      randomize,
      resultRecipe: resultToRecipe(result),
    });
  }, [
    selectedSubject,
    selectedComponent,
    selections,
    pickedFrom,
    pickedTo,
    includeMarkScheme,
    randomize,
    result,
  ]);

  // Count up while a paper is composing, so the overlay can show elapsed time and
  // advance the progress bar against the estimate.
  useEffect(() => {
    if (!isGenerating) return;
    setElapsed(0);
    const start = performance.now();
    const id = setInterval(() => setElapsed((performance.now() - start) / 1000), 200);
    return () => clearInterval(id);
  }, [isGenerating]);

  // A fresh result scrolls itself into view and briefly rings the primary
  // action, so a paper generated below the fold doesn't go unnoticed.
  useEffect(() => {
    if (!result) return;
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    resultSectionRef.current?.scrollIntoView({
      behavior: reduceMotion ? "auto" : "smooth",
      block: "start",
    });
    setJustGenerated(true);
    const id = setTimeout(() => setJustGenerated(false), 2400);
    return () => clearTimeout(id);
  }, [result]);

  // Load subjects
  const { data: subjects, loading: loadingSubjects } = useAsync(
    () => listSubjects(),
    []
  );

  // The static /papers/<code>[/<component>[/topics/<slug>]] pages
  // (scripts/build-subject-pages.js) link back here with `?subject=<code>`,
  // optionally plus `&component=<slug>&chapter=<n>` — honor each once the
  // data it needs has loaded, so the deep link actually preselects instead of
  // landing on an empty picker. Each is applied at most once per page load: a
  // ref, not a dependency-array check, since `searchParams` and the loaded
  // arrays are new objects on every render and would otherwise re-fire this
  // forever.
  const [searchParams] = useSearchParams();
  const appliedSubjectFromUrl = useRef(false);
  useEffect(() => {
    if (appliedSubjectFromUrl.current || !subjects) return;
    appliedSubjectFromUrl.current = true;
    const requested = searchParams.get("subject");
    if (requested && subjects.includes(requested)) {
      setSelectedSubject(requested);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subjects]);

  // Load components for selected subject
  const { data: components, loading: loadingComponents } = useAsync(
    () =>
      selectedSubject ? listComponents(selectedSubject) : Promise.resolve([]),
    [selectedSubject]
  );

  // `component` is a URL-friendly slug ("paper-1"); components load as their
  // raw label ("Paper 1"). paperNumOf() already extracts the number from
  // either shape, so matching on that number sidesteps needing a slugify()
  // here too.
  const appliedComponentFromUrl = useRef(false);
  useEffect(() => {
    if (appliedComponentFromUrl.current || !selectedSubject || !components) return;
    appliedComponentFromUrl.current = true;
    const requested = searchParams.get("component");
    if (!requested) return;
    const requestedNum = paperNumOf(requested);
    const match = components.find((c) => paperNumOf(c) === requestedNum);
    if (match) setSelectedComponent(match);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [components]);

  // Load chapters (with their questions and exam years) for the selected subject
  // + paper. Questions are restricted to the chosen paper via the P<n>- id
  // prefix, so Paper 1 only ever offers Paper 1 questions, etc.
  useEffect(() => {
    if (!selectedSubject || !selectedComponent) {
      setChapters([]);
      return;
    }
    const subject = selectedSubject;
    const paperNum = paperNumOf(selectedComponent);
    let cancelled = false;
    setLoadingChapters(true);
    (async () => {
      try {
        const [entries, questionsByChapter] = await Promise.all([
          listChapters(subject, selectedComponent),
          getChapterQuestions(subject, paperNum),
        ]);
        if (!cancelled) {
          setChapters(
            entries
              .map((e) => ({
                number: e.number,
                name: e.name,
                questions: questionsByChapter.get(e.number) ?? [],
              }))
              .filter((c) => c.questions.length > 0)
              .sort((a, b) => a.number - b.number)
          );
        }
      } catch {
        if (!cancelled) setChapters([]);
      } finally {
        if (!cancelled) setLoadingChapters(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [selectedSubject, selectedComponent]);

  // `chapter` selects a default question count once its chapter has loaded.
  // Reads `match.questions.length` directly rather than the year-filtered
  // `idsInRange` (defined below): a fresh deep link lands before the year
  // pickers have been touched, so the range already defaults to "everything"
  // and the two counts agree — this just avoids depending on a value defined
  // later in the component purely for this one-shot read.
  const appliedChapterFromUrl = useRef(false);
  useEffect(() => {
    if (appliedChapterFromUrl.current || !selectedComponent || chapters.length === 0) return;
    appliedChapterFromUrl.current = true;
    const requestedRaw = searchParams.get("chapter");
    const requested = requestedRaw ? Number(requestedRaw) : null;
    if (!Number.isFinite(requested)) return;
    const match = chapters.find((c) => c.number === requested);
    if (match && match.questions.length > 0) {
      handleChapterToggle(match.number, Math.min(5, match.questions.length));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chapters]);

  // Every year this component has, across all its chapters. Derived rather than
  // held in state, so it can't fall out of step with the loaded chapters.
  const allYears = useMemo(() => {
    const seen = new Set<number>();
    for (const ch of chapters) for (const q of ch.questions) seen.add(q.year);
    return Array.from(seen).sort((a, b) => a - b);
  }, [chapters]);

  // `allYears` only exists once the chapters have loaded, so the range defaults
  // to "everything" lazily rather than being captured as initial state.
  const minYear = allYears[0] ?? 0;
  const maxYear = allYears[allYears.length - 1] ?? 0;
  const yearFrom = pickedFrom ?? minYear;
  const yearTo = pickedTo ?? maxYear;

  // The pool each chapter can actually draw from under the current year range.
  const idsInRange = useMemo(
    () =>
      new Map(
        chapters.map((ch) => [
          ch.number,
          ch.questions.filter((q) => q.year >= yearFrom && q.year <= yearTo).map((q) => q.id),
        ])
      ),
    [chapters, yearFrom, yearTo]
  );

  const availableIn = (chapter: number) => idsInRange.get(chapter)?.length ?? 0;

  // True for the render(s) between picking (or restoring) a subject/component
  // and the chapters actually arriving — `idsInRange` is an empty Map for that
  // whole window, indistinguishable from "nothing is available" to the effect
  // below. Computed synchronously from render state rather than `loadingChapters`:
  // that state flag doesn't flip to true until a render after this one, which
  // is one render too late to guard the very first pass — the case that
  // matters when selections are restored from a saved session on mount, with
  // `selectedSubject`/`selectedComponent` already set and `chapters` still [].
  const chaptersPending = !!selectedSubject && !!selectedComponent && chapters.length === 0;

  // Narrowing the years can leave a chapter with fewer questions than the user
  // already asked for — or with none at all. Bring the counts back inside what
  // the range can supply instead of letting generation fail on them later.
  useEffect(() => {
    if (chaptersPending) return;
    setSelections((prev) => {
      const next: SelectionMap = {};
      let changed = false;
      for (const [key, count] of Object.entries(prev)) {
        const available = idsInRange.get(Number(key))?.length ?? 0;
        if (available === 0) {
          changed = true;
          continue;
        }
        if (count > available) changed = true;
        next[Number(key)] = Math.min(count, available);
      }
      return changed ? next : prev;
    });
  }, [idsInRange, chaptersPending]);

  const resetSelection = () => {
    setSelections({});
    setPickedFrom(null);
    setPickedTo(null);
    setGenerateError(null);
    setResult(null);
  };

  const handleSubjectSelect = (subject: string) => {
    setSelectedSubject(subject);
    setSelectedComponent(null);
    resetSelection();
  };

  const handleComponentSelect = (component: string) => {
    setSelectedComponent(component);
    resetSelection();
  };

  const handleYearFrom = (next: number) => {
    setPickedFrom(next);
    if (next > yearTo) setPickedTo(next);
    setGenerateError(null);
    setResult(null);
  };

  const handleYearTo = (next: number) => {
    setPickedTo(next);
    setGenerateError(null);
    setResult(null);
  };

  const handleChapterToggle = (chapter: number, count: number) => {
    setSelections((prev) => {
      const updated = { ...prev };
      if (count === 0) {
        delete updated[chapter];
      } else {
        updated[chapter] = count;
      }
      return updated;
    });
    setGenerateError(null);
    setResult(null);
  };

  // Components that became non-calculator with the 2025 syllabus, keyed by
  // subject code -> paper number: Additional Mathematics (0606) Paper 1, and
  // Mathematics (0580) Paper 2 (the reform split 0580 into non-calculator
  // Paper 2 / calculator Paper 4). A generated paper spanning that boundary can
  // pull pre-2025 questions that assume a calculator (see CalculatorAlert).
  const NON_CALCULATOR_2025: Record<string, number> = { "0606": 1, "0580": 2 };
  const nonCalcPaperNum =
    selectedSubject != null ? NON_CALCULATOR_2025[selectedSubject] : undefined;
  const showCalculatorAlert =
    nonCalcPaperNum !== undefined &&
    !!selectedComponent &&
    paperNumOf(selectedComponent) === nonCalcPaperNum;

  const selectedChapters = Object.keys(selections).map(Number);
  const totalQuestions = Object.values(selections).reduce((a, b) => a + b, 0);
  const overLimit = totalQuestions > MAX_GENERATED_QUESTIONS;
  const estimatedTime = Math.round(totalQuestions * 2.5);
  const chapterName = (n: number) =>
    chapters.find((c) => c.number === n)?.name ?? "Unknown";

  const handleGenerate = async () => {
    if (!selectedSubject || totalQuestions === 0) {
      setGenerateError("Please select at least one chapter with questions");
      return;
    }
    if (overLimit) {
      setGenerateError(
        `Too many questions (${totalQuestions}). One paper can hold at most ${MAX_GENERATED_QUESTIONS}.`
      );
      return;
    }

    setEstimate(estimateGenerationSeconds(totalQuestions));
    setIsGenerating(true);
    setGenerateError(null);
    setResult(null);
    track("generate_submit", {
      subject: selectedSubject,
      component: selectedComponent ?? "",
      n_questions: totalQuestions,
    });
    const startedAt = Date.now();

    try {
      // For each selected chapter, randomly pick the requested number of ids
      // from the questions the chosen year range leaves available.
      const selectedQuestionIds: string[] = [];

      for (const chapter of selectedChapters) {
        const ids = idsInRange.get(chapter) ?? [];
        if (ids.length === 0) {
          throw new Error(
            `Chapter ${chapter} has no questions between ${yearFrom} and ${yearTo}`
          );
        }
        const requested = selections[chapter];
        const shuffled = [...ids].sort(() => Math.random() - 0.5);
        selectedQuestionIds.push(
          ...shuffled.slice(0, Math.min(requested, shuffled.length))
        );
      }

      const timestamp = new Date().toISOString().slice(0, 10);
      const fileName = `${subjectDisplayName(selectedSubject)}-${selectedComponent}-${timestamp}.pdf`;

      const paper = await generatePaper(selectedSubject, selectedQuestionIds, {
        includeMarkScheme,
        randomize,
        fileName,
      });

      track("generate_complete", {
        duration_ms: Date.now() - startedAt,
        questions: selectedQuestionIds.length,
      });

      setResult({
        paper,
        fileName,
        subject: selectedSubject,
        questionIds: selectedQuestionIds,
        includeMarkScheme,
        randomize,
      });

      // Signed-out users generate exactly as they always could — this is the
      // one thing an account adds. Best-effort: the paper is already in hand
      // regardless of whether the history write succeeds, and "Generate Paper"
      // is right there to try again.
      if (user) {
        savePaper(user.id, {
          subject: selectedSubject,
          component: selectedComponent ?? "",
          fileName,
          questionIds: selectedQuestionIds,
          includeMarkScheme,
          randomize,
          r2Key: paper.kind === "url" ? paper.key : null,
        })
          .then(() => setSavedPapersRefresh((n) => n + 1))
          .catch(() => {});
      }
    } catch (error) {
      track("generate_failed", {
        reason: error instanceof Error ? error.message.slice(0, 64) : "unknown",
      });
      setGenerateError(
        error instanceof Error ? error.message : "Failed to generate paper"
      );
      console.error("Generation error:", error);
    } finally {
      setIsGenerating(false);
    }
  };

  // Uploads the generated paper into the user's mock-space-papers folder and
  // deep-links to mock-space's /open route, which downloads it back out, starts
  // an attempt, and deletes this handoff copy. The button below only calls this
  // when signed in — a signed-out click routes to /signin?next=... instead —
  // so `user` is always set here.
  //
  // Deliberately does NOT open a blank tab up front and fill it in later: that
  // leaves an "about:blank" tab sitting there for however long the upload takes,
  // which reads as broken rather than loading. window.open is only ever called
  // with the real destination, so the new tab shows real content the instant it
  // exists. The tradeoff is that on a slow upload the browser's popup blocker
  // can refuse a window.open this far from the click that started it — a toast
  // with its own "Open" action is the recovery path, since that click is a
  // fresh user gesture and is never itself blocked.
  const handleOpenInMockSpace = async () => {
    if (!result || !user) return;
    setHandingOff(true);
    setGenerateError(null);
    try {
      const id = await stageForMockSpace(user.id, result.paper);
      const title = result.fileName.replace(/\.pdf$/i, "");
      // The flag is a hint, not the authority — stageForMockSpace stages the
      // sidecar whenever result.paper.mcq is set, and /open falls back to an
      // ordinary attempt if that sidecar can't be found or doesn't validate.
      const mcqFlag = result.paper.mcq ? "&mcq=1" : "";
      const openInMockSpaceLabel = result.paper.mcq
        ? "Open in Mock Space (in MCQ Mode)"
        : "Open in Mock Space";
      const url = `${MOCK_SPACE_URL}/open?paper=${id}&title=${encodeURIComponent(title)}${mcqFlag}`;
      const tab = window.open(url, "_blank");
      if (tab) {
        tab.opener = null;
      } else {
        toast.error("Your browser blocked the new tab", {
          description: "Your paper is ready — open it in Mock Space when you're set.",
          action: {
            label: openInMockSpaceLabel,
            onClick: () => {
              const retry = window.open(url, "_blank");
              if (retry) retry.opener = null;
            },
          },
        });
      }
    } catch (error) {
      setGenerateError(
        error instanceof Error ? error.message : "Could not open this paper in Mock Space"
      );
    } finally {
      setHandingOff(false);
    }
  };

  return (
    <Layout subtitle={description ?? undefined}>
      {isGenerating && <GeneratingOverlay elapsed={elapsed} estimate={estimate} />}

      <div className="mb-8">
        <div className="flex items-center gap-3 mb-3">
          <div className="p-2 rounded-lg bg-accent/10">
            <Zap size={20} className="text-accent" />
          </div>
          <h2 className="font-display font-bold text-3xl">Generate Paper</h2>
        </div>
        <p className="text-muted-foreground text-sm">
          Select chapters and the number of questions you want from each. Questions are picked at random.
        </p>
        <details className="mt-4 rounded-lg border border-border bg-card px-4 py-3 text-sm text-muted-foreground">
          <summary className="cursor-pointer font-medium text-foreground">
            How this is put together
          </summary>
          <div className="mt-2 space-y-2">
            <p>
              Every question here is a real Cambridge IGCSE past-paper question, cropped straight from
              the original exam PDF — not retyped or rewritten, so what you see is exactly what was
              printed.
            </p>
            <p>
              Each question is matched to its syllabus topic by an AI model (Claude Haiku 4.5) that's
              shown the question and constrained to Cambridge's own official topic list for that
              subject — it can only pick a real syllabus topic, never invent one. Mark schemes are
              matched to their question automatically by position and question number, not
              reclassified separately, so the answer you get always belongs to the question you're
              practising.
            </p>
            <p>
              These papers are sourced from publicly available past-paper archives. Scholium is an
              independent project and isn't affiliated with, endorsed by, or connected to Cambridge
              Assessment International Education.
            </p>
            <p>
              Spot a question filed under the wrong topic?{" "}
              <a href="mailto:admin@thescholium.com" className="underline hover:text-foreground">
                Let us know
              </a>
              .
            </p>
          </div>
        </details>
      </div>

      <SavedPapersPanel user={user} loadingAuth={loadingAuth} refreshSignal={savedPapersRefresh} />

      {/* Step 1: Subject Selection */}
      <section className="mb-8">
        <h2 className="font-display font-semibold text-lg mb-4 flex items-center gap-2">
          <span className="flex items-center justify-center w-7 h-7 rounded-full bg-primary/10 text-primary text-sm font-bold">
            1
          </span>
          Select Subject
        </h2>
        {loadingSubjects ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-12 rounded-lg bg-card animate-pulse" />
            ))}
          </div>
        ) : subjects && subjects.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {subjects.map((subject) => (
              <button
                key={subject}
                onClick={() => handleSubjectSelect(subject)}
                className="flex items-baseline gap-2 px-4 py-3 rounded-lg border-2 font-medium transition-all text-left"
                style={{
                  borderColor:
                    selectedSubject === subject
                      ? "hsl(var(--primary))"
                      : "hsl(var(--border))",
                  backgroundColor:
                    selectedSubject === subject
                      ? "hsl(var(--primary) / 0.08)"
                      : "transparent",
                  color:
                    selectedSubject === subject
                      ? "hsl(var(--primary))"
                      : "hsl(var(--foreground))",
                }}
              >
                <span>{subjectDisplayName(subject)}</span>
                {subjectDisplayName(subject) !== subject && (
                  <span className="text-xs font-normal tabular-nums opacity-60">
                    {subject}
                  </span>
                )}
              </button>
            ))}
          </div>
        ) : (
          <EmptyState
            title="No subjects available"
            hint="Upload papers to get started."
          />
        )}
      </section>

      {/* Step 2: Component Selection */}
      {selectedSubject && (
        <section className="mb-8">
          <h2 className="font-display font-semibold text-lg mb-4 flex items-center gap-2">
            <span className="flex items-center justify-center w-7 h-7 rounded-full bg-accent/10 text-accent text-sm font-bold">
              2
            </span>
            Select Component
          </h2>
          {loadingComponents ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="h-12 rounded-lg bg-card animate-pulse" />
              ))}
            </div>
          ) : components && components.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {components.map((component) => (
                <button
                  key={component}
                  onClick={() => handleComponentSelect(component)}
                  className="px-4 py-3 rounded-lg border-2 font-medium transition-all text-left"
                  style={{
                    borderColor:
                      selectedComponent === component
                        ? "hsl(var(--accent))"
                        : "hsl(var(--border))",
                    backgroundColor:
                      selectedComponent === component
                        ? "hsl(var(--accent) / 0.08)"
                        : "transparent",
                    color:
                      selectedComponent === component
                        ? "hsl(var(--accent))"
                        : "hsl(var(--foreground))",
                  }}
                >
                  {component}
                </button>
              ))}
            </div>
          ) : (
            <EmptyState
              title="No components available"
              hint="This subject has no components yet."
            />
          )}
        </section>
      )}

      {/* Step 3: Chapter Selection with Question Counts */}
      {selectedComponent && (
        <section className="mb-8">
          <h2 className="font-display font-semibold text-lg mb-4 flex items-center gap-2">
            <span className="flex items-center justify-center w-7 h-7 rounded-full bg-success/10 text-success text-sm font-bold">
              3
            </span>
            Choose Years, Chapters & Question Counts
          </h2>

          {showCalculatorAlert && <CalculatorAlert paperLabel={`Paper ${nonCalcPaperNum}`} />}

          {allYears.length > 0 && (
            <YearRangeBar
              years={allYears}
              yearFrom={yearFrom}
              yearTo={yearTo}
              onFrom={handleYearFrom}
              onTo={handleYearTo}
            />
          )}

          {loadingChapters ? (
            <div className="space-y-2">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="h-20 rounded-xl bg-card animate-pulse" />
              ))}
            </div>
          ) : chapters.length === 0 ? (
            <EmptyState
              title="No questions available"
              hint="This paper has no questions ready for generation yet."
            />
          ) : (
            <div className="space-y-2">
              {chapters.map((ch) => {
                const available = availableIn(ch.number);
                const isSelected = Object.prototype.hasOwnProperty.call(selections, ch.number);
                const questionCount = selections[ch.number] || 0;

                return (
                  <div
                    key={ch.number}
                    className="rounded-xl border-2 p-4 transition-all"
                    style={{
                      borderColor: isSelected
                        ? "hsl(var(--success))"
                        : "hsl(var(--border))",
                      backgroundColor: isSelected
                        ? "hsl(var(--success) / 0.04)"
                        : "transparent",
                      opacity: available === 0 ? 0.55 : 1,
                    }}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-start gap-3 flex-1">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          disabled={available === 0}
                          onChange={(e) => {
                            handleChapterToggle(
                              ch.number,
                              e.target.checked ? Math.min(5, available) : 0
                            );
                          }}
                          className="w-5 h-5 rounded mt-0.5 cursor-pointer disabled:cursor-not-allowed"
                          aria-label={`Select ${ch.name}`}
                        />
                        <div>
                          <label className="font-display font-semibold text-foreground block mb-1">
                            Chapter {ch.number}: {ch.name}
                          </label>
                          <p className="text-xs text-muted-foreground">
                            {available === 0
                              ? `Nothing from ${yearFrom}–${yearTo}`
                              : `${available} questions available`}
                          </p>
                        </div>
                      </div>
                      {isSelected && (
                        <div className="flex items-center gap-2">
                          <label
                            htmlFor={`generate-question-count-${ch.number}`}
                            className="text-xs font-medium text-muted-foreground"
                          >
                            Questions:
                          </label>
                          <input
                            id={`generate-question-count-${ch.number}`}
                            type="number"
                            min="1"
                            max={available}
                            value={questionCount}
                            onChange={(e) => {
                              const val = parseInt(e.target.value, 10);
                              if (!isNaN(val) && val > 0) {
                                handleChapterToggle(
                                  ch.number,
                                  Math.min(val, available)
                                );
                              }
                            }}
                            className="w-16 px-2 py-1 rounded border border-border bg-background text-foreground text-center text-sm font-medium focus:outline-none focus:border-success"
                          />
                          <span className="text-xs text-muted-foreground">
                            / {available}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      )}

      {/* Options and Summary */}
      {selectedComponent && totalQuestions > 0 && (
        <section className="mb-8 rounded-xl bg-gradient-to-br from-card to-card/50 border border-border p-5">
          <div className="space-y-4">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label htmlFor="generate-include-mark-scheme" className="text-sm font-medium">
                  Mark Scheme
                </label>
                <input
                  id="generate-include-mark-scheme"
                  type="checkbox"
                  checked={includeMarkScheme}
                  onChange={(e) => {
                    setIncludeMarkScheme(e.target.checked);
                    setResult(null);
                  }}
                  className="w-4 h-4 rounded cursor-pointer"
                />
              </div>
              <div className="flex items-center justify-between">
                <label htmlFor="generate-randomize-order" className="text-sm font-medium">
                  Randomize Order
                </label>
                <input
                  id="generate-randomize-order"
                  type="checkbox"
                  checked={randomize}
                  onChange={(e) => {
                    setRandomize(e.target.checked);
                    setResult(null);
                  }}
                  className="w-4 h-4 rounded cursor-pointer"
                />
              </div>
            </div>

            <div className="border-t border-border pt-4">
              <p className="text-xs font-medium text-muted-foreground mb-3">
                PAPER SUMMARY
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
                <div>
                  <p
                    className="text-2xl font-display font-bold"
                    style={{
                      color: overLimit
                        ? "hsl(var(--destructive))"
                        : "hsl(var(--foreground))",
                    }}
                  >
                    {totalQuestions}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Questions
                  </p>
                </div>
                <div>
                  <p className="text-2xl font-display font-bold text-foreground">
                    {selectedChapters.length}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Chapters
                  </p>
                </div>
                <div>
                  <p className="text-2xl font-display font-bold text-foreground">
                    {estimatedTime}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Minutes
                  </p>
                </div>
                <div>
                  <p className="text-xl font-display font-bold text-foreground leading-8">
                    {yearFrom === yearTo ? yearFrom : `${yearFrom}–${yearTo}`}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">Years</p>
                </div>
              </div>

              <div className="text-xs text-muted-foreground space-y-1 mb-4">
                {[...selectedChapters].sort((a, b) => a - b).map((ch) => (
                  <div key={ch} className="flex justify-between">
                    <span>
                      Chapter {ch}: {chapterName(ch)}
                    </span>
                    <span className="font-medium text-foreground">
                      {selections[ch]} Q
                    </span>
                  </div>
                ))}
              </div>

              {overLimit && !generateError && (
                <div className="mb-4 flex items-start gap-2 p-3 rounded bg-destructive/10 border border-destructive/20">
                  <AlertCircle
                    size={16}
                    className="text-destructive mt-0.5 shrink-0"
                  />
                  <p className="text-sm text-destructive">
                    One paper can hold at most {MAX_GENERATED_QUESTIONS} questions. Remove{" "}
                    {totalQuestions - MAX_GENERATED_QUESTIONS} to generate.
                  </p>
                </div>
              )}

              {generateError && (
                <div className="mb-4 flex items-start gap-2 p-3 rounded bg-destructive/10 border border-destructive/20">
                  <AlertCircle
                    size={16}
                    className="text-destructive mt-0.5 shrink-0"
                  />
                  <p className="text-sm text-destructive">{generateError}</p>
                </div>
              )}

              <button
                onClick={handleGenerate}
                disabled={isGenerating || overLimit}
                className="w-full px-4 py-3 rounded-lg font-semibold transition-all flex items-center justify-center gap-2"
                style={{
                  backgroundColor:
                    isGenerating || overLimit
                      ? "hsl(var(--muted))"
                      : "hsl(var(--primary))",
                  color:
                    isGenerating || overLimit
                      ? "hsl(var(--muted-foreground))"
                      : "hsl(var(--primary-foreground))",
                  cursor: isGenerating || overLimit ? "not-allowed" : "pointer",
                  opacity: isGenerating || overLimit ? 0.6 : 1,
                }}
              >
                <Zap size={18} />
                {isGenerating ? "Generating..." : "Generate Paper"}
              </button>

              <p className="mt-3 text-xs text-muted-foreground">
                A large paper can take a few seconds to build. Once it's ready you can download
                it or open it straight into Mock Space below.
              </p>
            </div>
          </div>
        </section>
      )}

      {/* Step 4: Result */}
      {result && (
        <section
          ref={resultSectionRef}
          className="mb-8 rounded-xl border border-border bg-card p-5 motion-safe:animate-fade-in-up"
          style={{ boxShadow: "var(--shadow-card)" }}
        >
          <h2 className="font-display font-semibold text-lg mb-4 flex items-center gap-2">
            <span className="flex items-center justify-center w-7 h-7 rounded-full bg-success/10 text-success text-sm font-bold">
              4
            </span>
            Your Paper Is Ready
          </h2>

          <div className="flex items-start gap-3 mb-5 p-3 rounded-lg bg-success/5 border border-success/20">
            <CheckCircle2 size={16} className="text-success mt-0.5 shrink-0" />
            <p className="text-sm text-foreground">
              <span className="font-medium">{result.fileName}</span> has been generated.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="relative">
              {justGenerated && (
                <span
                  aria-hidden="true"
                  className="absolute inset-0 rounded-lg motion-safe:animate-ping"
                  style={{ backgroundColor: "hsl(var(--primary) / 0.4)" }}
                />
              )}
              <button
                onClick={() => {
                  track("paper_download", { signed_in: Boolean(user) });
                  downloadPaper(result.paper, result.fileName);
                }}
                className="relative w-full flex items-center justify-center gap-2 px-4 py-3 rounded-lg font-semibold transition-all"
                style={{
                  backgroundColor: "hsl(var(--primary))",
                  color: "hsl(var(--primary-foreground))",
                }}
              >
                <Download size={18} />
                Download paper
              </button>
            </div>

            <button
              onClick={() => {
                if (!user) {
                  track("gated_click", { feature: "mock_space" });
                  const next = encodeURIComponent(location.pathname + location.search);
                  navigate(`/signin?next=${next}&hint=mock_space`);
                  return;
                }
                handleOpenInMockSpace();
              }}
              disabled={handingOff}
              className="flex items-center justify-center gap-2 px-4 py-3 rounded-lg font-semibold transition-all"
              style={{
                backgroundColor: handingOff ? "hsl(var(--muted))" : "hsl(var(--accent) / 0.1)",
                color: handingOff ? "hsl(var(--muted-foreground))" : "hsl(var(--accent))",
                cursor: handingOff ? "not-allowed" : "pointer",
                opacity: handingOff ? 0.6 : 1,
              }}
            >
              <ExternalLink size={18} />
              {handingOff
                ? "Opening…"
                  : !user && !loadingAuth
                    ? "Sign in to open in Mock Space"
                    : result.paper.mcq
                      ? "Open in Mock Space (in MCQ Mode)"
                      : "Open in Mock Space"}
            </button>
          </div>
        </section>
      )}
    </Layout>
  );
}
