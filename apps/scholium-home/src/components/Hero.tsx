import { ArrowRight, ChevronDown } from "lucide-react";
import type { AppLink } from "@repo/ui";
import HeroScene from "./HeroScene";

interface HeroProps {
  onScrollToScience: () => void;
  onExploreTools: () => void;
  apps: AppLink[];
}

export default function Hero({ onScrollToScience, onExploreTools }: HeroProps) {
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
          <h1
            className="text-foreground text-5xl md:text-6xl font-bold leading-[1.05] max-w-xl mb-5"
            style={{ letterSpacing: "-0.04em" }}
          >
            Learn <span style={{ color: "hsl(var(--primary))" }}>deeper.</span>
            <br />
            Remember <span style={{ color: "hsl(var(--accent))" }}>longer.</span>
          </h1>

          <p className="text-foreground/70 text-base md:text-lg max-w-md mb-8 leading-relaxed">
            Free revision tools for Cambridge IGCSE, organised by subject.
          </p>

          {/* CTAs */}
          <div className="flex flex-wrap items-center gap-3">
            <a href="/signup" className="sch-pill sch-pill--primary sch-focus">
              Sign up
              <span className="sch-pill-arrow">
                <ArrowRight size={18} aria-hidden />
              </span>
            </a>

            <button type="button" onClick={onExploreTools} className="sch-pill sch-pill--ghost sch-focus">
              Tools
            </button>
          </div>

        </div>

        <button
          onClick={onScrollToScience}
          className="sch-focus absolute bottom-4 left-1/2 -translate-x-1/2 z-10 text-muted-foreground hover:text-foreground opacity-70 hover:opacity-100 transition-opacity"
          aria-label="Scroll to subjects"
        >
          <ChevronDown size={22} className="animate-bounce" style={{ animationDuration: "2.5s" }} />
        </button>
      </div>
    </div>
  );
}
