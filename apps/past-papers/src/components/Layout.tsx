import type { ReactNode } from "react";

interface LayoutProps {
  children: ReactNode;
  subtitle?: string;
}

export default function Layout({
  children,
  subtitle = "Generate a custom paper by picking chapters and how many questions you want from each.",
}: LayoutProps) {
  return (
    <div className="min-h-screen flex flex-col">
      <header className="container mx-auto px-4 sm:px-6 pt-10 pb-2">
        <h1 className="text-foreground text-3xl sm:text-4xl font-bold tracking-tight">
          Past Papers.
        </h1>
        <p className="mt-2 text-muted-foreground max-w-2xl leading-relaxed">
          {subtitle}
        </p>
      </header>
      <main className="flex-1">
        <div className="container mx-auto px-4 sm:px-6 py-8 sm:py-10">
          {children}
        </div>
      </main>
    </div>
  );
}
