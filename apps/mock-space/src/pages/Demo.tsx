import { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useAttempt } from "@/contexts/AttemptContext";
import { createMcqState, type Letter, type McqQuestion } from "@/lib/mcq";

const DEMO_MINUTES = 5;

// Mirrors scripts/make-sample-paper.mjs's MCQ layout exactly — see that
// file's header comment. Duplicated by value, not imported: that script is
// a standalone Node script (it writes files at module load), not something
// this Vite-bundled page can pull in. MARGIN/MCQ_HEADER_H/MCQ_BLOCK_H/
// MCQ_GAP and the per-question answers below must stay in step with it.
const MARGIN = 56;
const MCQ_HEADER_H = 70;
const MCQ_BLOCK_H = 110;
const MCQ_GAP = 10;
const DEMO_MCQ_ANSWERS: readonly Letter[] = ["B", "C", "A", "D", "B"];

const DEMO_MCQ_QUESTIONS: McqQuestion[] = DEMO_MCQ_ANSWERS.map((answer, i) => {
  // Top-origin points — same formula as make-sample-paper.mjs's blockTop,
  // just flipped: blockTop is native (bottom-origin) y, this is model space.
  const yTopPt = MARGIN + MCQ_HEADER_H + i * (MCQ_BLOCK_H + MCQ_GAP);
  return {
    seq: i + 1,
    label: `Sample Q${i + 1}`,
    answer,
    bands: [{ page: 0, yTopPt, yBotPt: yTopPt + MCQ_BLOCK_H }],
  };
});

interface Props {
  /** /demo/mcq opens the click-through MCQ interface instead of the written workspace. */
  mcq?: boolean;
}

/**
 * A no-signup attempt on a paper we wrote ourselves. It goes through exactly the
 * same pipeline as a real upload, which is why it doubles as the end-to-end test
 * surface for everything below the auth gate.
 */
export default function Demo({ mcq = false }: Props) {
  const navigate = useNavigate();
  const { startAttempt, error } = useAttempt();
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;

    (async () => {
      const res = await fetch(mcq ? "/sample-mcq-paper.pdf" : "/sample-paper.pdf");
      const blob = await res.blob();
      const file = new File(
        [blob],
        mcq ? "Sample Paper - Multiple Choice.pdf" : "Sample Paper - Biology.pdf",
        { type: "application/pdf" },
      );
      const ok = await startAttempt(
        file,
        DEMO_MINUTES * 60_000,
        null,
        mcq ? createMcqState(DEMO_MCQ_QUESTIONS) : null,
      );
      if (ok) navigate("/attempt", { replace: true });
    })();
  }, [mcq, startAttempt, navigate]);

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
