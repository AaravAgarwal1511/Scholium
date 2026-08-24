import { LayoutGrid, KeyRound, Gift, ShieldOff } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { AppLink } from "@repo/ui";
import { useReveal } from "@/hooks/useReveal";

interface TrustStripProps {
  apps: AppLink[];
}

interface Stat {
  Icon: LucideIcon;
  label: string;
  sub: string;
}

export default function TrustStrip({ apps }: TrustStripProps) {
  const { ref, revealed } = useReveal<HTMLDivElement>();
  const toolApps = apps.filter((a) => a.id !== "scholium-home");
  const count = toolApps.length;
  const subjectCount = new Set(
    toolApps.flatMap((a) => (a.subjects ?? []).map((s) => s.toLowerCase())),
  ).size;

  const stats: Stat[] = [
    {
      Icon: LayoutGrid,
      label: count > 0 ? `${count} focused tools` : "Focused tools",
      sub: subjectCount > 0 ? `Covering ${subjectCount} subjects` : "One suite, many subjects",
    },
    { Icon: KeyRound, label: "One account", sub: "Sign in once, use them all" },
    { Icon: Gift, label: "Free forever", sub: "No tiers, no subscriptions" },
    { Icon: ShieldOff, label: "No tracking", sub: "No feeds, no ads, no streaks" },
  ];

  return (
    <section aria-label="What Scholium offers" className="border-t" style={{ borderColor: "var(--color-rule)" }}>
      <div
        ref={ref}
        className={`reveal max-w-6xl mx-auto px-6 py-10 grid grid-cols-2 md:grid-cols-4 gap-x-6 gap-y-8 ${
          revealed ? "is-visible" : ""
        }`}
      >
        {stats.map(({ Icon, label, sub }) => (
          <div key={label} data-reveal-child className="flex items-start gap-3">
            <span
              aria-hidden
              className="shrink-0 inline-flex items-center justify-center rounded-[var(--radius-sm)]"
              style={{
                width: "2.25rem",
                height: "2.25rem",
                background: "hsl(var(--primary) / 0.1)",
                color: "hsl(var(--primary))",
                border: "1px solid hsl(var(--primary) / 0.25)",
              }}
            >
              <Icon size={18} strokeWidth={2} />
            </span>
            <div className="min-w-0">
              <p className="text-sm font-bold text-foreground leading-tight">{label}</p>
              <p className="text-xs text-muted-foreground leading-snug mt-0.5">{sub}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
