import { Navigate, useParams } from "react-router-dom";
import { ArrowUpRight } from "lucide-react";
import { ScholiumFooter, getToolByMount, subjectsForTool, toolUrl } from "@repo/ui";

/**
 * `/tools/:mount` — where the navbar's Study-tools dropdown lands. The suite is
 * organised by subject, so picking a tool means picking which subject to use
 * it for; each card opens the tool scoped to that subject (/physics/recall).
 */
export default function ToolSubjectsPage() {
  const { mount = "" } = useParams();
  const tool = getToolByMount(mount);
  if (!tool) return <Navigate to="/" replace />;
  const subjects = subjectsForTool(tool.id);

  return (
    <div className="min-h-screen flex flex-col">
      <main className="flex-1 py-20">
        <div className="max-w-4xl mx-auto px-6">
          <p className="text-muted-foreground text-sm mb-2 font-medium">The Scholium Suite</p>
          <h1
            className="text-foreground"
            style={{
              fontSize: "clamp(2.25rem, 5vw, 3.5rem)",
              lineHeight: 1,
              letterSpacing: "-0.04em",
              fontWeight: 700,
            }}
          >
            <span className="mr-3" aria-hidden>
              {tool.icon}
            </span>
            {tool.title}
          </h1>
          <p className="mt-4 text-foreground/70 text-lg leading-relaxed">{tool.description}</p>

          <h2 className="mt-14 mb-5 text-foreground text-xl font-semibold" style={{ letterSpacing: "-0.01em" }}>
            Choose a <span style={{ color: "hsl(var(--primary))" }}>subject</span>.
          </h2>

          <ul className="grid grid-cols-1 sm:grid-cols-2 gap-4 list-none p-0 m-0 rui-stagger">
            {subjects.map((s) => (
              <li key={s.slug}>
                {/* Straight into the tool for that subject — the visitor already
                    chose the tool. A plain <a>: the tool is another zone, so
                    this is a full page load, not a client-side route. */}
                <a
                  href={toolUrl(tool.id, s.slug)}
                  className="sch-focus group flex items-start gap-4 p-6 rounded-[var(--radius-lg)] bg-paper border transition-all duration-300 hover:-translate-y-1"
                  style={{ borderColor: "var(--color-border)", boxShadow: "var(--shadow-card)" }}
                >
                  <span className="text-4xl" aria-hidden>
                    {s.emoji}
                  </span>
                  <span className="flex-1">
                    <span className="block text-foreground text-2xl font-semibold" style={{ letterSpacing: "-0.02em" }}>
                      {s.name}
                    </span>
                    <span className="mt-1 block text-muted-foreground leading-relaxed">{s.blurb}</span>
                    <span className="mt-3 block text-xs font-semibold uppercase tracking-[0.08em]" style={{ color: "hsl(var(--primary))" }}>
                      Open {tool.title} for {s.name}
                    </span>
                  </span>
                  <ArrowUpRight
                    size={20}
                    className="flex-shrink-0 transition-transform duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
                    style={{ color: "hsl(var(--primary))" }}
                  />
                </a>
              </li>
            ))}
          </ul>
        </div>
      </main>
      <ScholiumFooter homeUrl="/" />
    </div>
  );
}
