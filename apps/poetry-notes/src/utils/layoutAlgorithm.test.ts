import { describe, it, expect } from 'vitest';
import {
    calculateNotePositions,
    calculateNewNotePosition,
    recalculateLayout,
} from './layoutAlgorithm';
import type { Note } from '../types';

// The defaults the module lays out against:
//   canvas 600x800, note 200x120, padding 20, start (50, 50)
// so columns = floor((600 - 50) / (200 + 20)) = 2, and the grid steps are
// 220 across and 140 down.
const NOTE_W = 200;
const NOTE_H = 120;
const STEP_X = 220;
const STEP_Y = 140;
const START = { x: 50, y: 50 };

function note(id: string, x = 0, y = 0): Note {
    return {
        id,
        content: `note ${id}`,
        position: { x, y },
        textReferences: [],
        linkedNotes: [],
        createdAt: '2026-01-01T00:00:00.000Z',
        lastModified: '2026-01-01T00:00:00.000Z',
    };
}

function overlaps(
    a: { x: number; y: number },
    b: { x: number; y: number },
    w = NOTE_W,
    h = NOTE_H,
): boolean {
    return a.x < b.x + w && a.x + w > b.x && a.y < b.y + h && a.y + h > b.y;
}

describe('calculateNotePositions — grid placement', () => {
    it('returns nothing for no notes', () => {
        expect(calculateNotePositions([]).size).toBe(0);
    });

    it('puts the first note at the start offset', () => {
        const positions = calculateNotePositions([note('a')]);
        expect(positions.get('a')).toEqual(START);
    });

    it('fills two columns, then wraps to the next row', () => {
        const positions = calculateNotePositions([note('a'), note('b'), note('c')]);
        expect(positions.get('a')).toEqual({ x: START.x, y: START.y });
        expect(positions.get('b')).toEqual({ x: START.x + STEP_X, y: START.y });
        expect(positions.get('c')).toEqual({ x: START.x, y: START.y + STEP_Y });
    });

    it('gives every note a position', () => {
        const notes = Array.from({ length: 9 }, (_, i) => note(`n${i}`));
        expect(calculateNotePositions(notes).size).toBe(9);
    });

    it('keeps at least one column when the canvas is narrower than a note', () => {
        // cols would floor to 0; the code clamps it, otherwise index % 0 is NaN
        // and every note lands at NaN.
        const positions = calculateNotePositions([note('a'), note('b')], {
            canvasWidth: 100,
        });
        for (const p of positions.values()) {
            expect(Number.isFinite(p.x)).toBe(true);
            expect(Number.isFinite(p.y)).toBe(true);
        }
        // One column: the second note sits directly below the first.
        expect(positions.get('b')!.x).toBe(positions.get('a')!.x);
    });
});

describe('calculateNotePositions — notes that already have a position', () => {
    it('leaves a positioned note exactly where it is', () => {
        const positions = calculateNotePositions([note('pinned', 400, 640)]);
        expect(positions.get('pinned')).toEqual({ x: 400, y: 640 });
    });

    it('treats a note at exactly (0, 0) as unpositioned', () => {
        // Pinned rather than endorsed: the check is `x !== 0 || y !== 0`, so the
        // origin is indistinguishable from "never placed". A note deliberately
        // dragged to the top-left corner gets moved on the next layout pass.
        const positions = calculateNotePositions([note('origin', 0, 0)]);
        expect(positions.get('origin')).toEqual(START);
    });

    it('a note at (0, 1) is positioned, so only the exact origin is special', () => {
        const positions = calculateNotePositions([note('almost', 0, 1)]);
        expect(positions.get('almost')).toEqual({ x: 0, y: 1 });
    });

    it('routes an auto-placed note around a pinned one', () => {
        // 'pinned' occupies the slot the grid would hand to the first auto note.
        const positions = calculateNotePositions([note('pinned', START.x, START.y), note('auto')]);
        expect(positions.get('pinned')).toEqual(START);
        expect(overlaps(positions.get('auto')!, positions.get('pinned')!)).toBe(false);
    });
});

describe('calculateNotePositions — no two notes land on top of each other', () => {
    it('holds for a full canvas of notes', () => {
        const notes = Array.from({ length: 12 }, (_, i) => note(`n${i}`));
        const positions = [...calculateNotePositions(notes).values()];

        for (let i = 0; i < positions.length; i++) {
            for (let j = i + 1; j < positions.length; j++) {
                expect(
                    overlaps(positions[i], positions[j]),
                    `notes ${i} and ${j} overlap at ${JSON.stringify(positions[i])}`,
                ).toBe(false);
            }
        }
    });

    it('holds when auto-placed notes have to work around pinned ones', () => {
        const notes = [
            note('p1', START.x, START.y),
            note('p2', START.x + STEP_X, START.y),
            ...Array.from({ length: 6 }, (_, i) => note(`a${i}`)),
        ];
        const positions = [...calculateNotePositions(notes).values()];
        for (let i = 0; i < positions.length; i++) {
            for (let j = i + 1; j < positions.length; j++) {
                expect(overlaps(positions[i], positions[j])).toBe(false);
            }
        }
    });
});

describe('calculateNewNotePosition', () => {
    it('starts at the default offset when there is nothing to avoid', () => {
        expect(calculateNewNotePosition([], null, null)).toEqual(START);
    });

    it('steps past an existing note rather than landing on it', () => {
        const placed = calculateNewNotePosition([note('a', START.x, START.y)], null, null);
        expect(overlaps(placed, START)).toBe(false);
    });

    it('aligns to the highlight when both rects are known', () => {
        const canvasRect = { top: 100, left: 0, width: 600, height: 800 } as DOMRect;
        const highlightRect = { top: 340, left: 0, width: 50, height: 20 } as DOMRect;
        // startY is the highlight's offset within the canvas: 340 - 100.
        expect(calculateNewNotePosition([], highlightRect, canvasRect)).toEqual({
            x: START.x,
            y: 240,
        });
    });

    it('adopts the canvas dimensions it is given', () => {
        // A short canvas forces the column break much sooner. With three notes
        // stacked from y=50 in a 400-high canvas, the next slot must move across.
        const canvasRect = { top: 0, left: 0, width: 600, height: 400 } as DOMRect;
        const existing = [
            note('a', START.x, 50),
            note('b', START.x, 190),
            note('c', START.x, 330),
        ];
        const placed = calculateNewNotePosition(existing, null, canvasRect);
        for (const n of existing) {
            expect(overlaps(placed, n.position)).toBe(false);
        }
    });
});

describe('recalculateLayout', () => {
    it('lays notes out against the new canvas size', () => {
        const notes = [note('a'), note('b'), note('c')];
        // 1040 wide fits four columns instead of two, so the third note stays on
        // the first row rather than wrapping.
        const wide = recalculateLayout(notes, 1040, 800);
        expect(wide.get('c')!.y).toBe(START.y);
        expect(wide.get('c')!.x).toBe(START.x + 2 * STEP_X);
    });

    it('agrees with calculateNotePositions given the same dimensions', () => {
        const notes = [note('a'), note('b'), note('c')];
        expect(recalculateLayout(notes, 600, 800)).toEqual(
            calculateNotePositions(notes, { canvasWidth: 600, canvasHeight: 800 }),
        );
    });
});
