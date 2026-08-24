// @vitest-environment node
//
// This file needs node's real `import.meta.url` (a `file:` URL) to resolve the
// cross-app path below. jsdom — the "unit" project's default environment,
// needed by every other test in this directory for DOM globals — gives
// import.meta.url a synthetic, non-file URL instead, so readFileSync rejects it.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { MOCK_SPACE_URL } from "./mockSpaceUrl";

/**
 * mock-space owns the mock-space-papers bucket and its path convention
 * (apps/mock-space/src/lib/paperRetention.ts). This app cannot import that
 * module — it belongs to a different workspace package and `pnpm boundaries`
 * forbids cross-app imports — so the bucket name and path shape are duplicated
 * in mockSpaceHandoff.ts instead. If they drift, an upload lands somewhere
 * mock-space's RLS policy doesn't grant, or somewhere `/open` never looks. Read
 * the source and check, the same way mock-space's own paperRetention.test.ts
 * checks api/prune-papers.js.
 */
describe("mockSpaceHandoff agrees with mock-space's paperRetention.ts", () => {
  const source = readFileSync(
    new URL("../../../mock-space/src/lib/paperRetention.ts", import.meta.url),
    "utf8",
  );
  const handoff = readFileSync(new URL("./mockSpaceHandoff.ts", import.meta.url), "utf8");

  it("uploads into the same bucket mock-space reads from", () => {
    const match = source.match(/export const PAPER_BUCKET = "([^"]+)";/);
    expect(match, "PAPER_BUCKET not found in mock-space's paperRetention.ts").toBeTruthy();

    const bucketMatch = handoff.match(/const PAPER_BUCKET = "([^"]+)";/);
    expect(bucketMatch, "PAPER_BUCKET not found in mockSpaceHandoff.ts").toBeTruthy();

    expect(bucketMatch![1]).toBe(match![1]);
  });

  it("stages under the same {userId}/{id}.pdf shape mock-space's RLS policy expects", () => {
    // mock-space's own paperPath — the RLS policy compares auth.uid() against
    // the first path segment, so this shape is load-bearing, not cosmetic.
    expect(source).toMatch(/`\$\{userId\}\/\$\{attemptId\}\.pdf`/);
    expect(handoff).toMatch(/`\$\{userId\}\/\$\{id\}\.pdf`/);
  });

  it("stages the MCQ sidecar under the same {userId}/{id}.json shape mock-space downloads from", () => {
    // mock-space's own sidecarPath in paperRetention.ts — see downloadSidecar
    // in paperStorage.ts, what /open actually reads.
    expect(source).toMatch(/`\$\{userId\}\/\$\{id\}\.json`/);
    expect(handoff).toMatch(/`\$\{userId\}\/\$\{id\}\.json`/);
  });
});

describe("MOCK_SPACE_URL", () => {
  it("has no trailing slash, so a path can always be appended directly", () => {
    expect(MOCK_SPACE_URL.endsWith("/")).toBe(false);
  });

  // past-papers moved to a custom domain once before while its own OWN_APP_URL
  // constant still said the old *.vercel.app address (see App.tsx's comment on
  // that incident) — the lookup silently missed and nobody noticed until the
  // subtitle looked wrong. mockSpaceUrl.ts's fallback is the same kind of
  // hardcoded copy of a value mock-space owns, just in a different app, so it
  // can go stale the same way. Catch it here instead.
  it("matches mock-space's own OWN_APP_URL", () => {
    const appSource = readFileSync(
      new URL("../../../mock-space/src/App.tsx", import.meta.url),
      "utf8",
    );
    const match = appSource.match(/const OWN_APP_URL = "([^"]+)";/);
    expect(match, "OWN_APP_URL not found in mock-space's App.tsx").toBeTruthy();
    expect(MOCK_SPACE_URL).toBe(match![1]);
  });
});
