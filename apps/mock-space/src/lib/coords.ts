/**
 * Mock Space uses one canonical geometry space, called *model space*:
 *
 *   PDF points (1/72"), origin at the page's TOP-LEFT, y increasing downward.
 *
 * Everything persisted — box positions, box widths, stroke points — is in model
 * space. Screen pixels are always derived, never stored, so zoom level and screen
 * DPI cannot make the editor and the export disagree.
 *
 * `loadPdf()` rejects rotated pages and pages whose crop box does not start at
 * (0, 0). That guard is what lets this module stay this small: with them ruled
 * out, screen ↔ model is a uniform scale and model ↔ pdf-lib is one y-flip.
 */

/** Model points → CSS pixels at the given zoom. */
export function toCss(pt: number, scale: number): number {
  return pt * scale;
}

/** CSS pixels → model points at the given zoom. */
export function toModel(px: number, scale: number): number {
  return px / scale;
}

/**
 * Model y (top-origin, down) → pdf-lib y (bottom-origin, up).
 *
 * This is the only place the origin flips. It is an involution: applying it twice
 * returns the input, so the same function converts in both directions.
 */
export function flipY(y: number, pageHeightPt: number): number {
  return pageHeightPt - y;
}
