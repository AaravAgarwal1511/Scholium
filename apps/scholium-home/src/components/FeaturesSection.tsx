import { ArrowRight, KeyRound, Brain, EyeOff } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useReveal } from "@/hooks/useReveal";
import type { Persona } from "./PersonaSelector";

interface FeaturesSectionProps {
  persona: Persona | null;
}

interface Cta {
  label: string;
  href?: string;
  sectionId?: string;
}

interface Principle {
  title: string;
  body: string;
  Icon: LucideIcon;
  accentVar: "--primary" | "--accent";
  cta: Cta;
}

interface FeaturesCopy {
  /** Persona-aware "what is Scholium" statement shown in the lead tile. */
  statement: string;
  lead: Principle;
  tiles: Principle[];
}

const CTAS: Record<"signup" | "tools" | "subjects", Cta> = {
  signup: { label: "Create free account", href: "/signup" },
  tools: { label: "View the apps", sectionId: "tools" },
  subjects: { label: "Select your subjects", sectionId: "subjects" },
};

function getCopy(persona: Persona | null): FeaturesCopy {
  if (persona === "teacher") {
    return {
      statement:
        "A free suite of revision tools you can share with your students. One account covers vocabulary drills, active recall, poetry annotation, and past-paper practice.",
      lead: {
        title: "One account, every tool",
        body: "Your students sign in once and every tool in the suite is available — no separate subscriptions, no juggling accounts.",
        Icon: KeyRound,
        accentVar: "--primary",
        cta: CTAS.signup,
      },
      tiles: [
        {
          title: "Built on memory science",
          body: "Each tool is backed by a specific memory principle — spaced repetition, active recall, elaborative interrogation. Nothing is included for the sake of it.",
          Icon: Brain,
          accentVar: "--accent",
          cta: CTAS.tools,
        },
        {
          title: "No feeds. No streaks.",
          body: "No leaderboards, no notifications pulling students away. Tools that help them think, not tools that keep them hooked.",
          Icon: EyeOff,
          accentVar: "--primary",
          cta: CTAS.subjects,
        },
      ],
    };
  }
  if (persona === "parent") {
    return {
      statement:
        "A free suite of revision tools built for students — safe, focused, and genuinely useful. One account unlocks everything, with no subscriptions and no tiers.",
      lead: {
        title: "One account, every tool",
        body: "One login and every tool is included. No separate subscriptions, no extra charges — everything is available the moment your child signs up.",
        Icon: KeyRound,
        accentVar: "--primary",
        cta: CTAS.signup,
      },
      tiles: [
        {
          title: "Built on memory science",
          body: "Every tool is built on how memory forms: spaced practice, active retrieval, and meaningful connections. No tricks, no shortcuts.",
          Icon: Brain,
          accentVar: "--accent",
          cta: CTAS.tools,
        },
        {
          title: "No feeds. No streaks.",
          body: "No addictive loops, no streaks to maintain, no social feeds to distract from work — just structured tools that help knowledge stick.",
          Icon: EyeOff,
          accentVar: "--primary",
          cta: CTAS.subjects,
        },
      ],
    };
  }
  return {
    statement:
      "A free suite of focused learning tools for students, teachers, and parents. One account unlocks every tool, built on proven memory techniques rather than engagement tricks.",
    lead: {
      title: "One account, every tool",
      body: "Sign in once. Your credentials, settings, and dark-mode preference travel across the entire suite — and every tool we add to it.",
      Icon: KeyRound,
      accentVar: "--primary",
      cta: CTAS.signup,
    },
    tiles: [
      {
        title: "Built on memory science",
        body: "Spaced repetition for vocabulary. Active recall passes for study. Connected marginalia for poetry. Each tool earns its place.",
        Icon: Brain,
        accentVar: "--accent",
        cta: CTAS.tools,
      },
      {
        title: "No feeds. No streaks.",
        body: "Just focused interfaces that get out of the way and let you do the work. We don't measure engagement — we measure retention.",
        Icon: EyeOff,
        accentVar: "--primary",
        cta: CTAS.subjects,
      },
    ],
  };
}

function scrollToSection(id: string) {
  document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
}

function TileCta({ cta, accent }: { cta: Cta; accent: string }) {
  const cls =
    "sch-focus mt-5 inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-[0.12em] transition-opacity hover:opacity-70 self-start";
  if (cta.href) {
    return (
      <a href={cta.href} className={cls} style={{ color: accent }}>
        {cta.label}
        <ArrowRight size={14} aria-hidden />
      </a>
    );
  }
  return (
    <button
      type="button"
      onClick={() => cta.sectionId && scrollToSection(cta.sectionId)}
      className={cls}
      style={{ color: accent, background: "transparent", border: "none", padding: 0, cursor: "pointer" }}
    >
      {cta.label}
      <ArrowRight size={14} aria-hidden />
    </button>
  );
}

function IconBadge({ Icon, accentVar }: { Icon: LucideIcon; accentVar: string }) {
  return (
    <span
      aria-hidden
      className="inline-flex items-center justify-center shrink-0 rounded-[var(--radius-sm)]"
      style={{
        width: "2.75rem",
        height: "2.75rem",
        background: `hsl(var(${accentVar}) / 0.1)`,
        color: `hsl(var(${accentVar}))`,
        border: `1px solid hsl(var(${accentVar}) / 0.25)`,
      }}
    >
      <Icon size={22} strokeWidth={2} />
    </span>
  );
}

export default function FeaturesSection({ persona }: FeaturesSectionProps) {
  const { statement, lead, tiles } = getCopy(persona);
  const { ref, revealed } = useReveal<HTMLDivElement>();
  const leadAccent = `hsl(var(${lead.accentVar}))`;

  return (
    <section id="why" className="relative py-24 border-t border-[color:var(--color-rule)]">
      <div className="max-w-6xl mx-auto px-6">
        <header className="mb-14 text-center">
          <h2
            className="text-foreground"
            style={{
              fontSize: "clamp(2rem, 5vw, 3.25rem)",
              lineHeight: 1.05,
              letterSpacing: "-0.02em",
              fontWeight: 700,
            }}
          >
            Why <span style={{ color: "hsl(var(--primary))" }}>Scholium?</span>
          </h2>
          <p className="mt-4 max-w-2xl mx-auto text-foreground/75 leading-relaxed text-lg">
            {statement}
          </p>
        </header>

        <div
          ref={ref}
          className={`reveal grid grid-cols-1 md:grid-cols-3 md:auto-rows-fr gap-6 ${
            revealed ? "is-visible" : ""
          }`}
        >
          {/* Lead tile — large, spans two columns and both rows on desktop. */}
          <article
            data-reveal-child
            className="relative overflow-hidden bg-paper rounded-[var(--radius-lg)] p-8 md:p-10 border flex flex-col md:col-span-2 md:row-span-2"
            style={{ boxShadow: "var(--shadow-card)", borderColor: "var(--color-border)" }}
          >
            {/* Oversized key watermark — fills the lead tile's open space. */}
            <lead.Icon
              aria-hidden
              strokeWidth={1.25}
              className="pointer-events-none absolute -bottom-10 -right-8 select-none"
              style={{
                width: "clamp(11rem, 24vw, 17rem)",
                height: "clamp(11rem, 24vw, 17rem)",
                color: leadAccent,
                opacity: 0.1,
                transform: "rotate(-12deg)",
              }}
            />
            <div className="relative z-10 flex flex-1 flex-col">
              <IconBadge Icon={lead.Icon} accentVar={lead.accentVar} />
              <h3
                className="text-foreground mt-6 mb-3"
                style={{ fontSize: "1.75rem", fontWeight: 700, letterSpacing: "-0.015em", lineHeight: 1.15 }}
              >
                {lead.title}
              </h3>
              <p className="text-base text-muted-foreground leading-relaxed max-w-xl flex-1">
                {lead.body}
              </p>
              <TileCta cta={lead.cta} accent={leadAccent} />
            </div>
          </article>

          {/* Two smaller principle tiles. */}
          {tiles.map(({ title, body, Icon, accentVar, cta }) => {
            const accent = `hsl(var(${accentVar}))`;
            return (
              <article
                key={title}
                data-reveal-child
                className="relative bg-paper rounded-[var(--radius-lg)] p-7 border flex flex-col"
                style={{ boxShadow: "var(--shadow-card)", borderColor: "var(--color-border)" }}
              >
                <IconBadge Icon={Icon} accentVar={accentVar} />
                <h3
                  className="text-foreground mt-5 mb-2.5"
                  style={{ fontSize: "1.25rem", fontWeight: 700, letterSpacing: "-0.01em", lineHeight: 1.25 }}
                >
                  {title}
                </h3>
                <p className="text-sm text-muted-foreground leading-relaxed flex-1">{body}</p>
                <TileCta cta={cta} accent={accent} />
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}
