import type { ReactNode } from "react";

export function LoadingGrid({ count = 6 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="h-28 rounded-2xl border border-border bg-card animate-pulse"
        />
      ))}
    </div>
  );
}

export function ErrorState({ error }: { error: Error }) {
  return (
    <div
      className="rounded-2xl border border-destructive/30 bg-destructive/5 p-6 text-sm"
      role="alert"
    >
      <p className="font-semibold text-destructive mb-1">Something went wrong</p>
      <p className="text-muted-foreground">{error.message}</p>
    </div>
  );
}

export function EmptyState({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: string;
  children?: ReactNode;
}) {
  return (
    <div
      className="rounded-2xl border border-dashed border-border bg-card/50 p-10 text-center"
      style={{ boxShadow: "var(--shadow-soft)" }}
    >
      <p className="font-display font-semibold text-lg text-foreground mb-1">
        {title}
      </p>
      {hint && <p className="text-sm text-muted-foreground mb-4">{hint}</p>}
      {children}
    </div>
  );
}
