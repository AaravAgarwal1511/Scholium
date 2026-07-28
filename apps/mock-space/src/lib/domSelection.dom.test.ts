// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { resolveIndex, readSelection, clearSelection } from "./domSelection";

/**
 * The DOM→model mapping that lets a student select committed words to cross out.
 * Runs in jsdom (this file opts in via the docblock; the rest of mock-space's
 * suite is node). indexFromPoint is not covered here — caretPositionFromPoint is
 * browser-only and is exercised by the append-only e2e instead.
 *
 * Each run element carries data-start (the model index of its first character)
 * and one text node, mirroring what AnswerBox renders.
 */

/** Builds a `.ms-text` root with runs, e.g. run("hello", 0), run("world", 6). */
function buildRoot(runs: [text: string, start: number][]): HTMLElement {
  const root = document.createElement("div");
  root.className = "ms-text";
  const line = document.createElement("div");
  line.className = "ms-line";
  for (const [text, start] of runs) {
    const span = document.createElement("span");
    span.setAttribute("data-start", String(start));
    span.textContent = text;
    line.appendChild(span);
  }
  root.appendChild(line);
  document.body.appendChild(root);
  return root;
}

afterEach(() => {
  document.body.innerHTML = "";
  window.getSelection()?.removeAllRanges();
});

describe("resolveIndex", () => {
  it("maps an offset inside a run's text node to data-start + offset", () => {
    const root = buildRoot([["hello", 0], ["world", 6]]);
    const secondRunText = root.querySelectorAll("span")[1].firstChild!;
    // Offset 2 into the "world" run (data-start 6) → model index 8.
    expect(resolveIndex(root, secondRunText, 2)).toBe(8);
  });

  it("resolves a position on the run element itself (child-index offset)", () => {
    const root = buildRoot([["hello", 0]]);
    const span = root.querySelector("span")!;
    expect(resolveIndex(root, span, 0)).toBe(0); // before the text node
    expect(resolveIndex(root, span, 1)).toBe(5); // after it → start + length
  });

  it("falls back to the far edge of the last run for a container endpoint past the end", () => {
    const root = buildRoot([["hello", 0], ["world", 6]]);
    // A selection dragged past the end lands on the container (the .ms-text root,
    // whose child holds the runs) with offset === childNodes.length → far edge of
    // the last run: 6 + len("world") = 11.
    expect(resolveIndex(root, root, root.childNodes.length)).toBe(11);
  });

  it("falls back to the near edge for a container endpoint at the start", () => {
    const root = buildRoot([["hello", 0], ["world", 6]]);
    expect(resolveIndex(root, root, 0)).toBe(0);
  });

  it("returns null when nothing carries data-start", () => {
    const bare = document.createElement("div");
    bare.textContent = "no runs";
    document.body.appendChild(bare);
    expect(resolveIndex(bare, bare.firstChild!, 1)).toBeNull();
  });
});

describe("readSelection", () => {
  function select(anchor: Node, aOff: number, focus: Node, fOff: number) {
    const sel = window.getSelection()!;
    sel.removeAllRanges();
    const range = document.createRange();
    range.setStart(anchor, aOff);
    range.setEnd(focus, fOff);
    sel.addRange(range);
  }

  it("returns the ordered character range of a real selection", () => {
    const root = buildRoot([["hello", 0], ["world", 6]]);
    const [a, b] = root.querySelectorAll("span");
    select(a.firstChild!, 1, b.firstChild!, 3); // model 1 .. 9
    expect(readSelection(root)).toEqual({ start: 1, end: 9 });
  });

  it("returns null for a collapsed selection (a plain caret)", () => {
    const root = buildRoot([["hello", 0]]);
    const t = root.querySelector("span")!.firstChild!;
    select(t, 2, t, 2);
    expect(readSelection(root)).toBeNull();
  });

  it("returns null when the selection lies outside the root", () => {
    const root = buildRoot([["hello", 0]]);
    const outside = document.createElement("p");
    outside.textContent = "elsewhere";
    document.body.appendChild(outside);
    select(outside.firstChild!, 0, outside.firstChild!, 4);
    expect(readSelection(root)).toBeNull();
  });
});

describe("clearSelection", () => {
  it("removes the live selection", () => {
    const root = buildRoot([["hello", 0]]);
    const t = root.querySelector("span")!.firstChild!;
    const sel = window.getSelection()!;
    const range = document.createRange();
    range.setStart(t, 0);
    range.setEnd(t, 4);
    sel.addRange(range);
    expect(sel.rangeCount).toBe(1);

    clearSelection(root);
    expect(window.getSelection()?.rangeCount ?? 0).toBe(0);
  });
});
