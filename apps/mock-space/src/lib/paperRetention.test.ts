import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  daysUntilPaperExpiry,
  isPaperExpired,
  PAPER_BUCKET,
  PAPER_RETENTION_DAYS,
  paperExpiresAt,
  paperPath,
} from "./paperRetention";

const DAY = 86_400_000;
const T0 = Date.UTC(2026, 6, 10); // a fixed "now", so nothing depends on the clock

describe("paperPath", () => {
  it("puts every paper under its owner's folder", () => {
    // The bucket's RLS policy compares auth.uid() against the first path segment,
    // so anything else here silently makes uploads unauthorised.
    expect(paperPath("user-1", "attempt-9")).toBe("user-1/attempt-9.pdf");
    expect(paperPath("u", "a").split("/")[0]).toBe("u");
  });
});

describe("expiry", () => {
  it("expires exactly PAPER_RETENTION_DAYS after upload", () => {
    expect(paperExpiresAt(T0)).toBe(T0 + PAPER_RETENTION_DAYS * DAY);
  });

  it("is not expired a moment before the deadline", () => {
    expect(isPaperExpired(T0, paperExpiresAt(T0) - 1)).toBe(false);
  });

  it("is expired at the deadline, and after", () => {
    expect(isPaperExpired(T0, paperExpiresAt(T0))).toBe(true);
    expect(isPaperExpired(T0, paperExpiresAt(T0) + DAY)).toBe(true);
  });

  it("counts whole days remaining, rounding up", () => {
    expect(daysUntilPaperExpiry(T0, T0)).toBe(PAPER_RETENTION_DAYS);
    expect(daysUntilPaperExpiry(T0, T0 + DAY)).toBe(PAPER_RETENTION_DAYS - 1);
    // Part-way through the final day still reads as one day left, not zero.
    expect(daysUntilPaperExpiry(T0, paperExpiresAt(T0) - DAY / 2)).toBe(1);
  });

  it("never reports negative days once expired", () => {
    expect(daysUntilPaperExpiry(T0, paperExpiresAt(T0))).toBe(0);
    expect(daysUntilPaperExpiry(T0, paperExpiresAt(T0) + 99 * DAY)).toBe(0);
  });
});

/**
 * api/prune-papers.js runs on Vercel outside the Vite pipeline, so it cannot
 * import the constants above and repeats them instead. If they drift, papers are
 * deleted on a different schedule from the one the UI promises — or from a bucket
 * that does not exist. Read the source and check.
 */
describe("api/prune-papers.js agrees with these constants", () => {
  const source = readFileSync(new URL("../../api/prune-papers.js", import.meta.url), "utf8");
  // Comments explain what the code deliberately does *not* do, so scan code only.
  const code = source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

  it("uses the same retention window", () => {
    const match = code.match(/const RETENTION_DAYS = (\d+);/);
    expect(match, "RETENTION_DAYS not found in api/prune-papers.js").toBeTruthy();
    expect(Number(match![1])).toBe(PAPER_RETENTION_DAYS);
  });

  it("prunes the same bucket", () => {
    const match = code.match(/const BUCKET = '([^']+)';/);
    expect(match, "BUCKET not found in api/prune-papers.js").toBeTruthy();
    expect(match![1]).toBe(PAPER_BUCKET);
  });

  it("prunes the attempt rows alongside the papers", () => {
    // Answers cannot be exported without their paper, so the two must expire
    // together — otherwise the table fills with rows nothing can ever reopen.
    expect(code).toMatch(/const TABLE = 'mock_attempts';/);
    expect(code).toMatch(/\.from\(TABLE\)[\s\S]{0,80}\.delete\(/);
    expect(code).toMatch(/\.lt\('created_at'/);
  });

  it("refuses requests without the cron secret", () => {
    expect(code).toMatch(/CRON_SECRET/);
    expect(code).toMatch(/status\(401\)/);
  });

  it("deletes through the Storage API, not by dropping storage.objects rows", () => {
    expect(code).toMatch(/\.remove\(/);
    expect(code).not.toMatch(/delete\s+from\s+storage\.objects/i);
  });
});
