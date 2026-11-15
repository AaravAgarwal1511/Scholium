import { useEffect, useState } from "react";
import { Download, ArrowUpRight } from "lucide-react";
import { getSubjectByCode, subjectLabel, toolUrl } from "@repo/ui";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

interface SavedPaperRow {
  id: string;
  created_at: string;
  subject: string;
  component: string;
  question_ids: string[];
}

/**
 * Every saved paper the signed-in user has, across all subjects — shown on
 * /tools/past-papers, the one place that isn't scoped to a single subject.
 * Read-only here: composing and downloading belong to the Past Papers zone,
 * so each row hands off to /:subject/past-papers (`?download=<id>` starts the
 * download there; Open just lands on the subject's generator). Same table and
 * RLS as the tool's own panel (`saved_papers`, owner-only select).
 */
export default function SavedPapersOverview() {
  const { user, loadingAuth } = useAuth();
  const [papers, setPapers] = useState<SavedPaperRow[] | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!user) {
      setPapers(null);
      return;
    }
    let cancelled = false;
    supabase
      .from("saved_papers")
      .select("id, created_at, subject, component, question_ids")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(100)
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) setFailed(true);
        else setPapers((data as SavedPaperRow[] | null) ?? []);
      });
    return () => {
      cancelled = true;
    };
  }, [user]);

  if (loadingAuth || !user) return null;

  return (
    <section className="mt-14" aria-labelledby="saved-papers-heading">
      <h2 id="saved-papers-heading" className="mb-5 text-foreground text-xl font-semibold" style={{ letterSpacing: "-0.01em" }}>
        Your saved <span style={{ color: "hsl(var(--primary))" }}>papers</span>.
      </h2>
      {failed ? (
        <p className="text-muted-foreground text-sm">Could not load your saved papers.</p>
      ) : papers === null ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {[0, 1].map((i) => (
            <div key={i} className="h-16 rounded-lg bg-muted animate-pulse" />
          ))}
        </div>
      ) : papers.length === 0 ? (
        <p className="text-muted-foreground text-sm">
          No saved papers yet. Pick a subject below, generate a paper, and it&apos;ll show up here.
        </p>
      ) : (
        <ul className="grid grid-cols-1 sm:grid-cols-2 gap-3 list-none p-0 m-0">
          {papers.map((p) => {
            const subject = getSubjectByCode(p.subject);
            const base = subject ? toolUrl("past-papers", subject.slug) : null;
            return (
              <li
                key={p.id}
                className="flex items-center justify-between gap-3 px-4 py-3 rounded-lg border bg-paper"
                style={{ borderColor: "var(--color-border)" }}
              >
                <div className="min-w-0">
                  <p className="font-medium text-sm text-foreground truncate">
                    {subject ? `${subject.emoji} ${subjectLabel(subject)}` : p.subject} · {p.component}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(p.created_at).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" })}
                    {" · "}
                    {p.question_ids.length} question{p.question_ids.length === 1 ? "" : "s"}
                  </p>
                </div>
                {base && (
                  <div className="flex items-center gap-1 shrink-0">
                    <a
                      href={`${base}?download=${encodeURIComponent(p.id)}`}
                      aria-label="Download this paper"
                      title="Download"
                      className="sch-focus p-2 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted"
                    >
                      <Download size={16} />
                    </a>
                    <a
                      href={base}
                      aria-label={`Open Past Papers for ${subject ? subjectLabel(subject) : p.subject}`}
                      title="Open in Past Papers"
                      className="sch-focus p-2 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted"
                    >
                      <ArrowUpRight size={16} />
                    </a>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
