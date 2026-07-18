import { useNavigate } from "react-router-dom";
import { ChevronRight, Scale } from "lucide-react";
import { useTwoSiders } from "@/hooks/useTwoSiders";
import { useTwoSiderProgress } from "@/hooks/useTwoSiderProgress";
import { STAGES } from "@/components/two-sider/meta";
import { cn } from "@/lib/utils";

// Dashboard entry point for the Two-Sider section. Lists the essay questions
// (published from the Admin Dashboard) and how far up the three-stage ladder
// the student has climbed for each.
export function TwoSiderLauncher() {
  const navigate = useNavigate();
  const { completed } = useTwoSiderProgress();
  const { twoSiders, loading } = useTwoSiders();

  if (loading || twoSiders.length === 0) return null;

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
        {twoSiders.map((ts) => {
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
