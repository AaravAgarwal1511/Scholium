import type { Metrics } from "./metrics";

/** Half-open `[start, end)` range of character indices into a box's text. */
export interface Range {
  start: number;
  end: number;
}

/** A maximal span of characters on one line sharing the same struck+selected state. */
export interface Run extends Range {
  struck: boolean;
  selected: boolean;
}

export interface TextLayout {
  /** One entry per wrapped line. `\n` characters are excluded from the ranges. */
  lines: Range[];
  /** `prefix[i]` is the width in points of `text.slice(0, i)`. Length `text.length + 1`. */
  prefix: number[];
  lineHeight: number;
  baselineOffset: number;
}

/**
 * Decides where every line breaks. The editor renders one element per returned
 * line and the exporter draws one `drawText` per returned line, so this function
 * is the single reason the screen and the PDF wrap identically. Never let CSS
 * wrap answer text.
 */
export function layoutText(
  text: string,
  sizePt: number,
  maxWidthPt: number,
  metrics: Metrics,
): TextLayout {
  const prefix = prefixWidths(text, sizePt, metrics);
  return {
    lines: wrapLines(text, prefix, maxWidthPt),
    prefix,
    lineHeight: metrics.lineHeight(sizePt),
    baselineOffset: metrics.baselineOffset(sizePt),
  };
}

/** Exact because pdf-lib's advance widths are additive — see createMetrics(). */
export function prefixWidths(text: string, sizePt: number, metrics: Metrics): number[] {
  const prefix = new Array<number>(text.length + 1);
  prefix[0] = 0;
  for (let i = 0; i < text.length; i++) {
    prefix[i + 1] = prefix[i] + metrics.charWidth(text[i], sizePt);
  }
  return prefix;
}

/** Width in points of `text.slice(from, to)`, given a prefix array. */
export function widthOf(prefix: number[], from: number, to: number): number {
  return prefix[to] - prefix[from];
}

function wrapLines(text: string, prefix: number[], maxWidthPt: number): Range[] {
  const lines: Range[] = [];
  const n = text.length;

  let lineStart = 0;
  let lastSpace = -1; // last ' ' at or after lineStart — a break opportunity
  let i = 0;

  while (i < n) {
    const ch = text[i];

    if (ch === "\n") {
      lines.push({ start: lineStart, end: i });
      i += 1;
      lineStart = i;
      lastSpace = -1;
      continue;
    }

    // Spaces may overhang the right edge rather than forcing a break, which is
    // how every text engine behaves — otherwise a trailing space wraps alone.
    const overflows =
      ch !== " " && i > lineStart && widthOf(prefix, lineStart, i + 1) > maxWidthPt;

    if (overflows) {
      if (lastSpace >= lineStart) {
        // Break after the space; it stays on the line it terminated.
        const end = lastSpace + 1;
        lines.push({ start: lineStart, end });
        lineStart = end;
      } else {
        // A single word wider than the box. Hard-break mid-word.
        lines.push({ start: lineStart, end: i });
        lineStart = i;
      }
      lastSpace = -1;
      continue; // re-test `ch` against the fresh line
    }

    if (ch === " ") lastSpace = i;
    i += 1;
  }

  lines.push({ start: lineStart, end: n });
  return lines;
}

// ── Strike ranges ────────────────────────────────────────────────────────────
// Sorted, merged, non-overlapping, half-open. Strikes are permanent, so these
// only ever grow: there is deliberately no `removeStrike`.

export function addStrike(struck: Range[], start: number, end: number): Range[] {
  if (end <= start) return struck;

  const out: Range[] = [];
  let lo = start;
  let hi = end;
  let i = 0;

  while (i < struck.length && struck[i].end < lo) out.push(struck[i++]);
  // `<=` so touching ranges coalesce: [0,4) + [4,7) becomes [0,7).
  while (i < struck.length && struck[i].start <= hi) {
    lo = Math.min(lo, struck[i].start);
    hi = Math.max(hi, struck[i].end);
    i += 1;
  }
  out.push({ start: lo, end: hi });
  while (i < struck.length) out.push(struck[i++]);

  return out;
}

export function isStruck(struck: Range[], index: number): boolean {
  for (const r of struck) {
    if (index < r.start) return false;
    if (index < r.end) return true;
  }
  return false;
}

/**
 * Splits `[lineStart, lineEnd)` into maximal runs of uniform state.
 *
 * `selection` is drawn as a run property rather than as an overlay rectangle so
 * the highlight is positioned by the same glyphs it highlights — it cannot drift
 * from the text the way a separately-measured rectangle could. The exporter
 * passes no selection.
 */
export function segmentLine(line: Range, struck: Range[], selection?: Range | null): Run[] {
  const runs: Run[] = [];
  if (line.end <= line.start) return runs;

  const selectedAt = (i: number) =>
    selection !== null && selection !== undefined && i >= selection.start && i < selection.end;

  let cursor = line.start;
  while (cursor < line.end) {
    const struckState = isStruck(struck, cursor);
    const selectedState = selectedAt(cursor);
    let next = cursor + 1;
    while (
      next < line.end &&
      isStruck(struck, next) === struckState &&
      selectedAt(next) === selectedState
    ) {
      next += 1;
    }
    runs.push({ start: cursor, end: next, struck: struckState, selected: selectedState });
    cursor = next;
  }
  return runs;
}

/** True when every character in `[start, end)` is already struck. */
export function isRangeStruck(struck: Range[], start: number, end: number): boolean {
  for (let i = start; i < end; i++) if (!isStruck(struck, i)) return false;
  return end > start;
}

// ── Word boundaries (for click-to-strike) ────────────────────────────────────

const WORD_BREAK = /[\s]/;

/** Expands `index` to the whitespace-delimited word containing it. */
export function wordAt(text: string, index: number): Range | null {
  if (index < 0 || index >= text.length) return null;
  if (WORD_BREAK.test(text[index])) return null;

  let start = index;
  while (start > 0 && !WORD_BREAK.test(text[start - 1])) start -= 1;

  let end = index;
  while (end < text.length && !WORD_BREAK.test(text[end])) end += 1;

  return { start, end };
}
