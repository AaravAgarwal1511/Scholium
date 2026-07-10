import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { CloudOff, ZoomIn, ZoomOut } from "lucide-react";
import { useAttempt } from "@/contexts/AttemptContext";
import PageLayer from "@/components/PageLayer";
import AnswerBox from "@/components/AnswerBox";
import TimerBar from "@/components/TimerBar";
import PauseCurtain from "@/components/PauseCurtain";
import Toolbar from "@/components/Toolbar";
import SymbolPalette from "@/components/SymbolPalette";
import DrawLayer from "@/components/DrawLayer";
import { answerMetrics } from "@/lib/answerFont";
import type { Metrics } from "@/lib/metrics";
import { toModel } from "@/lib/coords";
import { appendText, createBox, type AnswerBox as Box, type Stroke, type Timer } from "@/lib/model";
import type { Tool } from "@/lib/tools";
import { useTimer } from "@/lib/useTimer";

const ZOOM_STEPS = [0.75, 1, 1.25, 1.5, 2];
const RIGHT_MARGIN_PT = 36;
const MAX_NEW_BOX_WIDTH_PT = 420;

export default function AttemptPage() {
  const navigate = useNavigate();
  const { attempt, doc, updateAttempt, restoring, saveFailed } = useAttempt();
  const [zoomIndex, setZoomIndex] = useState(2);
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [focusedBoxId, setFocusedBoxId] = useState<string | null>(null);
  const [tool, setTool] = useState<Tool>("write");
  const [paletteOpen, setPaletteOpen] = useState(false);

  const scale = ZOOM_STEPS[zoomIndex];

  const onTimerChange = useCallback(
    (next: Timer) => updateAttempt((a) => ({ ...a, timer: next })),
    [updateAttempt],
  );

  const timer = useTimer(
    attempt?.timer ?? { durationMs: 0, deadlineAt: null, remainingMs: 0, state: "idle" },
    onTimerChange,
  );

  // Everything is inert unless the clock is actually running — before the start,
  // while paused, and after it expires.
  const locked = timer.state !== "running";

  useEffect(() => {
    if (!restoring && (!attempt || !doc)) navigate("/", { replace: true });
  }, [restoring, attempt, doc, navigate]);

  useEffect(() => {
    if (timer.state === "expired") navigate("/export", { replace: true });
  }, [timer.state, navigate]);

  useEffect(() => {
    answerMetrics().then(setMetrics);
  }, []);

  const updateBox = useCallback(
    (next: Box) =>
      updateAttempt((a) => ({
        ...a,
        boxes: a.boxes.map((b) => (b.id === next.id ? next : b)),
      })),
    [updateAttempt],
  );

  /** A box left empty when focus moves on was a stray click. Drop it. */
  const removeBox = useCallback(
    (id: string) => {
      updateAttempt((a) => ({ ...a, boxes: a.boxes.filter((b) => b.id !== id) }));
      setFocusedBoxId((focused) => (focused === id ? null : focused));
    },
    [updateAttempt],
  );

  const focusedBox = attempt?.boxes.find((b) => b.id === focusedBoxId) ?? null;

  const commitStroke = useCallback(
    (stroke: Stroke) => updateAttempt((a) => ({ ...a, strokes: [...a.strokes, stroke] })),
    [updateAttempt],
  );

  const eraseStroke = useCallback(
    (id: string) =>
      updateAttempt((a) => ({ ...a, strokes: a.strokes.filter((s) => s.id !== id) })),
    [updateAttempt],
  );

  function insertSymbol(symbol: string) {
    if (!focusedBox || locked) return;
    updateBox(appendText(focusedBox, symbol));
  }

  function addBoxAt(pageIndex: number, e: React.PointerEvent<HTMLDivElement>) {
    if (!attempt || locked || tool !== "write") return;
    // Clicks that land on an existing box belong to that box.
    if ((e.target as Element).closest("[data-box]")) return;

    // Suppress pointerdown's default focus shift. Left alone, it moves focus to
    // <body> straight after the new box has focused its sink — and that blur would
    // immediately delete the box as an empty stray click. Focus still transfers off
    // any previously focused box, because the new box's sink claims it.
    e.preventDefault();

    const rect = e.currentTarget.getBoundingClientRect();
    const xPt = toModel(e.clientX - rect.left, scale);
    const yPt = toModel(e.clientY - rect.top, scale);
    const available = attempt.pages[pageIndex].widthPt - xPt - RIGHT_MARGIN_PT;
    const wPt = Math.max(80, Math.min(available, MAX_NEW_BOX_WIDTH_PT));

    const box = createBox(pageIndex, xPt, yPt, wPt);
    updateAttempt((a) => ({ ...a, boxes: [...a.boxes, box] }));
    setFocusedBoxId(box.id);
  }

  if (restoring) {
    return (
      <main className="grid min-h-screen place-items-center">
        <p className="text-sm text-muted-foreground">Reopening your paper…</p>
      </main>
    );
  }

  if (!attempt || !doc) return null;

  return (
    <div className="min-h-screen bg-muted/40">
      <div className="sticky top-0 z-20 flex items-center gap-3 border-b border-border bg-background/95 px-4 py-2 backdrop-blur">
        <span className="truncate text-sm font-semibold">{attempt.title}</span>
        <span className="hidden text-xs text-muted-foreground sm:inline">
          {attempt.pages.length} page{attempt.pages.length === 1 ? "" : "s"}
        </span>

        {/* Autosave goes over the network now. Say so when it stops landing, rather
            than let a student write for an hour into nothing. */}
        {saveFailed && (
          <span
            data-testid="save-failed"
            className="flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold"
            style={{ background: "hsl(var(--accent) / 0.15)", color: "hsl(var(--accent))" }}
            title="Your answers are safe in this tab, but have not reached your account."
          >
            <CloudOff size={11} /> Not saved
          </span>
        )}

        <div className="ml-4">
          <TimerBar timer={timer} />
        </div>

        <div className="relative ml-4">
          <Toolbar
            tool={tool}
            disabled={locked}
            paletteOpen={paletteOpen}
            onToolChange={(t) => {
              setTool(t);
              setPaletteOpen(false);
            }}
            onTogglePalette={() => setPaletteOpen((v) => !v)}
          />
          {paletteOpen && !locked && (
            <SymbolPalette disabled={!focusedBox} onInsert={insertSymbol} />
          )}
        </div>

        <div className="ml-auto flex items-center gap-1">
          <button
            aria-label="Zoom out"
            disabled={zoomIndex === 0}
            onClick={() => setZoomIndex((i) => Math.max(0, i - 1))}
            className="rounded p-1.5 hover:bg-muted disabled:opacity-40"
          >
            <ZoomOut size={16} />
          </button>
          <span className="w-12 text-center text-xs tabular-nums text-muted-foreground">
            {Math.round(scale * 100)}%
          </span>
          <button
            aria-label="Zoom in"
            disabled={zoomIndex === ZOOM_STEPS.length - 1}
            onClick={() => setZoomIndex((i) => Math.min(ZOOM_STEPS.length - 1, i + 1))}
            className="rounded p-1.5 hover:bg-muted disabled:opacity-40"
          >
            <ZoomIn size={16} />
          </button>
        </div>
      </div>

      {timer.state === "idle" && (
        <p className="border-b border-border bg-accent/10 px-4 py-2 text-center text-xs text-muted-foreground">
          Press <span className="font-semibold">Start</span> to begin. Until then the paper is
          read-only.
        </p>
      )}

      {timer.state === "paused" ? (
        // Unmounted, not merely covered. An opaque overlay still leaves the paper
        // in the DOM for anyone willing to open devtools, and blurring the boxes
        // on the way out is exactly what should happen when you stop the clock.
        <PauseCurtain remainingMs={timer.remainingMs} onResume={timer.resume} />
      ) : (
        <div className="flex flex-col items-center gap-6 py-6">
          {attempt.pages.map((geometry, i) => (
            <PageLayer
              key={i}
              doc={doc}
              pageIndex={i}
              geometry={geometry}
              scale={scale}
              onPointerDown={(e) => addBoxAt(i, e)}
              underlay={
                <DrawLayer
                  pageIndex={i}
                  geometry={geometry}
                  scale={scale}
                  strokes={attempt.strokes.filter((s) => s.page === i)}
                  tool={tool}
                  locked={locked}
                  onCommit={commitStroke}
                  onErase={eraseStroke}
                />
              }
            >
              {metrics &&
                attempt.boxes
                  .filter((b) => b.page === i)
                  .map((b) => (
                    <AnswerBox
                      key={b.id}
                      box={b}
                      scale={scale}
                      metrics={metrics}
                      locked={locked}
                      focused={focusedBoxId === b.id}
                      onFocus={() => setFocusedBoxId(b.id)}
                      onChange={updateBox}
                      onRemove={removeBox}
                    />
                  ))}
            </PageLayer>
          ))}
        </div>
      )}
    </div>
  );
}
