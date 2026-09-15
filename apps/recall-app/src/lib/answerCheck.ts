const ARTICLES = /^(the|a|an)\s+/i;
const PUNCT = /[.,/#!$%^&*;:{}=\-_`~()?'"]/g;
const STOP_WORDS = new Set([
  "the","a","an","and","or","but","in","on","at","to","for","of","with","by",
  "is","are","was","were","be","been","being","it","its","that","this","which","from","as","into",
]);

function normalizeText(text: string): string {
  return text.toLowerCase().replace(PUNCT, "").replace(ARTICLES, "").replace(/\s+/g, " ").trim();
}

function levenshtein(a: string, b: string): number {
  const m = a.length, n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, (_, i) => {
    const row = new Array(n + 1).fill(0);
    row[0] = i;
    return row;
  });
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++)
    for (let j = 1; j <= n; j++)
      dp[i][j] = a[i - 1] === b[j - 1]
        ? dp[i - 1][j - 1]
        : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
  return dp[m][n];
}

function tolerance(s: string): number {
  const len = s.length;
  if (len <= 4) return 0;
  if (len <= 8) return 1;
  return 2;
}

export function checkPass3Answer(userInput: string, correctAnswer: string): boolean {
  const user = normalizeText(userInput);
  const correct = normalizeText(correctAnswer);
  if (user === correct) return true;
  return levenshtein(user, correct) <= tolerance(correct);
}

export interface Pass4Result {
  correct: boolean;
  matched: number;
  total: number;
}

export function checkPass4Answer(userInput: string, correctAnswer: string): Pass4Result {
  const keyWords = correctAnswer
    .toLowerCase()
    .replace(PUNCT, "")
    .split(/\s+/)
    .filter(w => w.length > 1 && !STOP_WORDS.has(w));

  if (keyWords.length === 0) return { correct: true, matched: 0, total: 0 };

  const userWords = userInput.toLowerCase().replace(PUNCT, "").split(/\s+/);

  const matched = keyWords.filter(kw =>
    userWords.some(uw => uw === kw || (kw.length >= 5 && levenshtein(uw, kw) <= 1))
  ).length;

  return { correct: matched / keyWords.length >= 0.7, matched, total: keyWords.length };
}

// ── Chemistry-only leniency ─────────────────────────────────────────────────
// The Chemistry content (20260914000000_recall_chemistry_content.sql) is shaped
// unlike the Physics/Economics content the two checkers above were tuned on:
// terms are "Name, Symbol" pairs, and definitions are chapter-wide templates
// ("Produces a ___ flame in the flame test."), so boilerplate outweighs the one
// word that actually varies. These variants are used only when the chapter's
// subject is Chemistry; checkPass3Answer/checkPass4Answer above are untouched.

const SUPERSCRIPT_SUBSCRIPT: Record<string, string> = {
  "⁰": "0", "¹": "1", "²": "2", "³": "3", "⁴": "4", "⁵": "5",
  "⁶": "6", "⁷": "7", "⁸": "8", "⁹": "9", "⁺": "+", "⁻": "-",
  "₀": "0", "₁": "1", "₂": "2", "₃": "3", "₄": "4", "₅": "5",
  "₆": "6", "₇": "7", "₈": "8", "₉": "9",
};
const SUPERSCRIPT_SUBSCRIPT_RE = /[⁰¹²³⁴⁵⁶⁷⁸⁹⁺⁻₀₁₂₃₄₅₆₇₈₉]/g;

/** Rewrites chemistry notation as what a student can actually type: "Mg²⁺" → "Mg2+". */
function foldChemistryNotation(text: string): string {
  return text
    .replace(SUPERSCRIPT_SUBSCRIPT_RE, (ch) => SUPERSCRIPT_SUBSCRIPT[ch])
    // A hydrate dot joins one formula ("CuSO₄·5H₂O" → "CuSO45H2O", which is also
    // what typing "CuSO4.5H2O" gives once PUNCT drops the full stop); a reaction
    // arrow separates two formulas, so it becomes a space.
    .replace(/·/g, "")
    .replace(/→/g, " ");
}

/**
 * "Lithium, Li⁺" → "Lithium". Only a term that is exactly one "name, symbol"
 * pair is shortened — the reactivity-series summary card "Carbon, Hydrogen,
 * Copper, Silver and Gold" (3 commas) must not answer to "Carbon".
 */
export function chemistryPrimaryTerm(term: string): string {
  const parts = term.split(",");
  return parts.length === 2 ? parts[0].trim() : term;
}

/** Pass 3, but "Lithium, Li⁺" also answers to "Lithium" or to "Li+". */
export function checkPass3AnswerChemistry(userInput: string, correctAnswer: string): boolean {
  const user = normalizeText(foldChemistryNotation(userInput));
  const parts = correctAnswer.split(",");
  const candidates =
    parts.length === 2 ? [correctAnswer, parts[0].trim(), parts[1].trim()] : [correctAnswer];
  return candidates.some((candidate) => {
    const correct = normalizeText(foldChemistryNotation(candidate));
    return user === correct || levenshtein(user, correct) <= tolerance(correct);
  });
}

/**
 * Pass 4, scored on what makes this card different from the rest of its chapter.
 * Without this, a student who writes only "Red" on the Lithium flame-test card
 * scores 1/5 and fails, while one who writes the *wrong* colour in the right
 * template ("Produces a blue flame in the flame test.") scores 4/5 and passes.
 */
export function checkPass4AnswerChemistry(
  userInput: string,
  correctAnswer: string,
  chapterDefinitions: string[],
): Pass4Result {
  const keywordsOf = (text: string) =>
    foldChemistryNotation(text)
      .toLowerCase()
      .replace(PUNCT, "")
      .split(/\s+/)
      .filter((w) => w.length > 1 && !STOP_WORDS.has(w));

  const allKeywords = keywordsOf(correctAnswer);
  if (allKeywords.length === 0) return { correct: true, matched: 0, total: 0 };

  // Boilerplate = present in MORE THAN half the chapter's definitions. Strictly
  // more, not "at least": a word in exactly half a chapter carries the MOST
  // information any word in that chapter can ("insoluble" splits cation-tests'
  // 8 cards 4/4; "white" splits hydrated-salts' 6 cards 3/3) — dropping it lets
  // a sibling card's answer pass on this card, recreating the exact inversion
  // bug this function exists to fix.
  const chapterKeywords = chapterDefinitions.map((d) => new Set(keywordsOf(d)));
  const isBoilerplate = (word: string) =>
    chapterKeywords.filter((set) => set.has(word)).length * 2 > chapterKeywords.length;

  // Equation coefficients ("2K", "2H₂O" → "2h2o") lead with a digit; formulae
  // and charges ("Mg²⁺" → "mg2+", "CuSO₄·5H₂O" → "cuso45h2o") never do — only
  // chemistry-reactivity-series has any of these.
  const isEquationCoefficient = (word: string) => /^\d/.test(word);

  let keyWords = allKeywords.filter((w) => !isBoilerplate(w) && !isEquationCoefficient(w));
  // Nothing distinctive left (e.g. a one-card chapter): fall back to the full
  // set rather than auto-passing.
  if (keyWords.length === 0) keyWords = allKeywords;

  const typed = foldChemistryNotation(userInput).toLowerCase().replace(PUNCT, "").split(/\s+/);
  // PUNCT deletes hyphens, so "platinum-rhodium" is one key word; also accept
  // adjacent typed words concatenated, so "platinum rhodium" satisfies it too.
  const candidates = typed.concat(typed.slice(0, -1).map((w, i) => w + typed[i + 1]));

  const matched = keyWords.filter((kw) =>
    candidates.some((w) => w === kw || (kw.length >= 5 && levenshtein(w, kw) <= 1)),
  ).length;

  return { correct: matched / keyWords.length >= 0.7, matched, total: keyWords.length };
}
