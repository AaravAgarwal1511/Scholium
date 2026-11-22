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

  return (
    <section id="tools" className={subject ? "py-12" : "py-24"}>
      <div className="max-w-6xl mx-auto px-6">
        {!subject && (
          <h2
            className="mb-3 text-foreground"
            style={{ fontSize: "clamp(2.25rem, 5vw, 3.5rem)", lineHeight: 1, letterSpacing: "-0.04em", fontWeight: 700 }}
          >
            Tools<span style={{ color: "hsl(var(--primary))" }}>.</span>
          </h2>
        )}
        {!subject && (
          <p className="mb-10 text-foreground/70 text-lg">All free. Try any of them without an account.</p>
        )}

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
