#!/usr/bin/env python3
"""
Extract and clean the term list from a Cambridge IGCSE vocabulary workbook
(French 0520 / Spanish 0530) into a reviewable TSV, one row per term.

Usage:
  python3 scripts/extract-vocab.py <workbook.xlsx> <french|spanish> > out.tsv

The workbook is NOT committed to the repo; pass its path explicitly. The output
TSV is an intermediate — the hand-authored English definitions and the rolled-up
topic sets in src/data/starter-sets/ are the real deliverable.

Each vocabulary sheet has exactly two data columns: A = sub-category, B = the
target-language term. There is no English column. Output columns:

  sheet   sub_category   raw_term   cleaned_term   flags

`flags` is a ';'-joined subset of:
  slash   the raw term held ' / ' (a gender pair or an alternative). The cleaner
          keeps the FIRST segment only — for `beau / belle` that is the masculine
          `beau`; the feminine form is dropped because the quiz matcher
          (src/lib/answer.ts) demands an exact typed string and cannot accept two.
  comma   Spanish gender pair written `doctor (m.), doctora (f.)` — same
          first-segment-only treatment as `slash`.
  review  the cleaned term still looks like a meta/placeholder row (too long, or
          holds '+', '…', 'etc', a leftover '(...)', or a mid-string dash) and
          should be hand-resolved: expanded into real entries or dropped.
  dup     this cleaned term was already emitted earlier in the workbook (the
          source repeats ~110 terms across sheets, e.g. `pays francophone`).

Cleaning rules, applied in order (see the plan for rationale):
  1. drop banner rows  — any cell holds 'Cambridge' or '©', or col B is the bare
     language name, or both columns are empty.
  2. strip() both cells (trailing spaces are pervasive in the source).
  3. ' / ' present      — keep the first segment only.
  4. gender markers     — `(m)`, `(f)`, `(m/f)`, `(pl)` etc. anywhere in the term
     become a leading definite article, matching the house style in
     starterSets.ts (`le pain`, `l'eau`, `el hijo`). French elides `le/la` -> `l'`
     before a vowel or h.
  5. adjective endings  — a trailing `(e)` / `(ne)` / `(le)` on an adjective
     (`amical(e)` -> `amical`) is dropped to the masculine base form.
  6. collapse whitespace, re-strip.
  7. flag, don't fix, anything still meta-shaped; flag cross-sheet duplicates.
"""
import re
import sys

import openpyxl

VOCAB_SHEETS = {
    "High frequency vocabulary",
    "A - Everyday Activities",
    "B- Personal and Social Life",
    "C - The world around us",
    "D - The world of work",
    "E - The international world",
}

VOWEL_RE = re.compile(r"^[aàâäæeéèêëiïîoôöœuùûüy]", re.IGNORECASE)

# A gender/number marker anywhere in the term: " (m)", "(f)", "(m/f)", "(pl)",
# "(m pl)", "(m/pl)", and the Spanish "(m.)" / "(f.)" period forms. Compound
# alternatives come first so alternation captures the whole "m/f", not just "m".
# Deliberately narrow so a real parenthetical (flagged for review) is not eaten.
_M = r"m\.?"
_F = r"f\.?"
_PL = r"pl\.?"
MARKER_RE = re.compile(
    rf"\s*\(\s*({_M}\s*/\s*{_F}|{_F}\s*/\s*{_M}|{_M}\s*/\s*{_PL}|{_F}\s*/\s*{_PL}"
    rf"|{_M}\s*{_PL}|{_F}\s*{_PL}|mpl|fpl|{_M}|{_F}|{_PL})\s*\)",
    re.IGNORECASE,
)

# Spanish gender pair: "doctor (m.), doctora (f.)" — one comma, a marker on each
# side. Split like the ' / ' pairs and keep the masculine (first) form.
COMMA_PAIR_RE = re.compile(r"^(.+?\([mf]\.?\)),\s+(.+\([mf]\.?\))\s*$", re.IGNORECASE)

# A trailing adjective ending in parens: amical(e), bon(ne), nul(le), vieux(...).
ADJ_TAIL_RE = re.compile(r"\(([a-zàâäéèêëïîôöùûüç]{1,5})\)\s*$", re.IGNORECASE)

REVIEW_HINTS = ("+", "…", "...", " etc", " – ", " — ", "/")


def marker_article(marker: str, noun: str, language: str) -> str:
    """Definite article for a noun given its gender/number marker."""
    m = marker.lower().replace(" ", "").replace(".", "")
    plural = "pl" in m
    feminine = m.startswith("f") and "m" not in m.replace("f", "", 1)

    if language == "french":
        if plural:
            return "les "
        if VOWEL_RE.match(noun) or noun[:1].lower() == "h":
            return "l'"
        return "la " if feminine else "le "

    # spanish
    if plural:
        return "las " if feminine else "los "
    return "la " if feminine else "el "


def clean(raw: str, language: str) -> tuple[str, list[str]]:
    flags: list[str] = []
    term = raw.strip()

    if " / " in term:
        flags.append("slash")
        term = term.split(" / ", 1)[0].strip()
    # Spanish also pairs synonyms/genders with a bare slash: `allí/allá`,
    # `terminar/acabar`. Only safe to split when no parens are in play — a slash
    # inside `(izquierdo/derecho)` is not a term boundary.
    elif "/" in term and "(" not in term:
        flags.append("slash")
        term = term.split("/", 1)[0].strip()

    pair = COMMA_PAIR_RE.match(term)
    if pair:
        flags.append("comma")
        term = pair.group(1).strip()

    markers = MARKER_RE.findall(term)
    if markers:
        stripped = MARKER_RE.sub(" ", term).strip()
        stripped = re.sub(r"\s{2,}", " ", stripped)
        article = marker_article(markers[0], stripped, language)
        term = f"{article}{stripped}".strip()

    adj = ADJ_TAIL_RE.search(term)
    if adj:
        term = ADJ_TAIL_RE.sub("", term).strip()

    term = re.sub(r"\s{2,}", " ", term).strip()

    lowered = f" {term.lower()} "
    if len(term) > 40 or "(" in term or any(h in lowered for h in REVIEW_HINTS):
        flags.append("review")

    return term, flags


def main() -> None:
    if len(sys.argv) != 3 or sys.argv[2] not in ("french", "spanish"):
        sys.exit("usage: extract-vocab.py <workbook.xlsx> <french|spanish>")

    path, language = sys.argv[1], sys.argv[2]
    wb = openpyxl.load_workbook(path, read_only=True, data_only=True)

    seen: set[str] = set()
    out = sys.stdout
    out.write("sheet\tsub_category\traw_term\tcleaned_term\tflags\n")

    for ws in wb.worksheets:
        if ws.title not in VOCAB_SHEETS:
            continue
        for row in ws.iter_rows(min_row=1, max_col=8, values_only=True):
            cells = ["" if c is None else str(c) for c in row]
            joined = " ".join(cells)
            if "Cambridge" in joined or "©" in joined:
                continue
            sub_category, raw_term = cells[0].strip(), cells[1].strip()
            if not sub_category or not raw_term:
                continue
            if raw_term.lower() == language:
                continue

            cleaned, flags = clean(raw_term, language)
            if not cleaned:
                continue
            key = cleaned.lower()
            if key in seen:
                flags.append("dup")
            seen.add(key)

            out.write(
                f"{ws.title}\t{sub_category}\t{raw_term}\t{cleaned}\t{';'.join(flags)}\n"
            )

    wb.close()


if __name__ == "__main__":
    main()
