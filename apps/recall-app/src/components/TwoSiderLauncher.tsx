import { useNavigate } from "react-router-dom";
import { ChevronRight, Scale } from "lucide-react";
import { useTwoSiders } from "@/hooks/useTwoSiders";
import { useTwoSiderProgress } from "@/hooks/useTwoSiderProgress";
import { STAGES } from "@/components/two-sider/meta";
import type { Subject, TwoSider } from "@/types";
import { cn } from "@/lib/utils";

// recall_two_siders.subject is a free-text display label typed in the Admin
// Dashboard ("Economics"); the dashboard's subject tabs come from
// recall_chapters, which carries both an id ("economics") and a name
// ("Economics"). Slugify both sides so capitalisation or stray spacing can't
// strand an essay under no tab at all.
const slug = (s: string) =>
  s.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");

function belongsTo(twoSider: TwoSider, subject: Subject) {
  const key = slug(twoSider.subject);
  return key === slug(subject.id) || key === slug(subject.name);
}

// Dashboard entry point for the Two-Sider section. Lists the essay questions
// (published from the Admin Dashboard) for the subject tab currently open and
// how far up the three-stage ladder the student has climbed for each.
export function TwoSiderLauncher({ subject }: { subject?: Subject }) {
  const navigate = useNavigate();
  const { completed } = useTwoSiderProgress();
  const { twoSiders, loading } = useTwoSiders();

  // No subject selected means there is nothing to scope the essays to, so show
  // none — an essay belongs to one subject and must not appear under another.
  const essays = subject ? twoSiders.filter((ts) => belongsTo(ts, subject)) : [];

  if (loading || essays.length === 0) return null;

  return (
    <section className="rounded-xl border-2 border-border bg-card shadow-card overflow-hidden mb-4">
      <div className="flex items-center gap-3 p-5 border-b border-border">
        <div className="w-10 h-10 rounded-xl bg-accent/10 flex items-center justify-center flex-shrink-0">
          <Scale size={20} className="text-accent" />
        </div>
        <div>
          <div className="font-bold text-foreground">Essay Two-Siders</div>
          <div className="text-xs text-muted-foreground">Remember both sides of an argument — anchor, sort, then reproduce.</div>
        </div>
      </div>

      <div className="p-3 flex flex-col gap-2">
        {essays.map((ts) => {
          const done = completed(ts.id);
          return (
            <button
              key={ts.id}
              onClick={() => navigate(`/two-sider/${ts.id}`)}
              className="group text-left rounded-lg border border-border bg-background hover:border-accent/40 hover:shadow-hover hover:-translate-y-0.5 transition-all duration-200 p-3 flex items-center gap-3"
            >
              <span className="text-xl flex-shrink-0">{ts.emoji}</span>
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-sm text-foreground truncate">{ts.question}</div>
                <div className="flex items-center gap-1.5 mt-1.5">
                  {STAGES.map((stage, i) => (
                    <span
                      key={stage.key}
                      title={`${stage.name}${done >= i + 1 ? " · done" : done >= i ? " · unlocked" : " · locked"}`}
                      className={cn(
                        "h-1.5 rounded-full transition-colors",
                        done > 0 ? "w-8" : "w-6",
                        done >= i + 1 ? "bg-accent" : done >= i ? "bg-accent/40" : "bg-border",
                      )}
                    />
                  ))}
                  <span className="text-[11px] text-muted-foreground ml-1 tabular-nums">
                    {done >= STAGES.length ? "Mastered" : `${done}/${STAGES.length} cleared`}
                  </span>
                </div>
              </div>
              <ChevronRight size={16} className="text-muted-foreground group-hover:text-accent transition-colors flex-shrink-0" />
            </button>
          );
        })}
      </div>
    </section>
  );
}
