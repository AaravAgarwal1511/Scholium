import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Download, FileCheck2 } from "lucide-react";
import { useAttempt } from "@/contexts/AttemptContext";
import { downloadPdf, exportAttempt } from "@/lib/exportPdf";
import { answerFontBytes } from "@/lib/answerFont";
import { formatClock } from "@/lib/useTimer";

export default function ExportPage() {
  const navigate = useNavigate();
  const { attempt, getPdfBytes, clearAttempt, restoring } = useAttempt();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!restoring && !attempt) navigate("/", { replace: true });
  }, [restoring, attempt, navigate]);

  if (restoring || !attempt) return null;

  const answered = attempt.boxes.filter((b) => b.text.length > 0);
  const words = answered.reduce(
    (n, b) => n + b.text.split(/\s+/).filter((w) => w && !/^\s*$/.test(w)).length,
    0,
  );
  const strikes = answered.reduce((n, b) => n + b.struck.length, 0);
  const used = attempt.timer.durationMs - attempt.timer.remainingMs;

  async function download() {
    const bytes = getPdfBytes();
    if (!attempt || !bytes) {
      setError("The original PDF is no longer in memory. Start the attempt again.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const out = await exportAttempt(attempt, bytes, await answerFontBytes());
      downloadPdf(out, `${attempt.title} — mock.pdf`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "The export failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto max-w-xl px-6 py-16">
      <div className="flex items-center gap-3">
        <FileCheck2 size={22} style={{ color: "hsl(var(--success))" }} />
        <h1 className="font-display text-2xl font-bold">Time&rsquo;s up</h1>
      </div>
      <p className="mt-2 text-sm text-muted-foreground">
        Your script is finished. Download it and mark it against the mark scheme &mdash; the
        answers are real text, so nothing needs retyping.
      </p>

      <dl className="mt-8 grid grid-cols-3 gap-3">
        {[
          ["Answers", String(answered.length)],
          ["Words", String(words)],
          ["Crossed out", String(strikes)],
        ].map(([label, value]) => (
          <div key={label} className="rounded-xl border border-border bg-card p-4">
            <dt className="text-xs uppercase tracking-wide text-muted-foreground">{label}</dt>
            <dd className="mt-1 font-display text-2xl font-bold tabular-nums">{value}</dd>
          </div>
        ))}
      </dl>

      <p className="mt-4 text-xs text-muted-foreground">
        Time used: <span className="tabular-nums">{formatClock(used)}</span> of{" "}
        <span className="tabular-nums">{formatClock(attempt.timer.durationMs)}</span>
      </p>

      {error && (
        <p
          className="mt-6 rounded-lg px-3 py-2 text-sm"
          style={{ background: "hsl(var(--destructive) / 0.1)", color: "hsl(var(--destructive))" }}
        >
          {error}
        </p>
      )}

      <button
        onClick={download}
        disabled={busy}
        data-testid="download"
        className="mt-8 flex w-full items-center justify-center gap-2 rounded-lg py-3 text-sm font-semibold text-white disabled:opacity-60"
        style={{ background: "hsl(var(--primary))" }}
      >
        <Download size={16} />
        {busy ? "Building your script…" : "Download flattened PDF"}
      </button>

      <button
        onClick={() => {
          clearAttempt();
          navigate("/");
        }}
        className="mt-3 w-full rounded-lg border border-border py-2.5 text-sm font-semibold hover:bg-muted"
      >
        Start another mock
      </button>
    </main>
  );
}
