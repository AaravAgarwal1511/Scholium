import type { Range as CharRange } from "./textLayout";

/**
 * Maps browser DOM positions back to character indices in a box's text.
 *
 * Every rendered run carries `data-start`, the model index of its first character,
 * and holds exactly one text node. That makes the mapping a lookup plus an offset.
 *
 * Selection is the one browser affordance the editor keeps over committed text —
 * it is how a student picks the words to cross out. Caret *placement* stays
 * impossible because the rendered text is not inside an editable element.
 */

function runStart(el: Element | null): number | null {
  const start = (el as HTMLElement | null)?.dataset?.start;
  return start === undefined ? null : Number(start);
}

/** Nearest ancestor-or-self carrying `data-start`, bounded by `root`. */
function closestRun(root: HTMLElement, node: Node): HTMLElement | null {
  let el: Node | null = node.nodeType === Node.TEXT_NODE ? node.parentNode : node;
  while (el && el !== root.parentNode) {
    if (el instanceof HTMLElement && el.dataset.start !== undefined) return el;
    el = el.parentNode;
  }
  return null;
}

/** First or last run inside `el`, for endpoints that landed on a container. */
function edgeRun(el: Element, wantLast: boolean): HTMLElement | null {
  const runs = el.querySelectorAll<HTMLElement>("[data-start]");
  if (runs.length === 0) return null;
  return runs[wantLast ? runs.length - 1 : 0];
}

/**
 * Resolves a `(node, offset)` DOM position to a character index.
 *
 * Endpoints do not always land on a run: dragging past the last line drops them on
 * a line `<div>` or on the container. Those cases fall back to the nearest run's
 * near or far edge, which is what the user visually selected.
 */
export function resolveIndex(root: HTMLElement, node: Node, offset: number): number | null {
  if (node.nodeType === Node.TEXT_NODE) {
    const run = closestRun(root, node);
    const base = runStart(run);
    if (base === null) return null;
    return base + offset;
  }

  if (!(node instanceof Element)) return null;

  const own = runStart(node);
  if (own !== null) {
    // offset is a child index; 0 means before the text node, 1 means after it.
    return offset === 0 ? own : own + (node.textContent?.length ?? 0);
  }

  // A container. Pick the run on the side the offset points at.
  const child = node.childNodes[Math.min(offset, node.childNodes.length - 1)];
  const scope = child instanceof Element ? child : node;
  const run = edgeRun(scope, offset >= node.childNodes.length);
  if (!run) return null;
  const base = runStart(run);
  if (base === null) return null;
  return offset >= node.childNodes.length ? base + (run.textContent?.length ?? 0) : base;
}

/** Character index under a viewport point, or null if the point misses the text. */
export function indexFromPoint(root: HTMLElement, x: number, y: number): number | null {
  // caretPositionFromPoint is the standard; WebKit shipped caretRangeFromPoint first
  // and still needs it. One of the two exists in every browser we support.
  const doc = root.ownerDocument as Document & {
    caretPositionFromPoint?(x: number, y: number): { offsetNode: Node; offset: number } | null;
    caretRangeFromPoint?(x: number, y: number): globalThis.Range | null;
  };

  if (typeof doc.caretPositionFromPoint === "function") {
    const pos = doc.caretPositionFromPoint(x, y);
    if (!pos || !root.contains(pos.offsetNode)) return null;
    return resolveIndex(root, pos.offsetNode, pos.offset);
  }

  if (typeof doc.caretRangeFromPoint === "function") {
    const range = doc.caretRangeFromPoint(x, y);
    if (!range || !root.contains(range.startContainer)) return null;
    return resolveIndex(root, range.startContainer, range.startOffset);
  }

  return null;
}

/**
 * Reads the live DOM selection as a character range, if it lies inside `root`.
 *
 * The caller captures this *before* returning focus to the keystroke sink, because
 * focusing a textarea discards the document selection. The editor then draws the
 * highlight itself from the returned range.
 */
export function readSelection(root: HTMLElement): CharRange | null {
  const sel = root.ownerDocument.defaultView?.getSelection();
  if (!sel || sel.rangeCount === 0 || sel.isCollapsed) return null;
  if (!sel.anchorNode || !sel.focusNode) return null;
  if (!root.contains(sel.anchorNode) || !root.contains(sel.focusNode)) return null;

  const a = resolveIndex(root, sel.anchorNode, sel.anchorOffset);
  const b = resolveIndex(root, sel.focusNode, sel.focusOffset);
  if (a === null || b === null || a === b) return null;

  return { start: Math.min(a, b), end: Math.max(a, b) };
}

export function clearSelection(root: HTMLElement): void {
  root.ownerDocument.defaultView?.getSelection()?.removeAllRanges();
}
