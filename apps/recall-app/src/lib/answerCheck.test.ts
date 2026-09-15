import { describe, it, expect } from "vitest";
import {
  checkPass3Answer,
  checkPass4Answer,
  checkPass3AnswerChemistry,
  checkPass4AnswerChemistry,
  chemistryPrimaryTerm,
} from "./answerCheck";

/**
 * Pass 3 accepts a typed answer that is "close enough"; Pass 4 accepts one that
 * contains "enough of the key words". Both thresholds are product decisions a
 * refactor could silently move, so they are pinned here rather than described.
 */

describe("checkPass3Answer — normalisation", () => {
  it("accepts an exact match", () => {
    expect(checkPass3Answer("mitochondria", "mitochondria")).toBe(true);
  });

  it("ignores case", () => {
    expect(checkPass3Answer("MiToChOnDrIa", "mitochondria")).toBe(true);
  });

  it("ignores a leading article on either side", () => {
    expect(checkPass3Answer("the nucleus", "nucleus")).toBe(true);
    expect(checkPass3Answer("nucleus", "the nucleus")).toBe(true);
    expect(checkPass3Answer("an electron", "the electron")).toBe(true);
  });

  it("strips only a *leading* article, not one mid-answer", () => {
    // "rate of the reaction" keeps its inner "the"; if the regex were global the
    // two sides would collapse to the same string and this would pass.
    expect(checkPass3Answer("rate of reaction", "rate of the reaction")).toBe(false);
  });

  it("ignores punctuation", () => {
    expect(checkPass3Answer("photosynthesis!", "photosynthesis")).toBe(true);
    expect(checkPass3Answer("don't", "dont")).toBe(true);
  });

  it("collapses runs of whitespace", () => {
    expect(checkPass3Answer("  cell   wall  ", "cell wall")).toBe(true);
  });

  it("treats a hyphen as nothing, not as a space", () => {
    // PUNCT deletes "-", so "well-known" normalises to "wellknown", NOT "well known".
    expect(checkPass3Answer("well-known", "wellknown")).toBe(true);

    // Shown on a 2-character answer, where the edit tolerance is 0 and so cannot
    // paper over the difference: a hyphen vanishes, a real space does not.
    expect(checkPass3Answer("p-h", "pH")).toBe(true);
    expect(checkPass3Answer("p h", "pH")).toBe(false);
  });

  it("accepts an empty answer only when the expected answer is empty too", () => {
    expect(checkPass3Answer("", "")).toBe(true);
    expect(checkPass3Answer("", "cell")).toBe(false);
  });
});

describe("checkPass3Answer — edit-distance tolerance", () => {
  // tolerance() is a step function of the *correct* answer's normalised length:
  //   ≤4 chars → 0 edits, ≤8 chars → 1 edit, longer → 2 edits.

  it("allows no typos at all on an answer of 4 characters or fewer", () => {
    expect(checkPass3Answer("cell", "cell")).toBe(true);
    expect(checkPass3Answer("celt", "cell")).toBe(false);
    expect(checkPass3Answer("cel", "cell")).toBe(false);
  });

  it("allows one typo from 5 characters up", () => {
    expect(checkPass3Answer("atomm", "atoms")).toBe(true); // substitution
    expect(checkPass3Answer("atom", "atoms")).toBe(true); // deletion
    expect(checkPass3Answer("atomss", "atoms")).toBe(true); // insertion
    expect(checkPass3Answer("atmos", "atoms")).toBe(false); // transposition = 2 edits
  });

  it("still allows only one typo at exactly 8 characters", () => {
    expect("electron").toHaveLength(8);
    expect(checkPass3Answer("electrom", "electron")).toBe(true);
    expect(checkPass3Answer("electrum", "electron")).toBe(false);
  });

  it("allows two typos from 9 characters up", () => {
    expect("electrons").toHaveLength(9);
    expect(checkPass3Answer("electron", "electrons")).toBe(true); // 1 edit
    expect(checkPass3Answer("electro", "electrons")).toBe(true); // 2 edits
    expect(checkPass3Answer("electr", "electrons")).toBe(false); // 3 edits
  });

  it("measures tolerance against the correct answer, not the user's", () => {
    // A long wrong answer is not made acceptable by its own length.
    expect(checkPass3Answer("mitochondriaaa", "cell")).toBe(false);
  });
});

describe("checkPass4Answer — key-word extraction", () => {
  it("ignores stop words and single characters when counting key words", () => {
    const result = checkPass4Answer("", "the a an and or of");
    expect(result).toEqual({ correct: true, matched: 0, total: 0 });
  });

  it("counts only the content words", () => {
    // "is", "the", "of" are stop words; "a" is also too short.
    const { total } = checkPass4Answer("", "photosynthesis is the process of a plant");
    expect(total).toBe(3); // photosynthesis, process, plant
  });

  it("ignores punctuation when matching", () => {
    const { correct } = checkPass4Answer("photosynthesis, process, plant", "photosynthesis process plant");
    expect(correct).toBe(true);
  });
});

describe("checkPass4Answer — the 0.7 threshold", () => {
  const TEN = "alpha bravo charlie delta echo foxtrot hotel india juliet kilo";

  it("accepts exactly 70% of the key words", () => {
    const seven = "alpha bravo charlie delta echo foxtrot hotel";
    expect(checkPass4Answer(seven, TEN)).toEqual({ correct: true, matched: 7, total: 10 });
  });

  it("rejects 60%", () => {
    const six = "alpha bravo charlie delta echo foxtrot";
    expect(checkPass4Answer(six, TEN)).toEqual({ correct: false, matched: 6, total: 10 });
  });

  it("accepts everything", () => {
    expect(checkPass4Answer(TEN, TEN)).toEqual({ correct: true, matched: 10, total: 10 });
  });

  it("rejects an empty answer", () => {
    expect(checkPass4Answer("", TEN)).toEqual({ correct: false, matched: 0, total: 10 });
  });
});

describe("checkPass4Answer — fuzzy matching", () => {
  it("forgives one typo in a key word of 5 characters or more", () => {
    const { matched } = checkPass4Answer("mitochondrie", "mitochondria");
    expect(matched).toBe(1);
  });

  it("demands an exact match for key words shorter than 5 characters", () => {
    const { matched } = checkPass4Answer("iom", "ion");
    expect(matched).toBe(0);
  });
});

describe("checkPass4Answer — scoring quirks worth knowing about", () => {
  // Neither of these is obviously wrong, but both let a student score higher than
  // a naive reading of "70% of the key words" suggests. Pinned so that changing
  // the behaviour is a decision rather than an accident.

  it("counts a repeated key word once per occurrence", () => {
    // The correct answer names "cell" three times, so saying it once scores 3/3.
    expect(checkPass4Answer("cell", "cell cell cell")).toEqual({
      correct: true,
      matched: 3,
      total: 3,
    });
  });

  it("lets a single typed word satisfy several similar key words", () => {
    // Key words are not consumed when matched: "hello" is within one edit of
    // "hallo", so one word covers both.
    expect(checkPass4Answer("hello", "hello hallo")).toEqual({
      correct: true,
      matched: 2,
      total: 2,
    });
  });
});

/**
 * Chemistry-only leniency (20260914000000_recall_chemistry_content.sql). These
 * exercise checkPass3AnswerChemistry/checkPass4AnswerChemistry — separate
 * functions used only when a chapter's subject is Chemistry — against real
 * card text from that migration. Nothing above this point is touched by, or
 * should be affected by, these tests.
 */

describe("chemistryPrimaryTerm", () => {
  it("takes the part before the comma in a \"Name, Symbol\" term", () => {
    expect(chemistryPrimaryTerm("Lithium, Li⁺")).toBe("Lithium");
  });

  it("leaves a term with no comma unchanged", () => {
    expect(chemistryPrimaryTerm("Copper(II) Sulfate")).toBe("Copper(II) Sulfate");
  });

  it("leaves a term with more than one comma unchanged", () => {
    // The reactivity-series "no reaction" summary card — must not shorten to "Carbon".
    expect(chemistryPrimaryTerm("Carbon, Hydrogen, Copper, Silver and Gold")).toBe(
      "Carbon, Hydrogen, Copper, Silver and Gold",
    );
  });
});

describe("checkPass3AnswerChemistry", () => {
  it("accepts the bare name of a compound term", () => {
    expect(checkPass3AnswerChemistry("Lithium", "Lithium, Li⁺")).toBe(true);
  });

  it("accepts the symbol alone, folding unicode charge notation to ASCII", () => {
    expect(checkPass3AnswerChemistry("Li+", "Lithium, Li⁺")).toBe(true);
    expect(checkPass3AnswerChemistry("Ca2+", "Calcium, Ca²⁺")).toBe(true);
  });

  it("still accepts the full compound term", () => {
    expect(checkPass3AnswerChemistry("Lithium, Li⁺", "Lithium, Li⁺")).toBe(true);
  });

  it("does not shorten a term with more than one comma", () => {
    // Typing just "Carbon" must not satisfy the 5-element summary card.
    expect(
      checkPass3AnswerChemistry("Carbon", "Carbon, Hydrogen, Copper, Silver and Gold"),
    ).toBe(false);
  });

  it("rejects a sibling card's name", () => {
    expect(checkPass3AnswerChemistry("Sodium", "Lithium, Li⁺")).toBe(false);
  });

  it("behaves like the default checker on a comma-free term", () => {
    expect(checkPass3AnswerChemistry("Magnesum", "Magnesium")).toBe(true); // 1 edit, 9 chars
  });
});

describe("checkPass4AnswerChemistry", () => {
  // The six real flame-tests definitions, in migration order.
  const FLAME = [
    "Produces a red flame in the flame test.",
    "Produces a yellow flame in the flame test.",
    "Produces a lilac flame in the flame test.",
    "Produces an orange-red flame in the flame test.",
    "Produces a light green flame in the flame test.",
    "Produces a blue-green flame in the flame test.",
  ];

  // The six real hydrated-salts definitions — "white" is shared by exactly 3/6.
  const SALTS = [
    "Formula CuSO₄·5H₂O; blue crystals.",
    "Formula CoCl₂·6H₂O; pink crystals.",
    "Formula FeSO₄·7H₂O; green crystals.",
    "Formula MgSO₄·7H₂O; white crystals.",
    "Formula Na₂CO₃·10H₂O; white crystals.",
    "Formula CaSO₄·2H₂O; white crystals.",
  ];

  // The six real industrial-catalysts definitions.
  const CATALYSTS = [
    "Uses an iron catalyst.",
    "Uses a vanadium(V) oxide catalyst.",
    "Uses a nickel catalyst.",
    "Uses a platinum-rhodium catalyst.",
    "Uses enzymes in yeast as the catalyst.",
    "Uses a zeolite ZSM-5 catalyst.",
  ];

  it("scores a terse but correct answer against the chapter's distinguishing word", () => {
    // "Produces"/"flame"/"test" are boilerplate shared by all 6 flame cards,
    // so only "red" survives to be scored — checkPass4Answer would score this
    // 1/5 = 20% and fail it.
    expect(checkPass4AnswerChemistry("Red", FLAME[0], FLAME)).toEqual({
      correct: true,
      matched: 1,
      total: 1,
    });
  });

  it("fails the wrong colour even dressed in the right boilerplate — the inversion checkPass4Answer gets backwards", () => {
    // Copper's ("blue-green") full sentence, answered on Lithium's ("red") card.
    expect(checkPass4AnswerChemistry(FLAME[5], FLAME[0], FLAME).correct).toBe(false);
    // Documents that the DEFAULT checker gets this backwards (4/5 = 80%, passes)
    // — unchanged on purpose; this is exactly why the chemistry variant exists.
    expect(checkPass4Answer(FLAME[5], FLAME[0]).correct).toBe(true);
  });

  it("keeps a word shared by exactly half the chapter — it is the most informative word a chapter can have", () => {
    // "white" is shared by 3 of 6 hydrated-salts cards; it must NOT be treated
    // as boilerplate, or a sibling's colour would pass on Magnesium Sulfate's card.
    expect(checkPass4AnswerChemistry("MgSO4.7H2O, white crystals", SALTS[3], SALTS)).toEqual({
      correct: true,
      matched: 2,
      total: 2,
    });
    expect(
      checkPass4AnswerChemistry("MgSO4.7H2O, blue crystals", SALTS[3], SALTS).correct,
    ).toBe(false);
  });

  it("accepts a hyphenated key word typed as two separate words", () => {
    // PUNCT deletes hyphens, so "platinum-rhodium" is one key word; "uses"/
    // "catalyst" are boilerplate shared by all 6 catalyst cards.
    expect(
      checkPass4AnswerChemistry("platinum rhodium", CATALYSTS[3], CATALYSTS).correct,
    ).toBe(true);
  });

  it("never auto-passes when every word in the chapter is shared — falls back to the full set", () => {
    const def = "Reacts with acid quickly.";
    expect(checkPass4AnswerChemistry("", def, [def, def])).toEqual({
      correct: false,
      matched: 0,
      total: 3, // "reacts", "acid", "quickly" — "with" is a stop word
    });
  });

  it("grades exactly like the default checker in a one-card chapter", () => {
    const def = "Melts easily.";
    expect(checkPass4AnswerChemistry("", def, [def])).toEqual(checkPass4Answer("", def));
  });
});
