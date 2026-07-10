import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { GripVertical } from "lucide-react";
import type { Metrics } from "@/lib/metrics";
import { toCss } from "@/lib/coords";
import {
  isRangeStruck,
  layoutText,
  segmentLine,
  widthOf,
  wordAt,
  type Range,
} from "@/lib/textLayout";
import {
  appendText,
  backspace,
  commit,
  isDeletable,
  strikeRange,
  type AnswerBox as Box,
} from "@/lib/model";
import { clearSelection, indexFromPoint, readSelection } from "@/lib/domSelection";
import StrikeConfirm from "./StrikeConfirm";

/** Keys whose only purpose is to move the caret. There is nowhere for it to go. */
const CARET_KEYS = new Set([
  "ArrowLeft",
  "ArrowRight",
  "ArrowUp",
  "ArrowDown",
  "Home",
  "End",
  "PageUp",
  "PageDown",
]);

/** Ctrl/Cmd chords we refuse. `c` is absent on purpose — copying was not blocked. */
const BLOCKED_CHORDS = new Set(["a", "z", "y", "x", "v"]);

const MIN_WIDTH_PT = 60;

interface Props {
  box: Box;
  scale: number;
  metrics: Metrics;
  /** Timer paused or expired: the box becomes inert but stays legible. */
  locked: boolean;
  focused: boolean;
  onFocus(): void;
  onChange(next: Box): void;
  /** Only ever called for a box that never received a character. */
  onRemove(id: string): void;
}

export default function AnswerBox({
  box,
  scale,
  metrics,
  locked,
  focused,
  onFocus,
  onChange,
  onRemove,
}: Props) {
  const sinkRef = useRef<HTMLTextAreaElement>(null);
  const textRef = useRef<HTMLDivElement>(null);
  const composing = useRef(false);

  const [selection, setSelection] = useState<Range | null>(null);
  const [confirmWord, setConfirmWord] = useState<Range | null>(null);

  const layout = useMemo(
    () => layoutText(box.text, box.fontSizePt, box.wPt, metrics),
    [box.text, box.fontSizePt, box.wPt, metrics],
  );

  // A ref so the native listeners below always see the current box without being
  // torn down and rebuilt on every keystroke.
  const latest = useRef({ box, locked, onChange, onRemove, selection });
  latest.current = { box, locked, onChange, onRemove, selection };

  const focusSink = useCallback(() => {
    sinkRef.current?.focus({ preventScroll: true });
  }, []);

  // A newly created box, or one the student clicked into, should be ready to type.
  useEffect(() => {
    if (focused && !locked) focusSink();
  }, [focused, locked, focusSink]);

  const strikeSelection = useCallback(() => {
    const { box: b, onChange: fire, selection: sel } = latest.current;
    if (!sel) return;
    fire(strikeRange(b, sel.start, sel.end));
    setSelection(null);
  }, []);

  // ── Keystroke interception ─────────────────────────────────────────────────
  //
  // Native listeners, not React's synthetic ones: React's `onBeforeInput` is a
  // legacy `textInput` shim and does not carry `inputType`, which is the only
  // reliable way to tell an insertion from a paste from an undo.
  useEffect(() => {
    const sink = sinkRef.current;
    if (!sink) return;

    const apply = (next: Box) => {
      latest.current.onChange(next);
      setSelection(null);
    };

    const onBeforeInput = (e: InputEvent) => {
      // The one event we let through. It writes into the (otherwise empty) sink,
      // confining the browser's own editing — and its undo stack — to the word
      // currently being composed. We read the result on compositionend.
      if (e.inputType === "insertCompositionText") return;

      e.preventDefault();
      const { box: b, locked: isLocked } = latest.current;
      if (isLocked || composing.current) return;

      switch (e.inputType) {
        case "insertText":
          if (e.data) apply(appendText(b, e.data));
          break;
        case "insertLineBreak":
        case "insertParagraph":
          apply(appendText(b, "\n"));
          break;
        case "deleteContentBackward":
          apply(backspace(b));
          break;
        default:
          // insertFromPaste, insertFromDrop, insertReplacementText (mobile
          // autocorrect), historyUndo, historyRedo, deleteWordBackward,
          // deleteContentForward, deleteByCut … every one of these would let a
          // student revise committed text. Refused, by falling through.
          break;
      }
    };

    const onKeyDown = (e: KeyboardEvent) => {
      if (composing.current) return;
      const { box: b, locked: isLocked } = latest.current;
      const chord = e.metaKey || e.ctrlKey;

      if (chord && e.key.toLowerCase() === "d") {
        e.preventDefault();
        if (!isLocked) strikeSelection();
        return;
      }
      if (chord && BLOCKED_CHORDS.has(e.key.toLowerCase())) {
        e.preventDefault();
        return;
      }
      if (CARET_KEYS.has(e.key) || e.key === "Delete") {
        e.preventDefault();
        return;
      }
      if (e.key === "Escape") {
        e.preventDefault();
        setSelection(null);
        setConfirmWord(null);
        sink.blur();
        return;
      }
      if (e.key === "Tab") {
        // Commits the pending word without inserting anything, and without moving
        // focus: a literal tab in an exam answer means nothing.
        e.preventDefault();
        if (!isLocked) latest.current.onChange(commit(b));
        return;
      }
      // Backspace and printable keys fall through to beforeinput.
    };

    const onCompositionStart = () => {
      composing.current = true;
    };

    const onCompositionEnd = (e: CompositionEvent) => {
      composing.current = false;
      const { box: b, locked: isLocked } = latest.current;
      sink.value = "";
      if (!isLocked && e.data) apply(appendText(b, e.data));
    };

    const refuse = (e: Event) => e.preventDefault();

    sink.addEventListener("beforeinput", onBeforeInput as EventListener);
    sink.addEventListener("keydown", onKeyDown);
    sink.addEventListener("compositionstart", onCompositionStart);
    sink.addEventListener("compositionend", onCompositionEnd as EventListener);
    sink.addEventListener("paste", refuse);
    sink.addEventListener("drop", refuse);
    sink.addEventListener("dragover", refuse);

    return () => {
      sink.removeEventListener("beforeinput", onBeforeInput as EventListener);
      sink.removeEventListener("keydown", onKeyDown);
      sink.removeEventListener("compositionstart", onCompositionStart);
      sink.removeEventListener("compositionend", onCompositionEnd as EventListener);
      sink.removeEventListener("paste", refuse);
      sink.removeEventListener("drop", refuse);
      sink.removeEventListener("dragover", refuse);
    };
  }, [strikeSelection]);

  // The sink is a keystroke target, never a text buffer. Anything the browser
  // manages to leave in it (a stray composition, an autofill) is discarded, which
  // is why its native undo history can never resurrect committed text.
  useEffect(() => {
    if (sinkRef.current && !composing.current) sinkRef.current.value = "";
  }, [box.text]);

  useEffect(() => {
    if (locked) setConfirmWord(null);
  }, [locked]);

  // ── Pointer: selection for striking, never caret placement ─────────────────

  function handleTextPointerUp(e: React.PointerEvent<HTMLDivElement>) {
    const root = textRef.current;
    if (!root || locked) return;

    const dragged = readSelection(root);
    if (dragged) {
      // Capture before focusing the sink: focusing a textarea discards the
      // document selection, so we redraw the highlight ourselves.
      setSelection(dragged);
      setConfirmWord(null);
      clearSelection(root);
      focusSink();
      return;
    }

    // A plain click. The first one focuses the box so the student can carry on
    // typing; only once focused does clicking a word offer to cross it out.
    if (!focused) {
      onFocus();
      focusSink();
      return;
    }

    setSelection(null);
    const index = indexFromPoint(root, e.clientX, e.clientY);
    const word = index === null ? null : wordAt(box.text, index);
    setConfirmWord(word && !isRangeStruck(box.struck, word.start, word.end) ? word : null);
    focusSink();
  }

  // ── Move and resize ────────────────────────────────────────────────────────
  // Position is cosmetic, so a box may always be repositioned. Its *text* may not.

  function beginDrag(e: React.PointerEvent, mode: "move" | "resize") {
    if (locked) return;
    e.preventDefault();
    e.stopPropagation();
    (e.target as Element).setPointerCapture(e.pointerId);

    const originX = e.clientX;
    const originY = e.clientY;
    const { xPt, yPt, wPt } = box;

    const onMove = (ev: PointerEvent) => {
      const dx = (ev.clientX - originX) / scale;
      const dy = (ev.clientY - originY) / scale;
      onChange(
        mode === "move"
          ? { ...box, xPt: Math.max(0, xPt + dx), yPt: Math.max(0, yPt + dy) }
          : { ...box, wPt: Math.max(MIN_WIDTH_PT, wPt + dx) },
      );
    };
    const onUp = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  }

  const fontSizePx = toCss(box.fontSizePt, scale);
  const lineHeightPx = toCss(layout.lineHeight, scale);
  const showCaret = focused && !locked;

  const confirmAnchor = confirmWord ? anchorFor(confirmWord, layout, scale) : null;

  return (
    <div
      className="absolute"
      style={{
        left: toCss(box.xPt, scale),
        top: toCss(box.yPt, scale),
        width: toCss(box.wPt, scale),
      }}
      data-box={box.id}
    >
      {focused && !locked && (
        <>
          <button
            aria-label="Move answer box"
            onPointerDown={(e) => beginDrag(e, "move")}
            className="absolute -left-6 top-0 cursor-move rounded p-0.5 text-muted-foreground hover:bg-muted"
          >
            <GripVertical size={14} />
          </button>
          <div
            aria-label="Resize answer box"
            onPointerDown={(e) => beginDrag(e, "resize")}
            className="absolute -right-1 top-0 h-full w-2 cursor-ew-resize"
          />
        </>
      )}

      <div
        ref={textRef}
        className="ms-text"
        onPointerUp={handleTextPointerUp}
        style={{ minHeight: lineHeightPx }}
      >
        {layout.lines.map((line, i) => {
          const runs = segmentLine(line, box.struck, selection);
          const isLast = i === layout.lines.length - 1;
          return (
            <div
              key={`${line.start}-${i}`}
              className="ms-line"
              style={{ height: lineHeightPx, lineHeight: `${lineHeightPx}px`, fontSize: fontSizePx }}
            >
              {runs.map((run) => (
                <span
                  key={run.start}
                  data-start={run.start}
                  className={[run.struck && "ms-struck", run.selected && "ms-selected"]
                    .filter(Boolean)
                    .join(" ")}
                >
                  {box.text.slice(run.start, run.end)}
                </span>
              ))}
              {isLast && showCaret && (
                <span className="ms-caret" style={{ height: fontSizePx }} />
              )}
            </div>
          );
        })}
      </div>

      {confirmWord && confirmAnchor && (
        <StrikeConfirm
          word={box.text.slice(confirmWord.start, confirmWord.end)}
          left={confirmAnchor.left}
          top={confirmAnchor.top}
          onConfirm={() => {
            onChange(strikeRange(box, confirmWord.start, confirmWord.end));
            setConfirmWord(null);
            focusSink();
          }}
          onCancel={() => {
            setConfirmWord(null);
            focusSink();
          }}
        />
      )}

      <textarea
        ref={sinkRef}
        className="ms-sink"
        tabIndex={locked ? -1 : 0}
        aria-label="Answer text. Typing appends to the end; the cursor cannot be moved."
        spellCheck={false}
        autoCorrect="off"
        autoCapitalize="off"
        autoComplete="off"
        onFocus={onFocus}
        onBlur={() => {
          const current = latest.current.box;
          setSelection(null);
          // A box that never received a character was a stray click on the page.
          // Anything with text stays forever — crossing out is the only retraction.
          if (isDeletable(current)) latest.current.onRemove(current.id);
          else latest.current.onChange(commit(current));
        }}
      />
    </div>
  );
}

/** Places the confirm popover just under the clicked word. */
function anchorFor(
  word: Range,
  layout: ReturnType<typeof layoutText>,
  scale: number,
): { left: number; top: number } {
  const lineIndex = Math.max(
    0,
    layout.lines.findIndex((l) => word.start >= l.start && word.start < l.end),
  );
  const line = layout.lines[lineIndex];
  return {
    left: toCss(widthOf(layout.prefix, line.start, word.start), scale),
    top: toCss(layout.lineHeight * (lineIndex + 1), scale),
  };
}
