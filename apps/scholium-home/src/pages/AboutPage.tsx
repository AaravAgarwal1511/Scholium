import { useState } from "react";
import type { AppLink } from "@repo/ui";
import Footer from "@/components/Footer";
import { ABOUT, PORTRAIT } from "@/content/about";
import { useDocumentMeta } from "@/hooks/useDocumentMeta";

interface AboutPageProps {
  apps: AppLink[];
}

/** The photo lives in public/ and may not be there yet, so a failed load falls
 *  back to an initials monogram instead of a broken-image icon. */
function Portrait() {
  const [failed, setFailed] = useState(false);

  return (
    <div
      className="relative w-full overflow-hidden rounded-[var(--radius-lg)] border bg-paper"
      style={{
        aspectRatio: "4 / 5",
        borderColor: "var(--color-border)",
        boxShadow: "var(--shadow-card)",
      }}
    >
      {failed ? (
        <div
          aria-hidden
          className="absolute inset-0 flex items-center justify-center"
          style={{
            background:
              "radial-gradient(ellipse 80% 60% at 50% 30%, hsl(var(--primary) / 0.14), transparent 70%)",
          }}
        >
          <span
            className="text-muted-foreground"
            style={{
              fontFamily: "var(--font-display)",
              fontSize: "clamp(2.5rem, 8vw, 4rem)",
              fontWeight: 700,
              letterSpacing: "0.05em",
            }}
          >
            {PORTRAIT.initials}
          </span>
        </div>
      ) : (
        <img
          src={PORTRAIT.src}
          alt={PORTRAIT.alt}
          onError={() => setFailed(true)}
          className="absolute inset-0 h-full w-full object-cover"
        />
      )}
    </div>
  );
}

export default function AboutPage({ apps }: AboutPageProps) {
  useDocumentMeta({
    title: `About — ${ABOUT.name}`,
    description: ABOUT.lede,
    canonicalPath: "/about",
  });

  return (
    <div className="min-h-screen flex flex-col">
      <main className="flex-1">
        <section className="relative py-24 overflow-hidden">
          <div
            aria-hidden
            className="absolute inset-0 -z-10 pointer-events-none"
            style={{
              backgroundImage:
                "radial-gradient(ellipse 70% 50% at 20% 20%, hsl(var(--primary) / 0.12), transparent 60%), radial-gradient(ellipse 60% 50% at 80% 80%, hsl(var(--accent) / 0.12), transparent 60%)",
            }}
          />
          <div className="max-w-5xl mx-auto px-6">
            {/* Two explicit tracks rather than col-spans in a 12-column grid: at
                phone widths a 12-track grid's eleven gaps outgrow the container,
                and the gaps push the row wider than the viewport. */}
            <div className="grid gap-10 lg:gap-14 items-start sm:grid-cols-[240px_minmax(0,1fr)] lg:grid-cols-[300px_minmax(0,1fr)]">
              <div>
                <div className="sm:sticky sm:top-24 flex flex-col gap-4 max-w-[260px] sm:max-w-none">
                  <Portrait />
                  <div>
                    <p className="text-foreground font-semibold">{ABOUT.name}</p>
                    <p className="text-sm text-muted-foreground">{ABOUT.role}</p>
                  </div>
                </div>
              </div>

              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.15em] text-primary mb-4">
                  {ABOUT.eyebrow}
                </p>
                <h1
                  className="text-foreground"
                  style={{
                    fontFamily: "var(--font-display)",
                    fontSize: "clamp(1.75rem, 3.2vw, 2.5rem)",
                    lineHeight: 1.15,
                    letterSpacing: "-0.02em",
                    fontWeight: 700,
                  }}
                >
                  {ABOUT.lede}
                </h1>

                <div className="mt-8 flex flex-col gap-5">
                  {ABOUT.paragraphs.map((paragraph) => (
                    <p key={paragraph} className="text-lg text-foreground/80 leading-relaxed">
                      {paragraph}
                    </p>
                  ))}
                  <p className="text-lg text-foreground/80 leading-relaxed">
                    {ABOUT.contact.text}{" "}
                    <a
                      href={`mailto:${ABOUT.contact.email}`}
                      className="text-primary hover:underline break-words"
                    >
                      {ABOUT.contact.email}
                    </a>
                  </p>
                </div>

                <div className="mt-10 flex flex-col sm:flex-row flex-wrap gap-3">
                  <a href="/" className="sch-btn sch-btn--primary sch-focus whitespace-nowrap">
                    Explore the suite
                  </a>
                  <a
                    href="/memory-science"
                    className="sch-btn sch-btn--ghost sch-focus whitespace-nowrap"
                  >
                    The memory science
                  </a>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>
      <Footer apps={apps} />
    </div>
  );
}
