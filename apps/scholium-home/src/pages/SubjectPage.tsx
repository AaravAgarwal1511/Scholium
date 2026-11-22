import { useParams } from "react-router-dom";
import {
  ScholiumFooter,
  SuiteSubjectBar,
  getSubject,
  getTool,
  subjectIntro,
  subjectLabel,
  subjectPageMeta,
  toolUrl,
  type SuiteSubject,
} from "@repo/ui";
import type { AppLink } from "@repo/ui";
import AppGrid from "@/components/AppGrid";
import NotFoundPage from "@/pages/NotFoundPage";
import { useDocumentMeta } from "@/hooks/useDocumentMeta";

/**
 * `/:subject` — the subject's home in the subject-first suite: an introduction
 * and every tool that covers it, each opening that tool scoped to the subject
 * (`/physics/recall`). Every subject gets a real page, even one with a single
 * tool: in-app links skip straight to that tool (`subjectUrl`), but this is the
 * page search visitors land on. Production serves the same copy as static HTML
 * first (prerender.ts). Unknown slugs are a 404.
 */
export default function SubjectPage() {
  const { subject: slug = "" } = useParams();
  const subject = getSubject(slug);
  if (!subject) return <NotFoundPage />;
  return <SubjectView subject={subject} />;
}

function SubjectView({ subject }: { subject: SuiteSubject }) {
  const meta = subjectPageMeta(subject);
  useDocumentMeta({ title: meta.title, description: meta.description, canonicalPath: `/${subject.slug}` });

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
        subjects: [subjectLabel(subject)],
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
              {subject.code && (
                <span className="ml-3 align-middle text-muted-foreground font-medium" style={{ fontSize: "0.45em", letterSpacing: 0 }}>
                  {subject.code}
                </span>
              )}
            </h1>
            <div className="mt-5 max-w-2xl space-y-3 text-foreground/70 text-lg leading-relaxed">
              {subjectIntro(subject).map((p) => (
                <p key={p}>{p}</p>
              ))}
            </div>
          </div>
        </section>
        <AppGrid apps={apps} loading={false} subject={subjectLabel(subject)} />
      </main>
      <ScholiumFooter homeUrl="/" />
    </div>
  );
}
