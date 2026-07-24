import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronLeft, Zap, Download, AlertCircle } from "lucide-react";
import Layout from "@/components/Layout";
import Tetris from "@/components/Tetris";
import { EmptyState } from "@/components/StateViews";
import { useAsync } from "@/hooks/useAsync";
import {
  listSubjects,
  listComponents,
  listChapters,
  getChapterQuestions,
  generatePaper,
  paperNumOf,
  subjectDisplayName,
  estimateGenerationSeconds,
  MAX_GENERATED_QUESTIONS,
  type ChapterQuestion,
  type GeneratedPaper,
} from "@/lib/papers";

type SelectionMap = {
  [chapterNum: number]: number; // chapter -> question count
};

type ChapterInfo = { number: number; name: string; questions: ChapterQuestion[] };

// The paper arrives inline as a blob when it is small enough for a serverless
// response body, and as an R2 URL when it isn't. Either way it is one anchor
// click: the R2 object is stored with an attachment disposition, so the browser
// saves it rather than navigating away from the app.
function downloadPaper(paper: GeneratedPaper, fileName: string) {
  const href = paper.kind === "blob" ? URL.createObjectURL(paper.blob) : paper.url;
  const link = document.createElement("a");
  link.href = href;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  if (paper.kind === "blob") URL.revokeObjectURL(href);
}

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

export default function GeneratePaperPage() {
  const navigate = useNavigate();
  const [selectedSubject, setSelectedSubject] = useState<string | null>(null);
  const [selectedComponent, setSelectedComponent] = useState<string | null>(
    null
  );
  const [selections, setSelections] = useState<SelectionMap>({});
  const [chapters, setChapters] = useState<ChapterInfo[]>([]);
  const [loadingChapters, setLoadingChapters] = useState(false);
  const [pickedFrom, setPickedFrom] = useState<number | null>(null);
  const [pickedTo, setPickedTo] = useState<number | null>(null);
  const [includeMarkScheme, setIncludeMarkScheme] = useState(true);
  const [randomize, setRandomize] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [estimate, setEstimate] = useState(0);
  const [generateError, setGenerateError] = useState<string | null>(null);

  // Count up while a paper is composing, so the overlay can show elapsed time and
  // advance the progress bar against the estimate.
  useEffect(() => {
    if (!isGenerating) return;
    setElapsed(0);
    const start = performance.now();
    const id = setInterval(() => setElapsed((performance.now() - start) / 1000), 200);
    return () => clearInterval(id);
  }, [isGenerating]);

  // Load subjects
  const { data: subjects, loading: loadingSubjects } = useAsync(
    () => listSubjects(),
    []
  );

  // Load components for selected subject
  const { data: components, loading: loadingComponents } = useAsync(
    () =>
      selectedSubject ? listComponents(selectedSubject) : Promise.resolve([]),
    [selectedSubject]
  );

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

  // Narrowing the years can leave a chapter with fewer questions than the user
  // already asked for — or with none at all. Bring the counts back inside what
  // the range can supply instead of letting generation fail on them later.
  useEffect(() => {
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
  }, [idsInRange]);

  const resetSelection = () => {
    setSelections({});
    setPickedFrom(null);
    setPickedTo(null);
    setGenerateError(null);
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
  };

  const handleYearTo = (next: number) => {
    setPickedTo(next);
    setGenerateError(null);
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
  };

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

      downloadPaper(paper, fileName);
    } catch (error) {
      setGenerateError(
        error instanceof Error ? error.message : "Failed to generate paper"
      );
      console.error("Generation error:", error);
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <Layout>
      {isGenerating && <GeneratingOverlay elapsed={elapsed} estimate={estimate} />}
      <button
        onClick={() => navigate("/")}
        className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors mb-6"
      >
        <ChevronLeft size={16} />
        Back
      </button>

      <div className="mb-8">
        <div className="flex items-center gap-3 mb-3">
          <div className="p-2 rounded-lg bg-accent/10">
            <Zap size={20} className="text-accent" />
          </div>
          <h1 className="font-display font-bold text-3xl">Generate Paper</h1>
        </div>
        <p className="text-muted-foreground text-sm">
          Select chapters and the number of questions you want from each. Questions are picked at random.
        </p>
      </div>

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
                className="px-4 py-3 rounded-lg border-2 font-medium transition-all text-left"
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
                {subjectDisplayName(subject)}
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
                const isSelected = selections.hasOwnProperty(ch.number);
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
                          <label className="text-xs font-medium text-muted-foreground">
                            Questions:
                          </label>
                          <input
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
                <label className="text-sm font-medium">Mark Scheme</label>
                <input
                  type="checkbox"
                  checked={includeMarkScheme}
                  onChange={(e) => setIncludeMarkScheme(e.target.checked)}
                  className="w-4 h-4 rounded cursor-pointer"
                />
              </div>
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium">Randomize Order</label>
                <input
                  type="checkbox"
                  checked={randomize}
                  onChange={(e) => setRandomize(e.target.checked)}
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
                <Download size={18} />
                {isGenerating ? "Generating..." : "Generate & Download"}
              </button>

              <p className="mt-3 text-xs text-muted-foreground">
                A large paper is built and served as a download link, so it may take a few
                seconds to start.
              </p>
            </div>
          </div>
        </section>
      )}
    </Layout>
  );
}
