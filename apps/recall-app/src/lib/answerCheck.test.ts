import { describe, it, expect } from "vitest";
import { checkPass3Answer, checkPass4Answer } from "./answerCheck";

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
