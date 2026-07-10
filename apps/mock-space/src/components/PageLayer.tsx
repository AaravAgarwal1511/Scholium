import type { ReactNode } from "react";
import type { PDFDocumentProxy } from "pdfjs-dist";
import PdfCanvas from "./PdfCanvas";
import { toCss } from "@/lib/coords";
import type { PageGeometry } from "@/lib/pdfRender";

interface Props {
  doc: PDFDocumentProxy;
  /** 0-based. */
  pageIndex: number;
  geometry: PageGeometry;
  scale: number;
  /** Absolutely positioned children, in CSS pixels relative to the page's top-left. */
  children?: ReactNode;
  /** Sits above the paper and below the answer boxes. */
  underlay?: ReactNode;
  onPointerDown?: (e: React.PointerEvent<HTMLDivElement>) => void;
}

/**
 * A rendered page plus an overlay whose coordinate origin is the page's top-left —
 * the same origin model space uses, so a box at model (x, y) sits at CSS
 * (x * scale, y * scale) with no further translation.
 */
export default function PageLayer({
  doc,
  pageIndex,
  geometry,
  scale,
  children,
  underlay,
  onPointerDown,
}: Props) {
  const width = toCss(geometry.widthPt, scale);
  const height = toCss(geometry.heightPt, scale);

  return (
    <div
      className="relative mx-auto bg-white shadow-card"
      style={{ width, height }}
      data-page={pageIndex}
    >
      <PdfCanvas doc={doc} pageNumber={pageIndex + 1} scale={scale} />
      {underlay}
      <div className="absolute inset-0" onPointerDown={onPointerDown}>
        {children}
      </div>
    </div>
  );
}
