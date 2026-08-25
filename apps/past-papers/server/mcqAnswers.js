// Parses a Cambridge multiple-choice mark-scheme row into its answer letter.
//
// A structured mark scheme prints prose against a bracketed mark token —
// marksInRegion (page-chars.js) sums those "[n]" tokens for the total-marks
// footer, and compose-pdf.js's own comment on collectQuestionMarks notes that
// "multiple-choice papers never print one". A multiple-choice mark scheme
// instead prints one table row per question: question number, answer letter,
// marks — e.g. "1 A 1". Verified against real corpus PDFs (0455 Paper 1,
// 0610/0620/0625 Paper 2, May/June 2018): every row reads exactly
// "<label> <letter> 1", with real space characters — not glued-together table
// cells — so a plain whitespace split is enough.
//
// Reads the same merged `lines` shape page-chars.js's mergeLines and
// compose-pdf.js's own mergeMarkParts both produce (`{ y, text }`), so a row
// split across pdf.js/content-stream text runs still reads as one string.

const ANSWER_ROW_RE = /^(\S+)\s+([A-D])\s+\d+\s*$/;
const BARE_LETTER_RE = /^[A-D]$/;

/**
 * `qLabel` is the question's printed number, string-normalised the same way
 * `loadIndex` keys `byQ` in compose-pdf.js (`String(q)`), e.g. "1", "27".
 *
 * Returns the answer letter, or null if the region does not read as a single
 * multiple-choice row for that question. The caller treats null as "this is
 * not (or not readably) a multiple-choice paper" rather than raising, so a
 * paper composes exactly as it always has when extraction can't confirm MCQ.
 */
export function answerInRegion({ lines, height }, yTop, yBot, qLabel) {
  const top = Math.max(0, yTop ?? 0);
  const bottom = yBot === null || yBot === undefined ? height : Math.min(height, yBot);

  const inRegion = lines.filter((line) => line.y >= top && line.y <= bottom && line.text.trim());
  if (inRegion.length === 0) return null;

  // The row for this exact question: "<label> <letter> <marks>". Checked
  // first and matched on the leading token, not "any A–D row in the region",
  // so a neighbouring row swept in by crop headroom is never mistaken for
  // this question's own answer.
  for (const line of inRegion) {
    const m = ANSWER_ROW_RE.exec(line.text.trim());
    if (m && m[1] === qLabel) return m[2];
  }

  // A tightly-cropped region can clip the leading label off its own row,
  // leaving only the letter (± the marks column). Accept that when exactly
  // one line in the region resolves to a bare letter — two would be
  // ambiguous, so this is deliberately not a fallback for a whole page.
  const bare = inRegion.filter((line) => BARE_LETTER_RE.test(line.text.trim()));
  return bare.length === 1 ? bare[0].text.trim() : null;
}
