import { scopedToolTitle } from "@repo/ui";
import { SCOPE } from "@/suiteScope";
import type { ReactNode } from "react";

interface LayoutProps {
  children: ReactNode;
  subtitle?: string;
}

export default function Layout({
  children,
  subtitle,
}: LayoutProps) {
  return (
    <div className="min-h-screen flex flex-col">
      <header className="container mx-auto px-4 sm:px-6 pt-10 pb-2">
        <h1 className="text-foreground text-3xl sm:text-4xl font-bold tracking-tight">
          {SCOPE ? scopedToolTitle(SCOPE) : "Past Papers"}.
        </h1>
        {subtitle && (
          <p className="mt-2 text-muted-foreground max-w-2xl leading-relaxed">{subtitle}</p>
        )}
      </header>
      <main className="flex-1">
        <div className="container mx-auto px-4 sm:px-6 py-8 sm:py-10">
          {children}
        </div>
      </main>
    </div>
  );
}
