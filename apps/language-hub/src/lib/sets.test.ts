import { describe, expect, it } from "vitest";
import { splitItems } from "./sets";

const items = Array.from({ length: 31 }, (_, i) => `t${i}`);

describe("splitItems", () => {
  it.each([2, 3, 4, 7, 31])("deals 31 items into %i near-equal groups with no loss or duplicates", (parts) => {
    const groups = splitItems(items, parts);
    expect(groups).toHaveLength(parts);
    const sizes = groups.map((g) => g.length);
    expect(Math.max(...sizes) - Math.min(...sizes)).toBeLessThanOrEqual(1);
    expect(groups.flat().sort()).toEqual([...items].sort());
  });

  it("is random: a different rng gives a different allocation", () => {
    const a = splitItems(items, 3, () => 0.1);
    const b = splitItems(items, 3, () => 0.9);
    expect(a).not.toEqual(b);
  });

  it("does not mutate its input", () => {
    const copy = [...items];
    splitItems(items, 4);
    expect(items).toEqual(copy);
  });

  it.each([1, 0, -2, 2.5, 32])("rejects %s parts", (parts) => {
    expect(() => splitItems(items, parts)).toThrow(RangeError);
  });
});
