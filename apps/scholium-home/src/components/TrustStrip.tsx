import { LayoutGrid, KeyRound, Gift, ShieldOff } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useReveal } from "@/hooks/useReveal";

interface Stat {
  Icon: LucideIcon;
  label: string;
  sub: string;
}

const STATS: Stat[] = [
  { Icon: LayoutGrid, label: "4 focused tools", sub: "Vocabulary, recall, poetry, papers" },
  { Icon: KeyRound, label: "One account", sub: "Sign in once, use them all" },
  { Icon: Gift, label: "Free forever", sub: "No tiers, no subscriptions" },
  { Icon: ShieldOff, label: "No tracking", sub: "No feeds, no ads, no streaks" },
];

export default function TrustStrip() {
  const { ref, revealed } = useReveal<HTMLDivElement>();

  return (
    <section
      aria-label="What Scholium offers"
      className="border-t border-[color:var(--color-rule)]"
    >
      <div
        ref={ref}
        className={`reveal max-w-6xl mx-auto px-6 py-10 grid grid-cols-2 md:grid-cols-4 gap-x-6 gap-y-8 ${
          revealed ? "is-visible" : ""
        }`}
      >
        {STATS.map(({ Icon, label, sub }) => (
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
