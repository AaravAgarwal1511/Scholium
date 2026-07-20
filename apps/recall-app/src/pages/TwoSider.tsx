import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Check, Loader2, Lock } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useTwoSiders } from "@/hooks/useTwoSiders";
import { useTwoSiderProgress } from "@/hooks/useTwoSiderProgress";
import { STAGES } from "@/components/two-sider/meta";
import { Anchor } from "@/components/two-sider/Anchor";
import { FaceOff } from "@/components/two-sider/FaceOff";
import { BlankSlate } from "@/components/two-sider/BlankSlate";
import { cn } from "@/lib/utils";

// Per-stage accent, echoing the four-pass colour ladder on the dashboard.
const STAGE_ACCENT = [
  { bg: "bg-primary/10", text: "text-primary", ring: "border-primary/40" },
  { bg: "bg-accent/10", text: "text-accent", ring: "border-accent/40" },
  { bg: "bg-pass4/10", text: "text-pass4", ring: "border-pass4/40" },
];

export default function TwoSider() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { twoSiders, loading } = useTwoSiders();
  const { completed, complete } = useTwoSiderProgress();
  const [activeStage, setActiveStage] = useState<number | null>(null);

  const twoSider = twoSiders.find((t) => t.id === id);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="animate-spin text-primary" size={32} />
      </div>
    );
  }

  if (!twoSider) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 text-center">
        <div>
          <h2 className="text-xl font-bold mb-2">Two-Sider not found</h2>
          <Button onClick={() => navigate("/")}>Back to dashboard</Button>
        </div>
      </div>
    );
  }

  const done = completed(twoSider.id); // count of stages cleared (0..3)

  function handleComplete() {
    if (activeStage === null) return;
    const stage = activeStage;
    complete(twoSider!.id, stage + 1);
    toast.success(
      stage < STAGES.length - 1
        ? `${STAGES[stage].name} cleared — ${STAGES[stage + 1].name} unlocked`
        : "Two-Sider mastered! 🎉",
    );
    setActiveStage(null);
  }

  const backToLobby = () => setActiveStage(null);

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-10 border-b border-border bg-card/80 backdrop-blur-sm">
        <div className="max-w-3xl mx-auto px-6 h-16 flex items-center gap-4">
          <button
            onClick={activeStage === null ? () => navigate("/") : backToLobby}
            className="text-muted-foreground hover:text-foreground transition-colors p-1"
            aria-label="Back"
          >
            <ArrowLeft size={20} />
          </button>
          <div className="flex-1 min-w-0">
            <div className="font-bold text-foreground truncate">
              {activeStage === null ? twoSider.question : STAGES[activeStage].name}
            </div>
            <div className="text-xs text-muted-foreground">
              {twoSider.emoji} {twoSider.subject}
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-8">
        {activeStage === null ? (
          <div className="flex flex-col gap-6">
            <div>
              <div className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">Essay question</div>
              <h1 className="text-xl sm:text-2xl font-bold text-foreground font-display leading-snug">
                "{twoSider.question}"
              </h1>
              <p className="mt-3 text-sm text-muted-foreground max-w-xl">
                {twoSider.sides.length} sides ·{" "}
                {twoSider.sides.reduce((n, s) => n + s.points.length, 0)} points. Three drills, one ladder — clear each to unlock the next.
              </p>
            </div>

            <div className="flex flex-col gap-3">
              {STAGES.map((stage, i) => {
                const unlocked = done >= i;
                const cleared = done >= i + 1;
                const accent = STAGE_ACCENT[i];
                const Icon = stage.icon;
                return (
                  <button
                    key={stage.key}
                    disabled={!unlocked}
                    onClick={() => setActiveStage(i)}
                    className={cn(
                      "text-left rounded-xl border-2 bg-card p-4 flex items-center gap-4 transition-all duration-200",
                      unlocked ? cn("shadow-card hover:shadow-hover hover:-translate-y-0.5 cursor-pointer", accent.ring) : "border-border opacity-60 cursor-not-allowed",
                    )}
                  >
                    <div className={cn("w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0", accent.bg)}>
                      {unlocked ? <Icon size={20} className={accent.text} /> : <Lock size={18} className="text-muted-foreground" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-foreground">{stage.name}</span>
                        <span className={cn("text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded", accent.bg, accent.text)}>{stage.principle}</span>
                      </div>
                      <div className="text-xs text-muted-foreground mt-0.5">{stage.tagline}</div>
                    </div>
                    {cleared ? (
                      <span className="flex items-center gap-1 text-xs font-semibold text-success flex-shrink-0"><Check size={14} /> Done</span>
                    ) : unlocked ? (
                      <span className={cn("text-xs font-semibold flex-shrink-0", accent.text)}>Start →</span>
                    ) : (
                      <span className="text-xs text-muted-foreground flex-shrink-0">Locked</span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        ) : (
          <div className="animate-slide-up">
            {activeStage === 0 && <Anchor sides={twoSider.sides} onComplete={handleComplete} />}
            {activeStage === 1 && <FaceOff sides={twoSider.sides} onComplete={handleComplete} />}
            {activeStage === 2 && <BlankSlate sides={twoSider.sides} onComplete={handleComplete} />}
          </div>
        )}
      </main>
    </div>
  );
}
