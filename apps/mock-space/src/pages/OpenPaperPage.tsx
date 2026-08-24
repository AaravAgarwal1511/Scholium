import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAttempt } from "@/contexts/AttemptContext";
import { useAuth } from "@/contexts/AuthContext";
import { deletePaper, deleteSidecar, downloadPaper, downloadSidecar } from "@/lib/paperStorage";
import { DEFAULT_MINUTES, clampMinutes, isValidMinutes } from "@/lib/minutes";
import { parseOpenPaperParams, signInRedirectTarget } from "@/lib/openPaper";
import { createMcqState, isMcqPayload } from "@/lib/mcq";
import MinutesPicker from "@/components/MinutesPicker";

function Hero({ subtitle }: { subtitle: string }) {
  return (
    <header className="pt-10 pb-2">
      <h1 className="text-foreground text-3xl sm:text-4xl font-bold tracking-tight">
        Mock Space.
      </h1>
      <p className="mt-2 text-muted-foreground max-w-2xl leading-relaxed">{subtitle}</p>
    </header>
  );
}

/**
 * Entry point for a paper handed off from Past Papers:
 * /open?paper=<id>&title=<name>[&mcq=1].
 *
 * `paper` is a Storage object id past-papers already uploaded into this user's
 * mock-space-papers folder (same RLS-scoped {uid}/{id}.pdf shape startAttempt
 * itself uses). This page downloads it back out, wraps it in a File, and starts
 * an attempt exactly the way HomePage's manual upload does — the handoff copy
 * only ever exists to cross the trip between apps. When `mcq=1` there is also
 * a sidecar under the same id (see paperStorage.ts's downloadSidecar); it is
 * re-validated here rather than trusted on the strength of the query param.
 */
export default function OpenPaperPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user, loadingAuth } = useAuth();
  const { startAttempt, loading: starting, error: attemptError } = useAttempt();

  const { paperId, title, mcq: mcqHint } = parseOpenPaperParams(searchParams);

  const [minutes, setMinutes] = useState(String(DEFAULT_MINUTES));
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const minutesValid = isValidMinutes(minutes);
  const busy = working || starting;

  if (loadingAuth) return null;

  if (!paperId) {
    return (
      <main className="mx-auto max-w-2xl px-6 pb-20">
        <Hero subtitle="This link is missing the paper to open." />
        <p className="mt-4 text-sm text-muted-foreground">
          Go back to Past Papers and generate it again.
        </p>
      </main>
    );
  }

  if (!user) {
    return (
      <main className="mx-auto max-w-2xl px-6 pb-20">
        <Hero subtitle={`Sign in to open "${title}" here.`} />
        <div className="mt-8 flex gap-3">
          <button
            onClick={() => navigate(signInRedirectTarget(searchParams))}
            className="rounded-lg px-5 py-2.5 text-sm font-semibold text-white"
            style={{ background: "hsl(var(--primary))" }}
          >
            Sign in to continue
          </button>
        </div>
      </main>
    );
  }

  async function begin() {
    if (!paperId || !user || !minutesValid) return;
    setError(null);
    setWorking(true);
    try {
      const bytes = await downloadPaper(user.id, paperId);
      if (!bytes) {
        setError(
          "This paper could not be found. It may already have been opened, or the link has expired.",
        );
        return;
      }
      const file = new File([bytes], `${title}.pdf`, { type: "application/pdf" });

      // mcqHint is a hint, not the authority: a missing or malformed sidecar
      // falls back to an ordinary written attempt rather than failing here.
      const payload = mcqHint ? await downloadSidecar(user.id, paperId) : null;
      const mcq = isMcqPayload(payload) ? createMcqState(payload.questions) : null;

      const ok = await startAttempt(file, Number(minutes) * 60_000, user.id, mcq);
      if (!ok) return;
      // Only clear the handoff once the attempt exists under its own copy — if
      // this fails, the handoff stays in place so the user can retry.
      await deletePaper(user.id, paperId);
      if (mcqHint) await deleteSidecar(user.id, paperId);
      navigate("/attempt");
    } catch {
      setError("Could not open this paper. Check your connection and try again.");
    } finally {
      setWorking(false);
    }
  }

  return (
    <main className="mx-auto max-w-2xl px-6 pb-20">
      <Hero subtitle="Opening a paper generated in Past Papers." />

      <section className="mt-8 rounded-2xl border border-border bg-card p-6 shadow-card">
        <p className="truncate text-sm font-medium text-foreground">{title}.pdf</p>
        <p className="mt-1.5 text-xs text-muted-foreground">
          Saved to your Scholium account once you begin. Pick it up on any device you sign in on.
        </p>

        <MinutesPicker
          minutes={minutes}
          valid={minutesValid}
          onChange={setMinutes}
          onBlurClamp={() => {
            const parsed = Number(minutes);
            if (minutes.trim() === "" || !Number.isFinite(parsed)) return;
            setMinutes(String(clampMinutes(parsed)));
          }}
        />

        {(error ?? attemptError) && (
          <p
            className="mt-5 rounded-lg px-3 py-2 text-sm"
            style={{
              background: "hsl(var(--destructive) / 0.1)",
              color: "hsl(var(--destructive))",
            }}
          >
            {error ?? attemptError}
          </p>
        )}

        <button
          onClick={begin}
          disabled={!minutesValid || busy}
          data-testid="begin"
          className="mt-6 flex w-full items-center justify-center gap-2 rounded-lg py-2.5 text-sm font-semibold text-white transition-opacity disabled:opacity-50"
          style={{ background: "hsl(var(--primary))" }}
        >
          {busy ? "Opening…" : "Begin"}
        </button>
      </section>
    </main>
  );
}
