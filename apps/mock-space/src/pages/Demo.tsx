import { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useAttempt } from "@/contexts/AttemptContext";

const DEMO_MINUTES = 5;

/**
 * A no-signup attempt on a paper we wrote ourselves. It goes through exactly the
 * same pipeline as a real upload, which is why it doubles as the end-to-end test
 * surface for everything below the auth gate.
 */
export default function Demo() {
  const navigate = useNavigate();
  const { startAttempt, error } = useAttempt();
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;

    (async () => {
      const res = await fetch("/sample-paper.pdf");
      const blob = await res.blob();
      const file = new File([blob], "Sample Paper - Biology.pdf", { type: "application/pdf" });
      const ok = await startAttempt(file, DEMO_MINUTES * 60_000, null);
      if (ok) navigate("/attempt", { replace: true });
    })();
  }, [startAttempt, navigate]);

  return (
    <main className="mx-auto max-w-md px-6 py-24 text-center">
      {error ? (
        <p
          className="rounded-lg px-3 py-2 text-sm"
          style={{ background: "hsl(var(--destructive) / 0.1)", color: "hsl(var(--destructive))" }}
        >
          {error}
        </p>
      ) : (
        <p className="text-sm text-muted-foreground">Opening the sample paper…</p>
      )}
    </main>
  );
}
