import { describe, expect, it } from "vitest";
import { choose, createMcqState, isMcqPayload, score, type McqQuestion, type McqState } from "./mcq";

const q = (over: Partial<McqQuestion> = {}): McqQuestion => ({
  seq: 1,
  label: "June 2018 Q1",
  answer: "A",
  bands: [{ page: 0, yTopPt: 72, yBotPt: 183 }],
  ...over,
});

describe("createMcqState", () => {
  it("starts every question unanswered", () => {
    const state = createMcqState([q({ seq: 1 }), q({ seq: 2 })]);
    expect(state.choices).toEqual([null, null]);
    expect(state.questions).toHaveLength(2);
  });
});

describe("choose", () => {
  it("records a choice at the given index", () => {
    const state = createMcqState([q()]);
    const next = choose(state, 0, "B");
    expect(next.choices).toEqual(["B"]);
  });

  it("is a no-op once a question has already been answered — the integrity guarantee", () => {
    const answered = choose(createMcqState([q()]), 0, "B");
    const reAnswered = choose(answered, 0, "C");
    expect(reAnswered.choices).toEqual(["B"]);
    expect(reAnswered).toBe(answered); // no new object when nothing changed
  });

  it("ignores an out-of-range index", () => {
    const state = createMcqState([q()]);
    expect(choose(state, 5, "A")).toBe(state);
    expect(choose(state, -1, "A")).toBe(state);
  });

  it("does not mutate the original state", () => {
    const state = createMcqState([q()]);
    choose(state, 0, "B");
    expect(state.choices).toEqual([null]);
  });
});

describe("score", () => {
  it("counts correct, answered and total", () => {
    const state: McqState = {
      questions: [q({ seq: 1, answer: "A" }), q({ seq: 2, answer: "B" }), q({ seq: 3, answer: "C" })],
      choices: ["A", "D", null],
    };
    expect(score(state)).toEqual({ correct: 1, answered: 2, total: 3 });
  });

  it("is all zeros for a freshly created state", () => {
    expect(score(createMcqState([q(), q({ seq: 2 })]))).toEqual({
      correct: 0,
      answered: 0,
      total: 2,
    });
  });
});

describe("isMcqPayload", () => {
  const validPayload = { questions: [q()] };

  it("accepts a well-formed sidecar", () => {
    expect(isMcqPayload(validPayload)).toBe(true);
  });

  it("accepts extra fields it doesn't care about (subject, component)", () => {
    expect(isMcqPayload({ ...validPayload, subject: "0625", component: "Paper 2" })).toBe(true);
  });

  it("rejects null and non-objects", () => {
    expect(isMcqPayload(null)).toBe(false);
    expect(isMcqPayload(undefined)).toBe(false);
    expect(isMcqPayload("not an object")).toBe(false);
    expect(isMcqPayload(42)).toBe(false);
  });

  it("rejects a missing questions array", () => {
    expect(isMcqPayload({})).toBe(false);
  });

  it("rejects an empty questions array", () => {
    expect(isMcqPayload({ questions: [] })).toBe(false);
  });

  it("rejects a question missing its answer", () => {
    const withoutAnswer: Record<string, unknown> = { ...q() };
    delete withoutAnswer.answer;
    expect(isMcqPayload({ questions: [withoutAnswer] })).toBe(false);
  });

  it("rejects a letter outside A–D", () => {
    expect(isMcqPayload({ questions: [{ ...q(), answer: "E" }] })).toBe(false);
  });

  it("rejects a question with no bands", () => {
    expect(isMcqPayload({ questions: [{ ...q(), bands: [] }] })).toBe(false);
  });

  it("rejects a band where yTopPt is not before yBotPt — the off-page case", () => {
    expect(
      isMcqPayload({ questions: [{ ...q(), bands: [{ page: 0, yTopPt: 100, yBotPt: 50 }] }] }),
    ).toBe(false);
  });

  it("rejects a band with a negative page index", () => {
    expect(
      isMcqPayload({ questions: [{ ...q(), bands: [{ page: -1, yTopPt: 0, yBotPt: 10 }] }] }),
    ).toBe(false);
  });

  it("rejects a non-array questions field", () => {
    expect(isMcqPayload({ questions: "nope" })).toBe(false);
  });

  it("rejects one bad question among otherwise-good ones", () => {
    expect(isMcqPayload({ questions: [q({ seq: 1 }), { ...q({ seq: 2 }), answer: "Z" }] })).toBe(
      false,
    );
  });
});
