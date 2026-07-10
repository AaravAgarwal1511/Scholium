import { CheckCircle2 } from "lucide-react";
import { RECOMMENDED_SUBJECTS } from "@/lib/subjects";

/**
 * `flex-wrap` packs a line as full as it fits, then dumps whatever is left onto
 * the next — with 7 subjects that left "ICT" alone on its own line. Splitting
 * into two explicit rows keeps the count balanced (4 + 3) regardless of how the
 * chips happen to measure at a given width.
 */
function splitEvenly<T>(items: readonly T[]): T[][] {
  const mid = Math.ceil(items.length / 2);
  return [items.slice(0, mid), items.slice(mid)];
}

const SUBJECT_ROWS = splitEvenly(RECOMMENDED_SUBJECTS);

/**
 * An honest limit rather than a feature. Typing an essay is not the same exercise
 * as writing one, so Mock Space says plainly which papers it is worth using for.
 */
export default function RecommendedSubjects() {
  return (
    <section
      data-testid="recommended-subjects"
      className="mt-10 rounded-2xl border border-border bg-card p-5"
    >
      <h2 className="flex items-center gap-2 text-sm font-semibold">
        <CheckCircle2 size={15} style={{ color: "hsl(var(--success))" }} />
        Best suited to
      </h2>

      <div className="mt-3 flex flex-col gap-1.5">
        {SUBJECT_ROWS.map((row, i) => (
          <div key={i} className="flex flex-wrap gap-1.5">
            {row.map((subject) => (
              <span
                key={subject}
                data-subject={subject}
                className="rounded-full border border-border px-2.5 py-1 text-xs font-medium"
                style={{ background: "hsl(var(--primary) / 0.07)" }}
              >
                {subject}
              </span>
            ))}
          </div>
        ))}
      </div>

      <p className="mt-4 text-xs leading-relaxed text-muted-foreground">
        These papers ask for short, precise answers, which is exactly what a locked cursor
        tests. Subjects with a lot of extended writing &mdash; essays and long prose &mdash;
        are still better practised on paper, where the act of writing is part of the exercise.
      </p>
    </section>
  );
}
