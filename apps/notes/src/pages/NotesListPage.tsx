import { Link } from "react-router-dom";
import { FileText } from "lucide-react";
import { useAsync } from "@/hooks/useAsync";
import { listNotes } from "@/lib/notes";
import { LoadingGrid, ErrorState, EmptyState } from "@/components/StateViews";

export default function NotesListPage({ description }: { description?: string | null }) {
  const { data: notes, loading, error } = useAsync(listNotes, []);

  return (
    <div className="min-h-screen flex flex-col">
      <header className="container mx-auto px-4 sm:px-6 pt-10 pb-2">
        <h1 className="text-foreground text-3xl sm:text-4xl font-bold tracking-tight">Notes.</h1>
        <p className="mt-2 text-muted-foreground max-w-2xl leading-relaxed">
          {description ?? "Study notes for a range of subjects, as PDFs. Open one to read it."}
        </p>
      </header>

      <main className="flex-1">
        <div className="container mx-auto px-4 sm:px-6 py-8 sm:py-10">
          {loading && <LoadingGrid />}
          {error && <ErrorState error={error} />}
          {!loading && !error && notes && notes.length === 0 && (
            <EmptyState
              title="No notes yet"
              hint="Notes will appear here as they are added."
            />
          )}
          {!loading && !error && notes && notes.length > 0 && (
            <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {notes.map((note) => (
                <li key={note.fileName}>
                  <Link
                    to={`/notes/${encodeURIComponent(note.fileName)}`}
                    className="flex h-full items-start gap-3 rounded-2xl border border-border bg-card p-5 transition-shadow hover:shadow-hover"
                  >
                    <FileText className="mt-0.5 shrink-0 text-primary" size={20} aria-hidden="true" />
                    <span className="min-w-0">
                      <span className="block font-display font-semibold text-foreground">
                        {note.title}
                      </span>
                      <span className="mt-0.5 block text-xs uppercase tracking-wide text-muted-foreground">
                        PDF
                      </span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </main>
    </div>
  );
}
