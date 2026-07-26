import { describe, it, expect, beforeEach } from 'vitest';
import { getTextSelection, clearTextSelection, generateHighlightId } from './textSelection';

/**
 * Selection utilities for the poem editor. The offset maths (multi-node ranges)
 * is exercised end-to-end in the editor; here we pin the pure id generator and
 * the null-guard branches that decide whether a selection counts at all — a
 * highlight must never be created from an empty or out-of-editor selection.
 */

describe('generateHighlightId', () => {
  it('is prefixed and unique', () => {
    const ids = new Set(Array.from({ length: 5000 }, () => generateHighlightId()));
    expect(ids.size).toBe(5000);
    for (const id of ids) expect(id).toMatch(/^highlight-\d+-[a-z0-9]+$/);
  });
});

describe('getTextSelection', () => {
  beforeEach(() => {
    document.body.innerHTML = '<div id="editor"><p>Two roads diverged</p></div>';
    window.getSelection()?.removeAllRanges();
  });

  it('returns null when there is no editor element', () => {
    expect(getTextSelection(null)).toBeNull();
  });

  it('returns null when the selection is collapsed (a plain caret, no range)', () => {
    const editor = document.getElementById('editor') as HTMLElement;
    const p = editor.querySelector('p')!;
    const range = document.createRange();
    range.setStart(p.firstChild!, 3);
    range.collapse(true);
    const sel = window.getSelection()!;
    sel.removeAllRanges();
    sel.addRange(range);
    expect(getTextSelection(editor)).toBeNull();
  });

  it('returns a populated SelectionInfo for a real selection inside the editor', () => {
    const editor = document.getElementById('editor') as HTMLElement;
    const p = editor.querySelector('p')!;
    const range = document.createRange();
    range.setStart(p.firstChild!, 0);
    range.setEnd(p.firstChild!, 3); // "Two"
    const sel = window.getSelection()!;
    sel.removeAllRanges();
    sel.addRange(range);

    const info = getTextSelection(editor);
    expect(info).not.toBeNull();
    expect(info!.text).toBe('Two');
    expect(info!.startOffset).toBe(0);
    expect(info!.endOffset).toBe(3);
  });
});

describe('clearTextSelection', () => {
  it('removes all ranges and is safe to call when nothing is selected', () => {
    expect(() => clearTextSelection()).not.toThrow();
    expect(window.getSelection()?.rangeCount ?? 0).toBe(0);
  });
});
