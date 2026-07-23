import { cn } from "@/lib/utils";
import { PASS_CONFIG } from "@/lib/passConfig";

export function PassBadge({ pass }: { pass: number }) {
  const c = PASS_CONFIG[pass] || PASS_CONFIG[1];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold",
        c.bg,
        c.text,
      )}
    >
      {c.label}
    </span>
  );
}
