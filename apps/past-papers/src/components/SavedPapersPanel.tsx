import { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { toast } from "sonner";
import type { User } from "@supabase/supabase-js";
import { History, Download as DownloadIcon, Trash2 } from "lucide-react";
import { useAnalytics } from "@repo/analytics";
import { EmptyState } from "@/components/StateViews";
import { downloadPaper, subjectDisplayName } from "@/lib/papers";
import { listSavedPapers, deleteSavedPaper, resolveSavedPaper, type SavedPaper } from "@/lib/savedPapers";

interface SavedPapersPanelProps {
  user: User | null;
  loadingAuth: boolean;
  // Bumped by the parent whenever a paper is generated while signed in, so the
  // list picks up the new row without this panel needing to know why it changed.
  refreshSignal: number;
}

// The one thing a signed-in user gets that a signed-out one doesn't — the
// generator itself stays fully usable either way (no_login = true in
// scholium_apps). This panel sits above the generator so it's the first thing
// a returning user sees, and it's the actual pitch: signed out, it explains
// what signing in buys; signed in, it's the receipt.
export default function SavedPapersPanel({ user, loadingAuth, refreshSignal }: SavedPapersPanelProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const { track } = useAnalytics();
  const [papers, setPapers] = useState<SavedPaper[] | null>(null);
  const [loadError, setLoadError] = useState<Error | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    if (!user) {
      setPapers(null);
      return;
    }
    let cancelled = false;
    listSavedPapers(user.id)
      .then((rows) => {
        if (!cancelled) setLoadError(null);
        if (!cancelled) setPapers(rows);
      })
      .catch((err) => {
        if (!cancelled) setLoadError(err instanceof Error ? err : new Error(String(err)));
      });
    return () => {
      cancelled = true;
    };
  }, [user, refreshSignal]);

  if (loadingAuth) return null;

  const signInHref = () => {
    const next = encodeURIComponent(location.pathname + location.search);
    return `/signin?next=${next}&hint=history`;
  };

  if (!user) {
    return (
      <section className="mb-8">
        <EmptyState
          title="Your papers, wherever you sign in"
          hint="Sign in to keep every paper you generate. Come back any time to re-download it or open it in Mock Space."
        >
          <button
            type="button"
            onClick={() => {
              track("signin_click", { source: "history_panel" });
              navigate(signInHref());
            }}
            className="px-4 py-2 rounded-lg font-semibold text-sm"
            style={{ backgroundColor: "hsl(var(--primary))", color: "hsl(var(--primary-foreground))" }}
          >
            Sign in
          </button>
        </EmptyState>
      </section>
    );
  }

  async function handleDownload(paper: SavedPaper) {
    setBusyId(paper.id);
    try {
      const resolved = await resolveSavedPaper(paper);
      downloadPaper(resolved, paper.fileName);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not download this paper");
    } finally {
      setBusyId(null);
    }
  }

  async function handleDelete(paper: SavedPaper) {
    setBusyId(paper.id);
    try {
      await deleteSavedPaper(paper.id);
      setPapers((prev) => prev?.filter((p) => p.id !== paper.id) ?? prev);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not delete this paper");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <section className="mb-8">
      <h2 className="font-display font-semibold text-lg mb-4 flex items-center gap-2">
        <span className="flex items-center justify-center w-7 h-7 rounded-full bg-primary/10 text-primary">
          <History size={16} />
        </span>
        Your saved papers
      </h2>

      {loadError ? (
        <p className="text-sm text-muted-foreground">Could not load your saved papers.</p>
      ) : papers === null ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {Array.from({ length: 2 }).map((_, i) => (
            <div key={i} className="h-16 rounded-lg bg-card animate-pulse" />
          ))}
        </div>
      ) : papers.length === 0 ? (
        <EmptyState
          title="No saved papers yet"
          hint="Generate one below and it'll show up here."
        />
      ) : (
        <ul className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {papers.map((paper) => (
            <li
              key={paper.id}
              className="flex items-center justify-between gap-3 px-4 py-3 rounded-lg border border-border bg-card"
            >
              <div className="min-w-0">
                <p className="font-medium text-sm truncate">
                  {subjectDisplayName(paper.subject)} · {paper.component}
                </p>
                <p className="text-xs text-muted-foreground">
                  {new Date(paper.createdAt).toLocaleDateString(undefined, {
                    year: "numeric",
                    month: "short",
                    day: "numeric",
                  })}{" "}
                  · {paper.questionIds.length} questions
                </p>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <button
                  type="button"
                  onClick={() => handleDownload(paper)}
                  disabled={busyId === paper.id}
                  aria-label={`Download ${paper.fileName}`}
                  className="p-2 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted disabled:opacity-50"
                >
                  <DownloadIcon size={16} />
                </button>
                <button
                  type="button"
                  onClick={() => handleDelete(paper)}
                  disabled={busyId === paper.id}
                  aria-label={`Delete ${paper.fileName}`}
                  className="p-2 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 disabled:opacity-50"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
