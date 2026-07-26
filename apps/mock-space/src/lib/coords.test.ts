import { describe, expect, it } from "vitest";
import { flipY, toCss, toModel } from "./coords";

/**
 * Everything persisted is in model space: PDF points, origin top-left. Screen
 * pixels are derived and never stored, so zoom and DPI cannot make the editor
 * and the export disagree. This file is small because loadPdf() rejects rotated
 * pages and offset crop boxes — with those ruled out the transform is a uniform
 * scale plus one y-flip, and these three functions are the whole of it.
 */

describe("toCss / toModel", () => {
    it("scales points up to pixels", () => {
        expect(toCss(100, 1)).toBe(100);
        expect(toCss(100, 1.5)).toBe(150);
        expect(toCss(100, 0.5)).toBe(50);
    });

    it("scales pixels back down to points", () => {
        expect(toModel(150, 1.5)).toBe(100);
        expect(toModel(50, 0.5)).toBe(100);
    });

    it("round-trips at every zoom level the toolbar offers", () => {
        for (const scale of [0.5, 0.75, 1, 1.25, 1.5, 2, 3]) {
            for (const pt of [0, 1, 72, 595.276, 841.89]) {
                expect(toModel(toCss(pt, scale), scale)).toBeCloseTo(pt, 10);
            }
        }
    });

    it("leaves the origin at the origin", () => {
        expect(toCss(0, 2)).toBe(0);
        expect(toModel(0, 2)).toBe(0);
    });

    it("degenerates rather than guards at scale 0", () => {
        // Pinned, not endorsed. Nothing calls these before a page has been
        // measured, so a zero scale never reaches here — but if that ever
        // changes, the failure is Infinity spreading through stored geometry
        // rather than a thrown error, and this is where to add the guard.
        expect(toCss(100, 0)).toBe(0);
        expect(toModel(100, 0)).toBe(Infinity);
    });
});

describe("flipY", () => {
    // The single place the origin flips: model space counts y downward from the
    // top, pdf-lib counts it upward from the bottom.
    const A4_HEIGHT = 841.89;

    it("maps the top of the page to the top", () => {
        expect(flipY(0, A4_HEIGHT)).toBe(A4_HEIGHT);
    });

    it("maps the bottom of the page to zero", () => {
        expect(flipY(A4_HEIGHT, A4_HEIGHT)).toBe(0);
    });

    it("leaves the middle of the page alone", () => {
        expect(flipY(A4_HEIGHT / 2, A4_HEIGHT)).toBeCloseTo(A4_HEIGHT / 2, 10);
    });

    it("is an involution, so one function converts both ways", () => {
        // exportPdf relies on this: it flips model → pdf-lib with the same call
        // the editor would use to flip back.
        for (const y of [0, 1, 100, 420.5, A4_HEIGHT]) {
            expect(flipY(flipY(y, A4_HEIGHT), A4_HEIGHT)).toBeCloseTo(y, 10);
        }
    });

    it("keeps a point above the page above it after flipping", () => {
        // Continuation pages can carry a y beyond the source page height; the
        // transform stays linear rather than clamping.
        expect(flipY(-10, A4_HEIGHT)).toBe(A4_HEIGHT + 10);
        expect(flipY(A4_HEIGHT + 10, A4_HEIGHT)).toBe(-10);
    });
});
