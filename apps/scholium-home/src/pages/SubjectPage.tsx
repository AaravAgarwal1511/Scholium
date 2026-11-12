import type { ReactNode } from "react";
import { useParams } from "react-router-dom";
import {
  ScholiumFooter,
  SuiteSubjectBar,
  getSubject,
  getTool,
  toolUrl,
} from "@repo/ui";
import type { AppLink } from "@repo/ui";
import AppGrid from "@/components/AppGrid";

/**
 * `/:subject` — the subject's home in the subject-first suite. Lists every
 * tool that covers the subject; each card opens that tool scoped to it
 * (`/physics/recall`). Unknown slugs render `fallback` (the home page), the
 * same as any other unmatched path.
 */
export default function SubjectPage({ fallback }: { fallback: ReactNode }) {
  const { subject: slug = "" } = useParams();
  const subject = getSubject(slug);
  if (!subject) return <>{fallback}</>;

  const apps: AppLink[] = subject.tools.flatMap((id) => {
    const tool = getTool(id);
    if (!tool) return [];
    return [
      {
        id: tool.id,
        title: tool.title,
        url: toolUrl(tool.id, subject.slug),
        icon: tool.icon,
        description: tool.description,
        subjects: [subject.name],
        has_demo: tool.hasDemo,
        no_login: tool.noLogin,
      },
    ];
  });

  return (
    <div className="min-h-screen flex flex-col">
      <SuiteSubjectBar subject={subject} />
      <main className="flex-1">
        <section className="pt-16">
          <div className="max-w-6xl mx-auto px-6">
            <p className="text-5xl mb-4" aria-hidden>
              {subject.emoji}
            </p>
            <h1
              className="text-foreground"
              style={{
                fontSize: "clamp(2.5rem, 6vw, 4rem)",
                lineHeight: 1,
                letterSpacing: "-0.04em",
                fontWeight: 700,
              }}
            >
              {subject.name}
              <span style={{ color: "hsl(var(--primary))" }}>.</span>
            </h1>
            <p className="mt-4 text-foreground/70 text-lg leading-relaxed max-w-2xl">{subject.blurb}</p>
          </div>
        </section>
        <AppGrid apps={apps} loading={false} subject={subject.name} />
      </main>
      <ScholiumFooter homeUrl="/" />
    </div>
  );
}
