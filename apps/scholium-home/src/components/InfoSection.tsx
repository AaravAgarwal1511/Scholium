import { ArrowRight, Brain, Dumbbell, Repeat } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { PILLARS } from "@/content/memoryScience";

const ICONS: Record<string, LucideIcon> = { Repeat, Brain, Dumbbell };

function citationLine(citations: { label: string }[]): string {
  return citations.map((c) => c.label).join(" · ");
}

function PillButton({ label, href }: { label: string; href: string }) {
  return (
    <a
      href={href}
      className="sch-pill sch-pill--dark sch-focus"
    >
      {label}
      <span className="sch-pill-arrow sch-pill-arrow--dark">
        <ArrowRight size={16} aria-hidden />
      </span>
    </a>
  );
}

export default function InfoSection() {
  const [spacedRepetition, activeRecall, desirableDifficulty] = PILLARS;

  return (
    <section id="science" className="py-24" style={{ background: "hsl(var(--secondary))" }}>
      <div className="max-w-6xl mx-auto px-6">
        {/* Row 1 — thesis */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-12 mb-16 items-start">
          <div>
            <h2
              className="text-foreground text-4xl md:text-5xl font-bold leading-tight mb-8"
              style={{ letterSpacing: "-0.03em" }}
            >
              Built on how
              <br />
              memory actually works.
            </h2>
            <PillButton label="See the research" href="/memory-science" />
          </div>

          <p className="text-foreground/75 text-2xl md:text-3xl leading-relaxed">
            Three findings from cognitive science shape every tool in the suite —
            and one deliberate decision to leave the streaks and leaderboards out.
          </p>
        </div>

        {/* Row 2 — pillar cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Card 1 — spaced repetition, spans 2 cols, with a mini curve */}
          <div
            className="lg:col-span-2 rounded-[var(--radius-lg)] overflow-hidden bg-paper border"
            style={{ borderColor: "var(--color-border)" }}
          >
            <div className="p-7 min-h-80 flex flex-col justify-between">
              <div>
                <span
                  className="inline-flex items-center justify-center w-11 h-11 rounded-[var(--radius-sm)] mb-5"
                  style={{ background: "hsl(var(--primary) / 0.1)", color: "hsl(var(--primary))" }}
                >
                  {(() => {
                    const Icon = ICONS[spacedRepetition.icon];
                    return <Icon size={20} strokeWidth={2} aria-hidden />;
                  })()}
                </span>
                <p
                  className="text-foreground text-2xl font-semibold leading-snug mb-2"
                  style={{ letterSpacing: "-0.02em" }}
                >
                  {spacedRepetition.technique}
                </p>
                <p className="text-foreground/70 text-base max-w-md">{spacedRepetition.finding}</p>
              </div>

              {/* mini retention curve */}
              <svg viewBox="0 0 320 60" className="w-full h-12 mt-6" aria-hidden="true">
                <path
                  d="M4 40 C34 54 54 56 64 56 L64 20 C90 40 108 46 118 47 L118 14 C150 34 168 40 178 41 L178 8 C210 24 250 30 316 32"
                  fill="none"
                  stroke="hsl(var(--primary))"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                {[64, 118, 178].map((x, i) => (
                  <circle key={i} cx={x} cy={[20, 14, 8][i]} r="3.5" fill="hsl(var(--primary))" />
                ))}
              </svg>

              <p className="mt-4 text-xs text-muted-foreground">{citationLine(spacedRepetition.citations)}</p>
            </div>
          </div>

          {/* Cards 2 & 3 use a fixed dark brand panel — not the light/dark
              tokens — for the same reason as the ClosingCTA band: it should
              read as the same strong accent in both themes, not invert to a
              pale card when the site itself goes dark. */}
          {/* Card 2 — active recall */}
          <div className="rounded-[var(--radius-lg)] p-7 min-h-80 flex flex-col justify-between" style={{ background: "#241f3d" }}>
            <div>
              <span
                className="inline-flex items-center justify-center w-11 h-11 rounded-[var(--radius-sm)] mb-5"
                style={{ background: "rgba(255,255,255,0.1)", color: "#A5B4FC" }}
              >
                {(() => {
                  const Icon = ICONS[activeRecall.icon];
                  return <Icon size={20} strokeWidth={2} aria-hidden />;
                })()}
              </span>
              <p className="text-2xl font-semibold leading-tight mb-2" style={{ color: "#ffffff", letterSpacing: "-0.02em" }}>
                {activeRecall.technique}
              </p>
              <p className="text-base" style={{ color: "rgba(255,255,255,0.6)" }}>
                {activeRecall.finding}
              </p>
            </div>
            <p className="text-xs" style={{ color: "rgba(255,255,255,0.4)" }}>
              {citationLine(activeRecall.citations)}
            </p>
          </div>

          {/* Card 3 — desirable difficulty / no gamification */}
          <div className="rounded-[var(--radius-lg)] p-7 min-h-80 flex flex-col justify-between" style={{ background: "#241f3d" }}>
            <div>
              <span
                className="inline-flex items-center justify-center w-11 h-11 rounded-[var(--radius-sm)] mb-5"
                style={{ background: "rgba(255,255,255,0.1)", color: "#FBBF77" }}
              >
                {(() => {
                  const Icon = ICONS[desirableDifficulty.icon];
                  return <Icon size={20} strokeWidth={2} aria-hidden />;
                })()}
              </span>
              <p className="text-2xl font-semibold leading-tight mb-2" style={{ color: "#ffffff", letterSpacing: "-0.02em" }}>
                No gamification
              </p>
              <p className="text-base" style={{ color: "rgba(255,255,255,0.6)" }}>
                {desirableDifficulty.finding}
              </p>
            </div>
            <p className="text-xs" style={{ color: "rgba(255,255,255,0.4)" }}>
              {citationLine(desirableDifficulty.citations)}
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
