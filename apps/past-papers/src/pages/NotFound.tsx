import { Link } from "react-router-dom";
import Layout from "@/components/Layout";

// Client-side fallback for the SPA's own `*` route. The real fix for the
// audit's soft-404 finding is server-side (vercel.json's explicit rewrites +
// public/404.html, which Vercel serves with a genuine 404 status) — this
// route only matters if something ever calls `navigate()` to an unmatched
// path from inside an already-loaded SPA, which is a much smaller surface
// than the site-wide soft-404 the static 404 page fixes.
//
// Deliberately not @/components/StateViews' EmptyState here: that renders its
// `title` as a plain <p>, which is right for the other call sites (each sits
// below a page that already has its own heading), but this page has nothing
// else on it — it needs a real heading of its own for anyone landing here
// directly, sighted or not.
export default function NotFound() {
  return (
    <Layout subtitle="That page doesn't exist — the generator and every subject still do.">
      <div
        className="rounded-2xl border border-dashed border-border bg-card/50 p-10 text-center"
        style={{ boxShadow: "var(--shadow-soft)" }}
      >
        <h2 className="font-display font-semibold text-lg text-foreground mb-1">Page not found</h2>
        <p className="text-sm text-muted-foreground mb-4">Check the address, or pick up from here.</p>
        <Link to="/" className="inline-block underline font-medium text-primary">
          Go to the paper generator
        </Link>
      </div>
    </Layout>
  );
}
