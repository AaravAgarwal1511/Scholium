import { ArrowRight } from "lucide-react";
import type { AppLink } from "@repo/ui";
import { useReveal } from "@/hooks/useReveal";

interface ClosingCTAProps {
  apps: AppLink[];
}

function scrollToTools() {
  document.getElementById("tools")?.scrollIntoView({ behavior: "smooth" });
}

export default function ClosingCTA({ apps }: ClosingCTAProps) {
  const { ref, revealed } = useReveal<HTMLDivElement>();
  const toolApps = apps.filter((a) => a.id !== "scholium-home");
  const demoCount = toolApps.filter((a) => a.has_demo || a.no_login).length;

  return (
    <section className="py-24 px-6">
      <div
        ref={ref}
        className={`reveal relative overflow-hidden rounded-[var(--radius-lg)] max-w-6xl mx-auto px-8 py-16 md:px-16 md:py-20 ${
          revealed ? "is-visible" : ""
        }`}
        style={{
          // A deliberately dark brand panel — not tied to the light/dark
          // token flip, so it reads the same strong accent in both themes
          // instead of inverting to a pale card when the site is dark.
          backgroundImage:
            "radial-gradient(ellipse 60% 70% at 12% 20%, hsl(var(--primary) / 0.35), transparent 60%)," +
            "radial-gradient(ellipse 55% 70% at 88% 85%, hsl(var(--accent) / 0.28), transparent 60%)," +
            "linear-gradient(150deg, #241F3D 0%, #1B1830 100%)",
        }}
      >
        <div className="relative z-10 max-w-2xl">
          <h2
            className="text-4xl md:text-5xl font-semibold leading-tight mb-5"
            style={{ color: "#ffffff", letterSpacing: "-0.03em" }}
          >
            Start learning the way
            <br />
            memory actually works.
          </h2>
          <p className="text-lg leading-relaxed mb-9 max-w-lg" style={{ color: "rgba(255,255,255,0.65)" }}>
            Free, forever. One account unlocks the whole suite
            {demoCount > 0 ? `, and ${demoCount === toolApps.length ? "every tool lets" : `${demoCount} of them let`} you start without signing up at all.` : "."}
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <a href="/signup" className="sch-pill sch-pill--light sch-focus">
              Create free account
              <span className="sch-pill-arrow" style={{ background: "hsl(var(--primary))" }}>
                <ArrowRight size={18} style={{ color: "hsl(var(--primary-foreground))" }} aria-hidden />
              </span>
            </a>
            <button type="button" onClick={scrollToTools} className="sch-pill sch-pill--ghost-dark sch-focus">
              Explore the tools
            </button>
            <a href="/about" className="sch-pill sch-pill--ghost-dark sch-focus">
              About Scholium
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}
