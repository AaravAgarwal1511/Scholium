import { ArrowRight, ChevronDown } from "lucide-react";
import type { ReactNode } from "react";
import type { AppLink } from "@repo/ui";
import type { Persona } from "./PersonaSelector";

interface HeroProps {
  onScrollToAbout: () => void;
  onExploreTools: () => void;
  apps: AppLink[];
  persona: Persona | null;
  personaSelector?: ReactNode;
  onChangePersona?: () => void;
}

interface HeroCopy {
  headline: React.ReactNode;
  subheadline: string;
}

function getHeroCopy(persona: Persona | null): HeroCopy {
  if (persona === "teacher") {
    return {
      headline: (
        <>
          Equip your <span style={{ color: "hsl(var(--primary))" }}>students.</span>
          <br />
          Trust the <span style={{ color: "hsl(var(--accent))" }}>tools.</span>
        </>
      ),
      subheadline:
        "A free suite of memory-backed revision tools you can point your students to, no signup hassle, no distracting gamification.",
    };
  }
  if (persona === "parent") {
    return {
      headline: (
        <>
          Give your <span style={{ color: "hsl(var(--primary))" }}>child</span>
          <br />
          an <span style={{ color: "hsl(var(--accent))" }}>edge.</span>
        </>
      ),
      subheadline:
        "A free suite of focused revision tools for your child, vocabulary drills, active recall, and exam practice, built on how memory actually works.",
    };
  }
  return {
    headline: (
      <>
        Learn <span style={{ color: "hsl(var(--primary))" }}>deeper.</span>
        <br />
        Remember <span style={{ color: "hsl(var(--accent))" }}>longer.</span>
      </>
    ),
    subheadline:
      "A suite of focused learning tools, built on how memory actually works, not how apps keep you scrolling.",
  };
}

export default function Hero({
  onScrollToAbout,
  onExploreTools,
  persona,
  personaSelector,
  onChangePersona,
}: HeroProps) {
  const copy = getHeroCopy(persona);

  return (
    <section className="relative min-h-[calc(100vh-3.5rem)] flex flex-col justify-center overflow-hidden">
      <div
        aria-hidden
        className="absolute inset-0 -z-10 pointer-events-none"
        style={{
          backgroundImage:
            "radial-gradient(ellipse 70% 50% at 18% 22%, hsl(var(--primary) / 0.14), transparent 60%), radial-gradient(ellipse 60% 50% at 82% 78%, hsl(var(--accent) / 0.14), transparent 60%)",
        }}
      />

      {persona && onChangePersona && (
        <button
          type="button"
          onClick={onChangePersona}
          className="sch-focus absolute top-6 right-6 z-10 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold tracking-wide transition-all"
          style={{
            background: "transparent",
            color: "hsl(var(--muted-foreground))",
            border: "1px solid var(--color-border)",
            animation: "rui-fade 0.5s var(--ease-out-paper) 0.4s both",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = "hsl(var(--primary))";
            e.currentTarget.style.color = "hsl(var(--primary))";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = "var(--color-border)";
            e.currentTarget.style.color = "hsl(var(--muted-foreground))";
          }}
        >
          Not you? Change
        </button>
      )}

      <div
        className={`mx-auto w-full px-6 py-20 ${
          personaSelector
            ? "max-w-6xl flex flex-col lg:flex-row items-center gap-12 lg:gap-20"
            : "max-w-3xl text-center"
        }`}
      >
        {/* Hero copy */}
        <div key={persona ?? "none"} className={personaSelector ? "flex-1 text-center lg:text-left" : ""}>
          <h1
            className="text-foreground"
            style={{
              fontFamily: "var(--font-display)",
              fontSize: "clamp(2.5rem, 8vw, 5.5rem)",
              lineHeight: 1.05,
              letterSpacing: "-0.025em",
              fontWeight: 700,
              animation: "rui-rise 0.6s var(--ease-out-paper) 0.05s both",
            }}
          >
            {copy.headline}
          </h1>

          <p
            className={`mt-8 text-foreground/85 text-lg leading-relaxed ${personaSelector ? "max-w-xl" : "max-w-2xl mx-auto"}`}
            style={{ animation: "rui-rise 0.6s var(--ease-out-paper) 0.2s both" }}
          >
            {copy.subheadline}
          </p>

          {/* Primary conversion path — one strong CTA + one secondary action. */}
          <div
            className={`mt-9 flex flex-col sm:flex-row gap-3 ${
              personaSelector ? "items-stretch sm:items-center" : "items-stretch sm:items-center sm:justify-center"
            }`}
            style={{ animation: "rui-rise 0.6s var(--ease-out-paper) 0.3s both" }}
          >
            <a href="/signup" className="sch-btn sch-btn--primary sch-focus">
              Create free account
              <ArrowRight size={18} aria-hidden />
            </a>
            <button type="button" onClick={onExploreTools} className="sch-btn sch-btn--ghost sch-focus">
              Explore the tools
            </button>
          </div>
        </div>

        {/* Persona selector — rendered to the right on desktop */}
        {personaSelector && (
          <div
            className="w-full lg:w-72 flex-shrink-0"
            style={{ animation: "rui-rise 0.6s var(--ease-out-paper) 0.15s both" }}
          >
            {personaSelector}
          </div>
        )}
      </div>

      <button
        onClick={onScrollToAbout}
        className="sch-focus absolute bottom-6 left-1/2 -translate-x-1/2 text-muted-foreground hover:text-foreground opacity-60 hover:opacity-100 transition-opacity"
        aria-label="Scroll to why Scholium"
      >
        <ChevronDown size={22} className="animate-bounce" style={{ animationDuration: "2.5s" }} />
      </button>
    </section>
  );
}
