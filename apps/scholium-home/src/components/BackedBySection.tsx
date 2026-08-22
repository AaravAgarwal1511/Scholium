import type { CSSProperties } from "react";
import { PILLARS, REFERENCES } from "@/content/memoryScience";

// Real, citable research the suite is built on — no invented stats. Built
// from the same PILLARS/REFERENCES the memory-science page cites, so a new
// or edited reference there shows up here too instead of living as a second
// hardcoded list. The short in-text label ("Cepeda et al., 2006") already
// exists on each pillar's citation; index it by reference number.
const LABEL_BY_REF: Record<number, string> = {};
for (const pillar of PILLARS) {
  for (const citation of pillar.citations) {
    LABEL_BY_REF[citation.ref] = citation.label;
  }
}

// Varied typefaces echo the mastheads of the journals the studies ran in.
// Each carries a real system fallback stack, so it degrades gracefully on
// platforms without the named font rather than silently falling through to
// `font-family: inherit` (which usd-halo relied on but this app doesn't set).
const JOURNAL_STYLE: Record<string, CSSProperties> = {
  "Psychological Bulletin": {
    fontFamily: "'Times New Roman', Times, Georgia, serif",
    fontWeight: 500,
    letterSpacing: "0.01em",
  },
  "Psychological Science": {
    fontFamily: "Georgia, 'Times New Roman', serif",
    fontWeight: 600,
    letterSpacing: "-0.01em",
  },
  "Psychological Science in the Public Interest": {
    fontFamily: "Palatino, 'Book Antiqua', Georgia, serif",
    fontWeight: 500,
    letterSpacing: "0.02em",
  },
  "Annual Review of Psychology": {
    fontFamily: "'Helvetica Neue', Helvetica, Arial, sans-serif",
    fontWeight: 600,
    letterSpacing: "-0.01em",
  },
};
const DEFAULT_STYLE: CSSProperties = { fontFamily: "var(--font-body)", fontWeight: 600 };

interface Citation {
  label: string;
  journal: string;
  style: CSSProperties;
}

const CITATIONS: Citation[] = REFERENCES.map((ref, i) => {
  const journal = ref.source.split(",")[0].trim();
  return {
    label: LABEL_BY_REF[i + 1] ?? `${ref.authors.split(",")[0]}, ${ref.year}`,
    journal,
    style: JOURNAL_STYLE[journal] ?? DEFAULT_STYLE,
  };
});

export default function BackedBySection() {
  return (
    <section id="research" className="py-16 border-t" style={{ background: "hsl(var(--secondary))", borderColor: "var(--color-rule)" }}>
      <div className="max-w-6xl mx-auto px-6 grid grid-cols-1 md:grid-cols-4 gap-8 items-center">
        {/* Left label */}
        <p className="text-foreground/70 text-base leading-relaxed">
          Grounded in decades of
          <br />
          peer-reviewed memory research.
        </p>

        {/* Marquee — spans 3 cols */}
        <div className="md:col-span-3 overflow-hidden">
          <div className="backers-track">
            {[...CITATIONS, ...CITATIONS].map((cite, i) => (
              <span key={i} className="mx-10 shrink-0 whitespace-nowrap flex flex-col">
                <span className="text-foreground/75 text-[15px]" style={cite.style}>
                  {cite.label}
                </span>
                <span className="text-muted-foreground text-[11px] tracking-wide">{cite.journal}</span>
              </span>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
