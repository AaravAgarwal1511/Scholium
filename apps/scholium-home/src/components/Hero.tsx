import { useMemo } from "react";
import { ArrowRight, ChevronDown } from "lucide-react";
import type { AppLink } from "@repo/ui";
import HeroScene from "./HeroScene";

interface HeroProps {
  onScrollToScience: () => void;
  onExploreTools: () => void;
  apps: AppLink[];
}

// "Inside the suite" ticker — the tools and techniques Scholium covers. Built
// from the fetched apps (titles + deduped subjects) plus a couple of static
// technique terms, so a new tool or subject shows up here automatically
// instead of living as a second hardcoded list that drifts from the DB.
function useTicker(apps: AppLink[]): string[] {
  return useMemo(() => {
    const toolApps = apps.filter((a) => a.id !== "scholium-home");
    const titles = toolApps.map((a) => a.title);
    const subjects: string[] = [];
    const seen = new Set<string>();
    for (const app of toolApps) {
      for (const subject of app.subjects ?? []) {
        const key = subject.toLowerCase();
        if (!seen.has(key)) {
          seen.add(key);
          subjects.push(subject);
        }
      }
    }
    return [...titles, "Spaced repetition", "Active recall", ...subjects, "No streaks"];
  }, [apps]);
}

export default function Hero({ onScrollToScience, onExploreTools, apps }: HeroProps) {
  const toolCount = apps.filter((a) => a.id !== "scholium-home").length;
  const ticker = useTicker(apps);

  return (
    <div className="flex-1 px-6 pt-6 pb-6 flex items-end">
      <div
        className="relative w-full rounded-[var(--radius-lg)] overflow-hidden border"
        style={{ height: "calc(100dvh - 3.5rem - 3rem)", borderColor: "var(--color-border)" }}
      >
        {/* On-brand memory-science backdrop (no external assets) */}
        <HeroScene />

        {/* Legibility scrim, weighted to the left where the copy sits */}
        <div
          aria-hidden
          className="absolute inset-0"
          style={{
            background:
              "linear-gradient(100deg, hsl(var(--background) / 0.92) 0%, hsl(var(--background) / 0.72) 34%, hsl(var(--background) / 0) 62%)",
          }}
        />

        {/* Content overlay */}
        <div className="relative z-10 flex flex-col items-start justify-start h-full p-8 sm:p-12 pt-24 sm:pt-28">
          <span className="rui-eyebrow mb-5">The Scholium Suite</span>

          <h1
            className="text-foreground text-5xl md:text-6xl font-bold leading-[1.05] max-w-xl mb-5"
            style={{ letterSpacing: "-0.04em" }}
          >
            Learn <span style={{ color: "hsl(var(--primary))" }}>deeper.</span>
            <br />
            Remember <span style={{ color: "hsl(var(--accent))" }}>longer.</span>
          </h1>

          <p className="text-foreground/70 text-base md:text-lg max-w-md mb-8 leading-relaxed">
            A free suite of focused learning tools, built on how memory actually
            works — not how apps keep you scrolling.{" "}
            {toolCount > 0 ? `One account unlocks all ${toolCount}.` : "One account unlocks the whole suite."}
          </p>

          {/* CTAs */}
          <div className="flex flex-wrap items-center gap-3">
            <a href="/signup" className="sch-pill sch-pill--primary sch-focus">
              Create free account
              <span className="sch-pill-arrow">
                <ArrowRight size={18} aria-hidden />
              </span>
            </a>

            <button type="button" onClick={onExploreTools} className="sch-pill sch-pill--ghost sch-focus">
              Explore the tools
            </button>
          </div>

          {/* Suite ticker */}
          {ticker.length > 0 && (
            <div className="mt-16 sm:mt-24 w-full max-w-md">
              <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                Inside the suite
              </p>
              <div className="overflow-hidden">
                <div className="marquee-track">
                  {[...ticker, ...ticker].map((item, i) => (
                    <span
                      key={i}
                      className="mx-6 shrink-0 whitespace-nowrap text-sm font-medium"
                      style={{ color: i % 2 === 0 ? "hsl(var(--primary))" : "hsl(var(--muted-foreground))" }}
                    >
                      {item}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        <button
          onClick={onScrollToScience}
          className="sch-focus absolute bottom-4 left-1/2 -translate-x-1/2 z-10 text-muted-foreground hover:text-foreground opacity-70 hover:opacity-100 transition-opacity"
          aria-label="Scroll to the memory science"
        >
          <ChevronDown size={22} className="animate-bounce" style={{ animationDuration: "2.5s" }} />
        </button>
      </div>
    </div>
  );
}
