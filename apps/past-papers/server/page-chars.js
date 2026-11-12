// Region tests over one source page's text: "does this crop region hold any
// actual content?", "where does its content end?" and "which mark tokens fall
// inside it?".
//
// This is the JS half of `has_content` / `tighten_bottom` in _build_topicals.py.
// Every function here is pure geometry over a page shape that compose-pdf.js
// builds straight from the raw content stream (pageMarkLines /
// textModelFromLines):
//   `{runs, height}`  — runs are `{y, bottom, n}` in top-origin points
//   `{lines, height}` — lines are `{y, text}` (mark tokens)
//
// These shapes used to come from pdf.js's getTextContent(), which kept failing
// in the Vercel runtime while working locally (missing standard fonts, then a
// missing DOMMatrix, then still failing after both were fixed). Every caller
// fails closed, so in prod no crop was ever trimmed and no header-only sliver
// was ever dropped. Generated papers filled up with full-page crops and pages
// holding nothing but the next source page's number. Reading the content
// stream with pdf-lib has no runtime dependency to go missing.

// Mirrors `has_content`: count glyphs inside the band, ignoring the header strip
// at the top and the footer strip at the bottom, and call the region blank below
// `minChars`. Returns true when the region carries real content.
export function regionHasContent(
  { runs, height },
  yTop,
  yBot,
  { headerSkip, footerSkip, minChars },
) {
  const regionTop = Math.max(0, yTop);
  const regionBot = yBot === null ? height : Math.min(height, yBot);
  const testTop = Math.max(regionTop, headerSkip);
  const testBot = Math.min(regionBot, height - footerSkip);
  if (testTop >= testBot) return false;

  let count = 0;
  for (const run of runs) {
    if (run.y >= testTop && run.y <= testBot) {
      count += run.n;
      if (count >= minChars) return true;
    }
  }
  return false;
}

// Cambridge prints "[3]" against every part of a structured question — the mark
// allocation. This is the only place marks exist for this app: questions_metadata
// has no marks column and the R2 `_questions.json` / `_mark_schemes.json` indexes
// carry crop geometry only, never the value. Reads merged same-baseline `lines`,
// so a "[3]" drawn as several adjacent show-text operators still reads as one
// string.
//
// Returns one entry per bracketed token found with its line's baseline `y` and
// its ordinal position within that line (`i`) — the caller dedupes on those,
// since 0455's `stem_specs` crop can overlap the sub-part crop that follows it
// and both would otherwise see the same "[2]" and double-count it.
const MARK_TOKEN_RE = /\[(\d{1,2})\]/g;

export function marksInRegion({ lines, height }, yTop, yBot) {
  const regionTop = Math.max(0, yTop);
  const regionBot = yBot === null || yBot === undefined ? height : Math.min(height, yBot);
  const hits = [];
  for (const line of lines) {
    if (line.y < regionTop || line.y > regionBot) continue;
    let i = 0;
    for (const m of line.text.matchAll(MARK_TOKEN_RE)) {
      hits.push({ y: line.y, i, marks: Number(m[1]) });
      i++;
    }
  }
  return hits;
}

// `tighten_bottom` from _build_topicals.py: pull a crop's lower bound up to the
// last line of real content.
//
// A record that is the last on its page carries the sentinel, so its crop runs
// to the physical bottom of the page — dragging in the blank remainder and the
// © UCLES footer. That is what makes a near-empty page occupy a whole output
// page: the "BLANK PAGE" separator and the closing acknowledgements block both
// hold enough characters to pass the content test, so only trimming keeps them
// from spreading over a full page. Returns `yBot` unchanged when the region
// holds no text.
export function tightenBottom({ runs, height }, yTop, yBot, { footerSkip, pad }) {
  const hardBottom = yBot === null ? height : Math.min(height, yBot);
  const cap = Math.min(hardBottom, height - footerSkip);

  let deepest = null;
  for (const run of runs) {
    if (run.y >= yTop && run.y <= cap) {
      if (deepest === null || run.bottom > deepest) deepest = run.bottom;
    }
  }
  if (deepest === null) return yBot;
  return Math.min(hardBottom, deepest + pad);
}
