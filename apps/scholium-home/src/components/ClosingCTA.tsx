import { ArrowRight } from "lucide-react";
import { useReveal } from "@/hooks/useReveal";

function scrollToTools() {
  document.getElementById("tools")?.scrollIntoView({ behavior: "smooth" });
}

export default function ClosingCTA() {
  const { ref, revealed } = useReveal<HTMLDivElement>();

  return (
    <section className="border-t border-[color:var(--color-rule)]">
      <div className="max-w-6xl mx-auto px-6 py-24">
        <div
          ref={ref}
          className={`reveal relative overflow-hidden rounded-[var(--radius-lg)] border px-8 py-16 md:px-16 md:py-20 text-center ${
            revealed ? "is-visible" : ""
          }`}
          style={{ borderColor: "var(--color-border)", background: "hsl(var(--card))", boxShadow: "var(--shadow-card)" }}
        >
          {/* Subtle brand wash, decorative only. */}
          <div
            aria-hidden
            className="absolute inset-0 -z-10 pointer-events-none"
            style={{
              backgroundImage:
                "radial-gradient(ellipse 60% 70% at 50% 0%, hsl(var(--primary) / 0.12), transparent 65%), radial-gradient(ellipse 50% 60% at 85% 100%, hsl(var(--accent) / 0.1), transparent 60%)",
            }}
          />

          <h2
            className="text-foreground"
            style={{
              fontSize: "clamp(2rem, 5vw, 3rem)",
              lineHeight: 1.1,
              letterSpacing: "-0.02em",
              fontWeight: 700,
            }}
          >
            Study with <span style={{ color: "hsl(var(--primary))" }}>intent.</span>
          </h2>
          <p className="mt-4 max-w-xl mx-auto text-foreground/75 leading-relaxed text-lg">
            One free account unlocks the whole suite. No subscriptions, no tracking — just tools built to make knowledge stick.
          </p>

          <div className="mt-9 flex flex-col sm:flex-row gap-3 items-stretch sm:items-center sm:justify-center">
            <a href="/signup" className="sch-btn sch-btn--primary sch-focus">
              Create free account
              <ArrowRight size={18} aria-hidden />
            </a>
            <button type="button" onClick={scrollToTools} className="sch-btn sch-btn--ghost sch-focus">
              Browse the suite
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
