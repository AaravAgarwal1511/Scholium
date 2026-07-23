import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import type { PDFDocumentProxy } from "pdfjs-dist";
import { loadPdf, UnsupportedPdfError, type PageGeometry } from "@/lib/pdfRender";
import { reviveTimer } from "@/lib/useTimer";
import type { Attempt } from "@/lib/model";
import { isPaperExpired, PAPER_RETENTION_DAYS } from "@/lib/paperRetention";
import { downloadPaper, uploadPaper } from "@/lib/paperStorage";
import {
  clearActiveAttemptId,
  getActiveAttemptId,
  loadAttempt,
  saveAttempt,
  setActiveAttemptId,
} from "@/lib/attemptStore";
import { useAuth } from "@/contexts/AuthContext";
import { useAnalytics } from "@repo/analytics";

/** Each save is a network round trip now, so a slightly longer window than a disk write. */
const SAVE_DEBOUNCE_MS = 800;

interface AttemptContextType {
  attempt: Attempt | null;
  doc: PDFDocumentProxy | null;
  /**
   * The original, never-transferred PDF bytes, which the exporter re-reads at the
   * end of the attempt. A getter rather than a value: it lives in a ref, so
   * capturing it in a memo would hand callers a stale buffer.
   */
  getPdfBytes(): ArrayBuffer | null;
  /** True until the open attempt (if any) has been fetched from the account. */
  restoring: boolean;
  loading: boolean;
  error: string | null;
  /** The last autosave failed. The attempt is safe in memory but not yet in the account. */
  saveFailed: boolean;
  startAttempt(file: File, durationMs: number, userId: string | null): Promise<boolean>;
  resumeAttempt(id: string): Promise<boolean>;
  /**
   * Takes an updater, not a value. Several of these fire in one tick — adding a box
   * blurs the previous one, which deletes it if it was left empty — and a caller
   * holding a stale `attempt` from its closure would silently undo the other's work.
   */
  updateAttempt(update: (prev: Attempt) => Attempt): void;
  clearAttempt(): void;
}

const AttemptContext = createContext<AttemptContextType | null>(null);

export function AttemptProvider({ children }: { children: ReactNode }) {
  const { user, loadingAuth } = useAuth();
  const { track } = useAnalytics();

  const [attempt, setAttempt] = useState<Attempt | null>(null);
  const [doc, setDoc] = useState<PDFDocumentProxy | null>(null);
  const [restoring, setRestoring] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saveFailed, setSaveFailed] = useState(false);

  // A ref, not state: these bytes must survive every re-render untouched, and
  // nothing should ever re-render because they changed.
  const pdfBytes = useRef<ArrayBuffer | null>(null);
  const saveTimer = useRef<number | null>(null);
  const pending = useRef<Attempt | null>(null);
  /** Mirrors `attempt` so updaters compose within a single tick. */
  const current = useRef<Attempt | null>(null);

  const persist = useCallback((next: Attempt) => {
    saveAttempt(next)
      .then(() => setSaveFailed(false))
      .catch(() => {
        setSaveFailed(true);
        track("autosave_failed");
      });
  }, [track]);

  const flush = useCallback(() => {
    if (saveTimer.current !== null) {
      window.clearTimeout(saveTimer.current);
      saveTimer.current = null;
    }
    if (pending.current) {
      persist(pending.current);
      pending.current = null;
    }
  }, [persist]);

  // Losing a few hundred milliseconds of typing to a crash is survivable; losing it
  // to a tab switch that never came back is not.
  useEffect(() => {
    const onHide = () => flush();
    window.addEventListener("visibilitychange", onHide);
    window.addEventListener("pagehide", onHide);
    return () => {
      window.removeEventListener("visibilitychange", onHide);
      window.removeEventListener("pagehide", onHide);
      flush();
    };
  }, [flush]);

  /** Parses the PDF, installs it as the live attempt, and reports its page geometry. */
  const open = useCallback(async (next: Attempt, bytes: ArrayBuffer): Promise<PageGeometry[]> => {
    const { doc: loaded, pages } = await loadPdf(bytes);
    pdfBytes.current = bytes;
    setDoc(loaded);
    current.current = { ...next, pages };
    setAttempt(current.current);
    return pages;
  }, []);

  const clearAttempt = useCallback(() => {
    flush();
    clearActiveAttemptId();
    pdfBytes.current = null;
    current.current = null;
    setDoc(null);
    setAttempt(null);
    setError(null);
    setSaveFailed(false);
  }, [flush]);

  const startAttempt = useCallback(
    async (file: File, durationMs: number, userId: string | null) => {
      setLoading(true);
      setError(null);
      try {
        const bytes = await file.arrayBuffer();
        const id = crypto.randomUUID();
        const draft: Attempt = {
          id,
          userId,
          title: file.name.replace(/\.pdf$/i, ""),
          createdAt: Date.now(),
          updatedAt: Date.now(),
          pages: [],
          boxes: [],
          strokes: [],
          timer: { durationMs, deadlineAt: null, remainingMs: durationMs, state: "idle" },
        };

        // Parse first: an unreadable PDF should be rejected before anything is stored.
        const pages = await open(draft, bytes);

        // Signed out (/demo) the attempt is deliberately ephemeral.
        if (!userId) {
          track("attempt_start", { pages: pages.length, source: "demo" });
          return true;
        }

        // Storage now holds the only copy of the paper, so the attempt row must never
        // exist without it. Await the upload and refuse to start if it fails, rather
        // than let a student sit a mock that cannot be reopened.
        const uploaded = await uploadPaper(userId, id, file);
        if (!uploaded) {
          clearAttempt();
          setError("Could not save the paper to your account. Check your connection and try again.");
          track("attempt_start_failed", { reason: "upload" });
          return false;
        }

        // Its own catch: a failed insert is a storage problem, not a bad PDF.
        try {
          await saveAttempt({ ...draft, pages });
        } catch {
          clearAttempt();
          setError("Could not save this attempt to your account. Check your connection and try again.");
          track("attempt_start_failed", { reason: "save" });
          return false;
        }

        setActiveAttemptId(id);
        track("attempt_start", { pages: pages.length, source: "upload" });
        return true;
      } catch (e) {
        clearAttempt();
        setError(
          e instanceof UnsupportedPdfError ? e.message : "That file could not be opened as a PDF.",
        );
        track("attempt_start_failed", {
          reason: e instanceof UnsupportedPdfError ? "bad_pdf" : "unknown",
        });
        return false;
      } finally {
        setLoading(false);
      }
    },
    [open, clearAttempt, track],
  );

  const resumeAttempt = useCallback(
    async (id: string) => {
      setLoading(true);
      setError(null);
      try {
        const stored = await loadAttempt(id);
        if (!stored || !stored.userId) {
          clearActiveAttemptId();
          return false;
        }
        if (isPaperExpired(stored.createdAt)) {
          clearActiveAttemptId();
          setError(`That paper has expired. Papers are kept for ${PAPER_RETENTION_DAYS} days.`);
          return false;
        }

        const bytes = await downloadPaper(stored.userId, stored.id);
        if (!bytes) {
          clearActiveAttemptId();
          setError("The paper for that attempt is no longer stored.");
          return false;
        }

        // The clock keeps running while the tab is closed: reviveTimer charges the
        // attempt for the time it was away, and expires it if the deadline passed.
        await open({ ...stored, timer: reviveTimer(stored.timer) }, bytes);
        setActiveAttemptId(id);
        return true;
      } catch {
        setError("That attempt could not be reopened.");
        return false;
      } finally {
        setLoading(false);
      }
    },
    [open],
  );

  // Reopening waits for auth: the attempt lives behind RLS, so a select before the
  // session is restored would come back empty rather than merely slow.
  useEffect(() => {
    if (loadingAuth) return;

    if (!user) {
      setRestoring(false);
      return;
    }
    const id = getActiveAttemptId();
    if (!id) {
      setRestoring(false);
      return;
    }
    let cancelled = false;
    resumeAttempt(id).finally(() => {
      if (!cancelled) setRestoring(false);
    });
    return () => {
      cancelled = true;
    };
  }, [loadingAuth, user, resumeAttempt]);

  const updateAttempt = useCallback(
    (update: (prev: Attempt) => Attempt) => {
      const prev = current.current;
      if (!prev) return;

      const next = { ...update(prev), updatedAt: Date.now() };
      current.current = next;
      setAttempt(next);

      pending.current = next;
      if (saveTimer.current !== null) window.clearTimeout(saveTimer.current);
      saveTimer.current = window.setTimeout(() => {
        saveTimer.current = null;
        if (pending.current) {
          persist(pending.current);
          pending.current = null;
        }
      }, SAVE_DEBOUNCE_MS);
    },
    [persist],
  );

  const getPdfBytes = useCallback(() => pdfBytes.current, []);

  const value = useMemo(
    () => ({
      attempt,
      doc,
      getPdfBytes,
      restoring,
      loading,
      error,
      saveFailed,
      startAttempt,
      resumeAttempt,
      updateAttempt,
      clearAttempt,
    }),
    [
      attempt,
      doc,
      getPdfBytes,
      restoring,
      loading,
      error,
      saveFailed,
      startAttempt,
      resumeAttempt,
      updateAttempt,
      clearAttempt,
    ],
  );

  return <AttemptContext.Provider value={value}>{children}</AttemptContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAttempt() {
  const ctx = useContext(AttemptContext);
  if (!ctx) throw new Error("useAttempt must be used inside AttemptProvider");
  return ctx;
}
