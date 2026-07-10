import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { FileUp, Clock, Pencil, Play, Trash2 } from "lucide-react";
import { useAttempt } from "@/contexts/AttemptContext";
import { useAuth } from "@/contexts/AuthContext";
import { deleteAttempt, listAttempts } from "@/lib/attemptStore";
import { formatClock } from "@/lib/useTimer";
import RecommendedSubjects from "@/components/RecommendedSubjects";
import {
  daysUntilPaperExpiry,
  isPaperExpired,
  PAPER_RETENTION_DAYS,
} from "@/lib/paperRetention";
import { deletePaper } from "@/lib/paperStorage";
import type { Attempt } from "@/lib/model";

const MIN_MINUTES = 10;
const MAX_MINUTES = 150;
const DEFAULT_MINUTES = 90;

const HERO_FALLBACK =
  "Sit a past paper under exam conditions. Type straight onto the PDF — the cursor only ever moves forwards, so you can never quietly reword an answer before you mark it.";

function retentionLabel(a: Attempt): string {
  if (isPaperExpired(a.createdAt)) return "expired";
  const days = daysUntilPaperExpiry(a.createdAt);
  return `kept ${days} more day${days === 1 ? "" : "s"}`;
}

function Hero({ description }: { description: string | null }) {
  return (
    <header className="pt-10 pb-2">
      <h1 className="text-foreground text-3xl sm:text-4xl font-bold tracking-tight">
        Mock Space.
      </h1>
      <p className="mt-2 text-muted-foreground max-w-2xl leading-relaxed">
        {description ?? HERO_FALLBACK}
      </p>
    </header>
  );
}

export default function HomePage({ description }: { description: string | null }) {
  const navigate = useNavigate();
  const { user, loadingAuth } = useAuth();
  const { startAttempt, resumeAttempt, loading, error } = useAttempt();

  const [minutes, setMinutes] = useState(String(DEFAULT_MINUTES));
  const [file, setFile] = useState<File | null>(null);
  const [saved, setSaved] = useState<Attempt[]>([]);
  const [listFailed, setListFailed] = useState(false);

  const parsed = Number(minutes);
  const minutesValid =
    minutes.trim() !== "" &&
    Number.isInteger(parsed) &&
    parsed >= MIN_MINUTES &&
    parsed <= MAX_MINUTES;

  // Reading the attempt list is a network call now, so it can fail. Say so rather
  // than show an empty list, which reads as "you have no papers".
  const refresh = useCallback(() => {
    if (!user) return;
    listAttempts(user.id)
      .then((rows) => {
        setSaved(rows);
        setListFailed(false);
      })
      .catch(() => setListFailed(true));
  }, [user]);

  useEffect(refresh, [refresh]);

  async function begin() {
    if (!file || !minutesValid) return;
    const ok = await startAttempt(file, parsed * 60_000, user?.id ?? null);
    if (ok) navigate("/attempt");
  }

  async function resume(id: string) {
    const ok = await resumeAttempt(id);
    if (ok) navigate("/attempt");
  }

  if (loadingAuth) return null;

  if (!user) {
    return (
      <main className="mx-auto max-w-2xl px-6 pb-20">
        <Hero description={description} />
        <div className="mt-8 flex gap-3">
          <button
            onClick={() => navigate("/signin")}
            className="rounded-lg px-5 py-2.5 text-sm font-semibold text-white"
            style={{ background: "hsl(var(--primary))" }}
          >
            Sign in to start
          </button>
          <button
            onClick={() => navigate("/demo")}
            className="rounded-lg border border-border px-5 py-2.5 text-sm font-semibold hover:bg-muted"
          >
            Try the demo
          </button>
        </div>

        <RecommendedSubjects />
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-2xl px-6 pb-20">
      <Hero description={description} />

      <section className="mt-8 rounded-2xl border border-border bg-card p-6 shadow-card">
        <label
          htmlFor="paper"
          className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground"
        >
          <FileUp size={14} /> Question paper
        </label>
        {/* ::file-selector-button does not inherit `color`; left alone it renders in
            the UA's black ButtonText, which vanishes against `file:bg-muted` in dark
            mode. `file:text-foreground` is what makes "Choose File" legible. */}
        <input
          id="paper"
          type="file"
          accept="application/pdf,.pdf"
          data-testid="pdf-input"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          className="mt-2 block w-full rounded-lg border border-border bg-background p-2.5 text-sm text-foreground file:mr-3 file:cursor-pointer file:rounded file:border-0 file:bg-muted file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-foreground hover:file:bg-border"
        />
        <p className="mt-1.5 text-xs text-muted-foreground">
          Saved to your Scholium account for {PAPER_RETENTION_DAYS} days, then deleted. Pick it
          up on any device you sign in on.
        </p>

        <label
          htmlFor="minutes"
          className="mt-6 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground"
        >
          <Clock size={14} /> Time allowed
        </label>
        <div className="mt-2 flex items-center gap-2">
          <input
            id="minutes"
            type="number"
            inputMode="numeric"
            min={MIN_MINUTES}
            max={MAX_MINUTES}
            step={5}
            value={minutes}
            data-testid="minutes"
            onChange={(e) => setMinutes(e.target.value)}
            // The browser will not stop someone typing 900 into a number input, so
            // clamp when they leave the field rather than starting a nine-hour mock.
            onBlur={() => {
              if (minutes.trim() === "" || !Number.isFinite(parsed)) return;
              const clamped = Math.min(MAX_MINUTES, Math.max(MIN_MINUTES, Math.round(parsed)));
              setMinutes(String(clamped));
            }}
            aria-invalid={!minutesValid}
            aria-describedby="minutes-hint"
            className="w-28 rounded-lg border border-border bg-background px-3 py-2 text-sm tabular-nums outline-none focus:ring-2"
            style={
              {
                "--tw-ring-color": "hsl(var(--primary) / 0.4)",
                borderColor: minutesValid ? undefined : "hsl(var(--destructive))",
              } as React.CSSProperties
            }
          />
          <span className="text-sm text-muted-foreground">minutes</span>
        </div>
        <p
          id="minutes-hint"
          className="mt-1.5 text-xs"
          style={{ color: minutesValid ? undefined : "hsl(var(--destructive))" }}
        >
          {minutesValid ? (
            <span className="text-muted-foreground">
              Between {MIN_MINUTES} and {MAX_MINUTES} minutes.
            </span>
          ) : (
            `Enter a whole number of minutes between ${MIN_MINUTES} and ${MAX_MINUTES}.`
          )}
        </p>

        {error && (
          <p
            className="mt-5 rounded-lg px-3 py-2 text-sm"
            style={{
              background: "hsl(var(--destructive) / 0.1)",
              color: "hsl(var(--destructive))",
            }}
          >
            {error}
          </p>
        )}

        <button
          onClick={begin}
          disabled={!file || !minutesValid || loading}
          data-testid="begin"
          className="mt-6 flex w-full items-center justify-center gap-2 rounded-lg py-2.5 text-sm font-semibold text-white transition-opacity disabled:opacity-50"
          style={{ background: "hsl(var(--primary))" }}
        >
          <Pencil size={15} />
          {loading ? "Opening…" : "Begin"}
        </button>
      </section>

      <p className="mt-6 text-xs leading-relaxed text-muted-foreground">
        Once you start typing in a box you cannot click back into it, arrow-key back into it,
        or paste over it. Backspace reaches only into the word you are typing. To retract
        anything else, cross it out.
      </p>

      <RecommendedSubjects />

      {listFailed && (
        <p
          data-testid="list-failed"
          className="mt-8 rounded-lg px-3 py-2 text-sm"
          style={{ background: "hsl(var(--accent) / 0.12)", color: "hsl(var(--accent))" }}
        >
          Could not load your papers. Check your connection and refresh.
        </p>
      )}

      {saved.length > 0 && (
        <section className="mt-12">
          <h2 className="font-display text-lg font-bold">Your papers</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Stored in your account, so they follow you between devices. Deleted{" "}
            {PAPER_RETENTION_DAYS} days after you start them.
          </p>
          <ul className="mt-4 space-y-2">
            {saved.map((a) => (
              <li
                key={a.id}
                className="flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-3"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{a.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {a.timer.state === "expired" ? (
                      "Finished"
                    ) : (
                      <>
                        {a.boxes.filter((b) => b.text).length} answers ·{" "}
                        <span className="tabular-nums">{formatClock(a.timer.remainingMs)}</span>{" "}
                        left
                      </>
                    )}
                    <span data-testid="paper-retention"> · {retentionLabel(a)}</span>
                  </p>
                </div>
                <button
                  onClick={() => resume(a.id)}
                  className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-semibold hover:bg-muted"
                >
                  <Play size={12} /> {a.timer.state === "expired" ? "Export" : "Resume"}
                </button>
                <button
                  aria-label={`Delete ${a.title}`}
                  onClick={async () => {
                    try {
                      await deleteAttempt(a.id);
                      // The bucket copy would otherwise linger until the cron sweeps it.
                      if (a.userId) await deletePaper(a.userId, a.id);
                    } catch {
                      setListFailed(true);
                    }
                    refresh();
                  }}
                  className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted"
                >
                  <Trash2 size={14} />
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}
    </main>
  );
}
