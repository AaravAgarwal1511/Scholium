// Query-param handling for /open?paper=<id>&title=<name>[&mcq=1], the entry
// point for a paper handed off from Past Papers. Pulled out of OpenPaperPage
// so the parsing and the same-origin redirect target can be unit tested
// without rendering React.

export interface OpenPaperParams {
  paperId: string | null;
  title: string;
  /** A hint, not the authority — see mockSpaceHandoff.ts's stageForMockSpace.
   *  OpenPaperPage still validates the sidecar it fetches on the strength
   *  of this before trusting it. */
  mcq: boolean;
}

export function parseOpenPaperParams(searchParams: URLSearchParams): OpenPaperParams {
  return {
    paperId: searchParams.get("paper"),
    title: searchParams.get("title") || "Generated Paper",
    mcq: searchParams.get("mcq") === "1",
  };
}

/**
 * Where to send a signed-out visitor to sign in, so they land back on this
 * exact /open link afterwards. Always same-origin — built from this route's
 * own query string, never from anything an attacker could redirect through —
 * which is what lets Auth.tsx trust its `next` param without a separate check
 * here.
 */
export function signInRedirectTarget(searchParams: URLSearchParams): string {
  return `/signin?next=${encodeURIComponent(`/open?${searchParams.toString()}`)}`;
}
