import { Link, useParams } from "react-router-dom";
import { ArrowLeft, Download } from "lucide-react";
import { useAsync } from "@/hooks/useAsync";
import { signedUrlFor, parseNoteFileName } from "@/lib/notes";
import { ErrorState } from "@/components/StateViews";

export default function NoteViewerPage() {
  const params = useParams<{ fileName: string }>();
  const fileName = params.fileName ?? "";
  const title = parseNoteFileName(fileName)?.title ?? fileName;

  const { data: signedUrl, loading, error } = useAsync(() => signedUrlFor(fileName), [fileName]);

  // Supabase honours a `download` query param on a signed URL, forcing an
  // attachment disposition so the browser saves the file rather than navigating.
  const downloadUrl = signedUrl
    ? `${signedUrl}${signedUrl.includes("?") ? "&" : "?"}download=${encodeURIComponent(fileName)}`
    : null;

  return (
    <div className="container mx-auto px-4 sm:px-6 py-8">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <Link
          to="/"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft size={16} aria-hidden="true" />
          All notes
        </Link>
        {downloadUrl && (
          <a
            href={downloadUrl}
            className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-1.5 text-sm font-medium text-foreground hover:shadow-hover"
          >
            <Download size={16} aria-hidden="true" />
            Download
          </a>
        )}
      </div>

      <h1 className="mb-4 font-display text-2xl font-bold tracking-tight text-foreground">{title}</h1>

      {loading && <div className="h-[85vh] w-full animate-pulse rounded-lg border border-border bg-card" />}
      {error && (
        <ErrorState
          error={
            new Error(
              "This note could not be opened. It may have been removed, or your session may have expired — try signing in again.",
            )
          }
        />
      )}
      {signedUrl && (
        <iframe
          src={signedUrl}
          title={title}
          className="h-[85vh] w-full rounded-lg border border-border bg-card"
        />
      )}
    </div>
  );
}
