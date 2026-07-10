export type Tool = "write" | "draw" | "erase";

/**
 * Characters an exam answer needs but a keyboard cannot produce. Every one of these
 * is checked against the bundled font by textLayout.test.ts, because a glyph the
 * font lacks would export as a hollow box.
 */
export const SYMBOL_GROUPS: ReadonlyArray<{ label: string; symbols: readonly string[] }> = [
  { label: "Maths", symbols: ["×", "÷", "±", "≈", "≤", "≥", "∝", "√", "∞", "∫", "Σ", "−"] },
  { label: "Science", symbols: ["°", "→", "⇌", "↔", "∴", "·", "⁻", "²", "³", "½", "¼", "¾"] },
  { label: "Greek", symbols: ["α", "β", "γ", "Δ", "θ", "λ", "μ", "π", "σ", "Ω", "∠", "⊥"] },
];
