import { useEffect, useRef } from "react";
import type { PDFDocumentProxy } from "pdfjs-dist";
import { renderPage, type RenderHandle } from "@/lib/pdfRender";

interface Props {
  doc: PDFDocumentProxy;
  /** 1-based, as pdf.js numbers pages. */
  pageNumber: number;
  scale: number;
}

export default function PdfCanvas({ doc, pageNumber, scale }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    let disposed = false;
    let handle: RenderHandle | null = null;

    (async () => {
      const page = await doc.getPage(pageNumber);
      if (disposed || !canvasRef.current) return;

      handle = renderPage(page, canvasRef.current, scale);
      try {
        await handle.done;
      } catch {
        // pdf.js rejects with RenderingCancelledException when a zoom change
        // supersedes an in-flight render. That is the expected path, not an error.
      }
    })();

    return () => {
      disposed = true;
      handle?.cancel();
    };
  }, [doc, pageNumber, scale]);

  return <canvas ref={canvasRef} className="block" data-testid={`page-${pageNumber}`} />;
}
