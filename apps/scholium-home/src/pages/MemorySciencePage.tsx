import { Brain, Dumbbell, Repeat } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { ScholiumFooter } from "@repo/ui";
import { PILLARS, REFERENCES } from "@/content/memoryScience";
import { useDocumentMeta } from "@/hooks/useDocumentMeta";

const ICONS: Record<string, LucideIcon> = { Repeat, Brain, Dumbbell };

export default function MemorySciencePage() {
  useDocumentMeta({
    title: "The memory science behind Scholium",
    description:
      "Scholium’s tools are built on peer-reviewed research: spaced repetition, active recall, and desirable difficulty. See the studies — and why we skip the gamification.",
    canonicalPath: "/memory-science",
  });

  return (
    <div className="min-h-screen flex flex-col">
      <main className="flex-1">
        {/* Hero */}
        <section className="relative py-24 overflow-hidden">
          <div
            aria-hidden
            className="absolute inset-0 -z-10 pointer-events-none"
            style={{
              backgroundImage:
                "radial-gradient(ellipse 70% 50% at 20% 20%, hsl(var(--primary) / 0.12), transparent 60%), radial-gradient(ellipse 60% 50% at 80% 80%, hsl(var(--accent) / 0.12), transparent 60%)",
            }}
          />
          <div className="max-w-3xl mx-auto px-6 text-center">
            <p className="text-sm font-semibold uppercase tracking-[0.15em] text-primary mb-4">
              The evidence
            </p>
            <h1
              className="text-foreground"
              style={{
                fontFamily: "var(--font-display)",
                fontSize: "clamp(2.25rem, 6vw, 4rem)",
                lineHeight: 1.05,
                letterSpacing: "-0.025em",
                fontWeight: 700,
              }}
            >
              Built on how memory{" "}
              <span style={{ color: "hsl(var(--primary))" }}>actually works.</span>
            </h1>
            <p className="mt-6 text-lg text-foreground/80 leading-relaxed">
              Every tool in the suite is designed around a small number of findings that
              cognitive psychology has replicated for decades. No engagement tricks — just the
              techniques the research actually supports, and the citations to back them.
            </p>
          </div>
        </section>

        {/* Pillars */}
        <section className="pb-8">
          <div className="max-w-3xl mx-auto px-6 flex flex-col gap-6">
            {PILLARS.map((pillar) => {
              const Icon = ICONS[pillar.icon] ?? Brain;
              return (
                <article
                  key={pillar.id}
                  id={pillar.id}
                  className="bg-paper rounded-[var(--radius-lg)] border p-8 sm:p-10"
                  style={{ boxShadow: "var(--shadow-card)", borderColor: "var(--color-border)" }}
                >
                  <span
                    aria-hidden
                    className="inline-flex items-center justify-center rounded-[var(--radius-sm)] mb-5"
                    style={{
                      width: "2.75rem",
                      height: "2.75rem",
                      background: "hsl(var(--primary) / 0.1)",
                      color: "hsl(var(--primary))",
                      border: "1px solid hsl(var(--primary) / 0.25)",
                    }}
                  >
                    <Icon size={22} strokeWidth={2} />
                  </span>
                  <h2
                    className="text-foreground mb-4"
                    style={{ fontSize: "1.6rem", fontWeight: 700, letterSpacing: "-0.015em", lineHeight: 1.2 }}
                  >
                    {pillar.technique}
                  </h2>
                  <p className="text-foreground/85 leading-relaxed">{pillar.finding}</p>

                  <div className="mt-5 pl-4 border-l-2 border-[color:var(--color-rule)]">
                    <p className="text-xs font-semibold uppercase tracking-[0.1em] text-muted-foreground mb-1">
                      In Scholium
                    </p>
                    <p className="text-foreground/80 leading-relaxed">{pillar.inScholium}</p>
                  </div>

                  <p className="mt-5 text-sm text-muted-foreground">
                    Evidence:{" "}
                    {pillar.citations.map((c, i) => (
                      <span key={c.label}>
                        <a href={`#ref-${c.ref}`} className="text-primary hover:underline font-medium">
                          {c.label}
                        </a>
                        {i < pillar.citations.length - 1 ? "; " : ""}
                      </span>
                    ))}
                  </p>
                </article>
              );
            })}
          </div>
        </section>

        {/* References */}
        <section className="py-16 border-t border-[color:var(--color-rule)] mt-12">
          <div className="max-w-3xl mx-auto px-6">
            <h2 className="text-foreground mb-6" style={{ fontSize: "1.5rem", fontWeight: 700, letterSpacing: "-0.015em" }}>
              References
            </h2>
            <ol className="flex flex-col gap-4 list-none p-0 m-0">
              {REFERENCES.map((ref, i) => (
                <li
                  key={ref.url}
                  id={`ref-${i + 1}`}
                  className="text-sm text-foreground/80 leading-relaxed flex gap-3 scroll-mt-24"
                >
                  <span className="font-semibold text-muted-foreground shrink-0">{i + 1}.</span>
                  <span>
                    {ref.authors} ({ref.year}). {ref.title} <em>{ref.source}</em>{" "}
                    <a
                      href={ref.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary hover:underline break-words"
                    >
                      {ref.url}
                    </a>
                  </span>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* CTA */}
        <section className="py-16 border-t border-[color:var(--color-rule)]">
          <div className="max-w-2xl mx-auto px-6 text-center">
            <h2 className="text-foreground mb-3" style={{ fontSize: "1.75rem", fontWeight: 700, letterSpacing: "-0.02em" }}>
              Put the evidence to work.
            </h2>
            <p className="text-foreground/75 leading-relaxed mb-7">
              The whole suite is free, and you can try any tool without an account.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <a href="/signup" className="sch-btn sch-btn--primary sch-focus">
                Create free account
              </a>
              <a href="/" className="sch-btn sch-btn--ghost sch-focus">
                Explore the suite
              </a>
            </div>
          </div>
        </section>
      </main>
      <ScholiumFooter homeUrl="/" />
    </div>
  );
}
