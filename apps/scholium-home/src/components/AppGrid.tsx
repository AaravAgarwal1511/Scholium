import type { AppLink } from "@repo/ui";
import AppCard from "./AppCard";

interface AppGridProps {
  apps: AppLink[];
  loading: boolean;
  highlightedAppId?: string | null;
  subject?: string | null;
}

export default function AppGrid({ apps, loading, highlightedAppId, subject }: AppGridProps) {
  const toolApps = apps.filter((a) => a.id !== "scholium-home");
  const count = toolApps.length;
  const subtitle = subject
    ? `Tools that cover ${subject}.`
    : count === 0
      ? "Purpose-built tools for different kinds of study."
      : `Each one purpose-built for a different kind of study. Use one, or use them all.`;

  return (
    <section id="tools" className="py-24">
      <div className="max-w-6xl mx-auto px-6">
        <header className="mb-14 max-w-2xl">
          <p className="text-muted-foreground text-sm mb-2 font-medium">The Scholium Suite</p>
          <h2
            className="text-foreground"
            style={{
              fontSize: "clamp(2.25rem, 5vw, 3.5rem)",
              lineHeight: 1,
              letterSpacing: "-0.04em",
              fontWeight: 700,
            }}
          >
            {subject ? (
              <>
                {count} tools —{" "}
                <span style={{ color: "hsl(var(--primary))" }}>for {subject}.</span>
              </>
            ) : (
              <>
                {count > 0 ? count : ""} tools,
                <br />
                <span style={{ color: "hsl(var(--primary))" }}>one account.</span>
              </>
            )}
          </h2>
          <p className="mt-4 text-foreground/70 text-lg leading-relaxed">{subtitle}</p>
        </header>

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {[0, 1, 2, 3].map((i) => (
              <div
                key={i}
                className="bg-paper rounded-[var(--radius-lg)] border h-80 animate-pulse"
                style={{ borderColor: "var(--color-border)" }}
              />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 rui-stagger">
            {toolApps.map((app) => (
              <AppCard key={app.id} {...app} highlighted={app.id === highlightedAppId} />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
