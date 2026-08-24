import type { PDFDocumentProxy } from "pdfjs-dist";
import PdfCanvas from "./PdfCanvas";
import { toCss } from "@/lib/coords";
import type { PageGeometry } from "@/lib/pdfRender";
import type { McqQuestion } from "@/lib/mcq";

interface Props {
  doc: PDFDocumentProxy;
  /** The attempt's full page geometry list — same array PageLayer reads. */
  pages: PageGeometry[];
  question: McqQuestion;
  scale: number;
}

/**
 * Renders just one question's own slice of the composed PDF: one clipped
 * window per band, stacked in order. Reuses PdfCanvas exactly as the written
 * workspace does — it always draws a whole page — and crops to the band by
 * sizing an `overflow: hidden` wrapper to the band's height and shifting the
 * canvas up by `yTopPt * scale`. In practice a question has exactly one band
 * (a multiple-choice mark-scheme row is a single short crop); more than one
 * only happens when that crop's own placement spilled onto a fresh output
 * page (see PageLayout._place in the composer).
 */
export default function QuestionView({ doc, pages, question, scale }: Props) {
  return (
    <div
      className="flex w-full flex-col items-center gap-2"
      data-mcq-seq={question.seq}
    >
      {question.bands.map((band, i) => {
        const geometry = pages[band.page];
        if (!geometry) return null;
        const heightPt = band.yBotPt - band.yTopPt;
        return (
          <div
            key={i}
            className="overflow-hidden rounded-lg border border-border bg-white shadow-card"
            style={{ width: toCss(geometry.widthPt, scale), height: toCss(heightPt, scale) }}
          >
            <div style={{ marginTop: -toCss(band.yTopPt, scale) }}>
              <PdfCanvas doc={doc} pageNumber={band.page + 1} scale={scale} />
            </div>
          </div>
        );
      })}
    </div>
  );
}
