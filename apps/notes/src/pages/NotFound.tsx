import { Link } from "react-router-dom";

export default function NotFound() {
  return (
    <div className="container mx-auto px-4 sm:px-6 py-16">
      <div
        className="mx-auto max-w-md rounded-2xl border border-dashed border-border bg-card/50 p-10 text-center"
        style={{ boxShadow: "var(--shadow-soft)" }}
      >
        <h1 className="mb-1 font-display text-lg font-semibold text-foreground">Page not found</h1>
        <p className="mb-4 text-sm text-muted-foreground">Check the address, or head back to the notes.</p>
        <Link to="/" className="inline-block font-medium text-primary underline">
          Go to all notes
        </Link>
      </div>
    </div>
  );
}
