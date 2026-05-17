import type { AppLink } from "@repo/ui";
import AppCard from "./AppCard";

interface AppGridProps {
  apps: AppLink[];
  loading: boolean;
}

export default function AppGrid({ apps, loading }: AppGridProps) {
  return (
    <section id="tools" className="py-24 bg-background">
      <div className="container mx-auto px-4 sm:px-6">
        <div className="text-center mb-14">
          <h2
            className="font-display font-bold text-foreground mb-3"
            style={{ fontSize: "clamp(1.75rem, 4vw, 2.5rem)" }}
          >
            The Scholium Suite
          </h2>
          <p className="text-muted-foreground max-w-xl mx-auto leading-relaxed">
            Purpose-built tools for different kinds of learning. Use one, or
            all together with the same account.
          </p>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 max-w-3xl mx-auto">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className="bg-card rounded-2xl border border-border h-52 animate-pulse"
                style={{ boxShadow: "var(--shadow-card)" }}
              />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 max-w-3xl mx-auto">
            {apps.map((app) => (
              <AppCard key={app.id} {...app} />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
