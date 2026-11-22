import { Link } from "react-router-dom";
import { ScholiumFooter } from "@repo/ui";
import { useDocumentMeta } from "@/hooks/useDocumentMeta";

/**
 * Unknown paths and unknown subjects. In production Vercel serves these from
 * 404.html with a real 404 status (see prerender.ts); this is what the app then
 * renders there, and in dev.
 */
export default function NotFoundPage() {
  useDocumentMeta({ title: "Page not found · Scholium" });
  return (
    <div className="min-h-screen flex flex-col">
      <main className="flex-1 py-24">
        <div className="max-w-3xl mx-auto px-6">
          <h1 className="text-foreground text-4xl font-bold" style={{ letterSpacing: "-0.03em" }}>
            Page not found<span style={{ color: "hsl(var(--primary))" }}>.</span>
          </h1>
          <p className="mt-4 text-foreground/70 text-lg">
            That page doesn&apos;t exist. <Link to="/" className="underline underline-offset-4">Go to the home page</Link> to pick a subject.
          </p>
        </div>
      </main>
      <ScholiumFooter homeUrl="/" />
    </div>
  );
}
