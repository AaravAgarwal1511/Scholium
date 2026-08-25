import { FileCheck2 } from "lucide-react";
import { score, type McqState } from "@/lib/mcq";
import type { Timer } from "@/lib/model";
import { formatClock } from "@/lib/useTimer";

interface Props {
  title: string;
  timer: Timer;
  mcq: McqState;
  onRestart(): void;
}

/**
 * The MCQ finish screen — ExportPage's counterpart for an MCQ attempt. There
 * is no handwriting to flatten into a PDF, so this replaces the download flow
 * with a score summary and a per-question breakdown instead.
 */
export default function McqResults({ title, timer, mcq, onRestart }: Props) {
  const { correct, answered, total } = score(mcq);
  const percentage = total > 0 ? Math.round((correct / total) * 100) : 0;
  const used = timer.durationMs - timer.remainingMs;

  return (
    <main className="mx-auto max-w-2xl px-6 py-16">
      <div className="flex items-center gap-3">
        <FileCheck2 size={22} style={{ color: "hsl(var(--success))" }} />
        <h1 className="font-display text-2xl font-bold">Time&rsquo;s up</h1>
      </div>
      <p className="mt-2 text-sm text-muted-foreground">
        {title} &mdash; you answered {answered} of {total} question{total === 1 ? "" : "s"}.
      </p>

      <dl className="mt-8 grid grid-cols-3 gap-3">
        {[
          ["Score", `${correct} / ${total}`],
          ["Percentage", `${percentage}%`],
          ["Time used", formatClock(used)],
        ].map(([label, value]) => (
          <div key={label} className="rounded-xl border border-border bg-card p-4">
            <dt className="text-xs uppercase tracking-wide text-muted-foreground">{label}</dt>
            <dd className="mt-1 font-display text-2xl font-bold tabular-nums">{value}</dd>
          </div>
        ))}
      </dl>

      <div className="mt-8 overflow-x-auto rounded-xl border border-border">
        <table className="w-full text-left text-sm">
          <thead className="bg-muted/60 text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-4 py-2 font-medium">#</th>
              <th className="px-4 py-2 font-medium">Question</th>
              <th className="px-4 py-2 font-medium">Your answer</th>
              <th className="px-4 py-2 font-medium">Correct answer</th>
              <th className="px-4 py-2 font-medium">&nbsp;</th>
            </tr>
          </thead>
          <tbody>
            {mcq.questions.map((q, i) => {
              const choice = mcq.choices[i] ?? null;
              const isCorrect = choice !== null && choice === q.answer;
              return (
                <tr key={q.seq} className="border-t border-border">
                  <td className="px-4 py-2 tabular-nums text-muted-foreground">{q.seq}</td>
                  <td className="px-4 py-2">{q.label}</td>
                  <td className="px-4 py-2 tabular-nums">{choice ?? "—"}</td>
                  <td className="px-4 py-2 tabular-nums">{q.answer}</td>
                  <td className="px-4 py-2">
                    {choice === null ? (
                      <span className="text-muted-foreground">—</span>
                    ) : isCorrect ? (
                      <span className="font-semibold text-success">✓</span>
                    ) : (
                      <span className="font-semibold text-destructive">✗</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <button
        onClick={onRestart}
        className="mt-8 w-full rounded-lg border border-border py-2.5 text-sm font-semibold hover:bg-muted"
      >
        Start another mock
      </button>
    </main>
  );
}
