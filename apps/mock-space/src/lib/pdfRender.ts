import {
  GlobalWorkerOptions,
  getDocument,
  type PDFDocumentProxy,
  type PDFPageProxy,
} from "pdfjs-dist";
import workerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";

// A URL rather than a shared `workerPort`: pdf.js then spins up a fresh worker per
// document, so destroying one attempt's document cannot tear down the next one's.
GlobalWorkerOptions.workerSrc = workerUrl;

/** A PDF whose geometry Mock Space refuses to guess at. */
export class UnsupportedPdfError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UnsupportedPdfError";
  }
}

export interface PageGeometry {
  widthPt: number;
  heightPt: number;
}

export interface LoadedPdf {
  doc: PDFDocumentProxy;
  pages: PageGeometry[];
}

/**
 * `bytes` must stay pristine: pdf.js *transfers* the buffer it is handed, leaving
 * the original detached, and the exporter needs to re-read the original PDF at the
 * end of the attempt. So we clone before handing it over. Losing this line makes
 * the export silently produce a zero-byte document.
 */
export async function loadPdf(bytes: ArrayBuffer): Promise<LoadedPdf> {
  const doc = await getDocument({ data: new Uint8Array(bytes.slice(0)) }).promise;

  const pages: PageGeometry[] = [];
  for (let n = 1; n <= doc.numPages; n++) {
    const page = await doc.getPage(n);
    pages.push(geometryOf(page, n));
  }
  return { doc, pages };
}

/**
 * Rejecting these two cases is a deliberate trade. Supporting them is not hard,
 * but silently placing a student's answers in the wrong part of the page is not an
 * acceptable failure mode for an exam tool, and both are rare in real past papers.
 */
function geometryOf(page: PDFPageProxy, pageNumber: number): PageGeometry {
  if (page.rotate % 360 !== 0) {
    throw new UnsupportedPdfError(
      `Page ${pageNumber} of this PDF is rotated ${page.rotate}°. Mock Space cannot place answers on rotated pages yet.`,
    );
  }

  const [x0, y0, x1, y1] = page.view;
  if (x0 !== 0 || y0 !== 0) {
    throw new UnsupportedPdfError(
      `Page ${pageNumber} of this PDF has an offset crop box. Mock Space cannot place answers on it yet.`,
    );
  }

  return { widthPt: x1 - x0, heightPt: y1 - y0 };
}

export interface RenderHandle {
  done: Promise<void>;
  cancel(): void;
}

/**
 * Renders `page` into `canvas` at `scale` CSS-pixels-per-model-point, backing the
 * canvas at device resolution so text stays crisp on retina displays.
 *
 * Returns a handle because pdf.js throws if two renders target one canvas at once,
 * which React's effect re-runs will happily attempt during a zoom change.
 */
export function renderPage(
  page: PDFPageProxy,
  canvas: HTMLCanvasElement,
  scale: number,
): RenderHandle {
  const dpr = window.devicePixelRatio || 1;
  const viewport = page.getViewport({ scale: scale * dpr });

  // Backing store at device resolution; CSS box back down to layout pixels.
  canvas.width = Math.floor(viewport.width);
  canvas.height = Math.floor(viewport.height);
  canvas.style.width = `${viewport.width / dpr}px`;
  canvas.style.height = `${viewport.height / dpr}px`;

  const task = page.render({ canvas, viewport });

  return {
    done: task.promise,
    cancel: () => task.cancel(),
  };
}
