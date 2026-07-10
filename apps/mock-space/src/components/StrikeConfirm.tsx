import { useEffect, useRef } from "react";

interface Props {
  word: string;
  left: number;
  top: number;
  onConfirm(): void;
  onCancel(): void;
}

/**
 * Crossing out is irreversible, and a single click is far too easy to fire by
 * accident, so a bare word-click only *offers* to strike. Drag-selecting and
 * pressing Ctrl+D skips this — that gesture is already deliberate.
 */
export default function StrikeConfirm({ word, left, top, onConfirm, onCancel }: Props) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onPointerDown = (e: PointerEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onCancel();
    };
    // Deferred: the click that opened the popover is still propagating.
    const id = window.setTimeout(
      () => window.addEventListener("pointerdown", onPointerDown),
      0,
    );
    return () => {
      window.clearTimeout(id);
      window.removeEventListener("pointerdown", onPointerDown);
    };
  }, [onCancel]);

  return (
    <div
      ref={ref}
      role="dialog"
      aria-label="Confirm crossing out"
      data-testid="strike-confirm"
      className="absolute z-30 flex items-center gap-2 rounded-lg border border-border bg-popover px-2.5 py-1.5 text-xs shadow-hover"
      style={{ left, top, transform: "translateX(-25%)" }}
    >
      <span className="whitespace-nowrap text-popover-foreground">
        Cross out <span className="font-semibold">“{word}”</span>?
      </span>
      <button
        data-testid="strike-confirm-yes"
        onClick={onConfirm}
        className="rounded px-2 py-0.5 font-semibold text-white"
        style={{ background: "hsl(var(--destructive))" }}
      >
        Cross out
      </button>
      <button
        onClick={onCancel}
        className="rounded px-1.5 py-0.5 text-muted-foreground hover:bg-muted"
      >
        Cancel
      </button>
    </div>
  );
}
