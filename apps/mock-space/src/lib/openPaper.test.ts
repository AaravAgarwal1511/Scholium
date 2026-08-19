import { describe, expect, it } from "vitest";
import { parseOpenPaperParams, signInRedirectTarget } from "./openPaper";

describe("parseOpenPaperParams", () => {
  it("reads the handoff id and title from the query string", () => {
    expect(parseOpenPaperParams(new URLSearchParams("paper=abc-123&title=Physics"))).toEqual({
      paperId: "abc-123",
      title: "Physics",
    });
  });

  it("has no paper id when the link is missing one", () => {
    expect(parseOpenPaperParams(new URLSearchParams("")).paperId).toBeNull();
  });

  it("falls back to a generic title when none is given", () => {
    expect(parseOpenPaperParams(new URLSearchParams("paper=abc-123")).title).toBe(
      "Generated Paper",
    );
  });

  it("falls back when title is present but empty", () => {
    expect(parseOpenPaperParams(new URLSearchParams("paper=abc-123&title=")).title).toBe(
      "Generated Paper",
    );
  });
});

describe("signInRedirectTarget", () => {
  it("points back at /open with the same query, url-encoded", () => {
    expect(signInRedirectTarget(new URLSearchParams("paper=abc-123&title=Physics"))).toBe(
      "/signin?next=%2Fopen%3Fpaper%3Dabc-123%26title%3DPhysics",
    );
  });

  it("round-trips through decodeURIComponent back to a same-origin /open path", () => {
    const target = signInRedirectTarget(new URLSearchParams("paper=abc-123"));
    const next = new URL(target, "http://localhost").searchParams.get("next")!;
    expect(next.startsWith("/open?")).toBe(true);
    expect(next.startsWith("//")).toBe(false);
  });
});
