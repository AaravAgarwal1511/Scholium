import { PDFDocument } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import answerFontUrl from "dejavu-fonts-ttf/ttf/DejaVuSans.ttf?url";
import { ANSWER_FONT_FAMILY, createMetrics, type Metrics } from "./metrics";

/**
 * One font file, fetched once, handed to both the browser (as a `FontFace`) and
 * pdf-lib (as an embedded font). Sharing the bytes is what makes the exported PDF
 * wrap exactly where the editor wrapped: there is no second font to drift from.
 *
 * DejaVu Sans, chosen because it carries every glyph in the symbol palette —
 * Greek, arrows and math relations, none of which pdf-lib's built-in WinAnsi
 * fonts can render.
 */
let bytesPromise: Promise<ArrayBuffer> | null = null;

export function answerFontBytes(): Promise<ArrayBuffer> {
  bytesPromise ??= fetch(answerFontUrl).then((res) => {
    if (!res.ok) throw new Error(`Could not load the answer font (${res.status}).`);
    return res.arrayBuffer();
  });
  return bytesPromise;
}

let metricsPromise: Promise<Metrics> | null = null;

/** Registers the font with the browser and returns measurements for layout. */
export function answerMetrics(): Promise<Metrics> {
  metricsPromise ??= (async () => {
    const bytes = await answerFontBytes();

    // slice(0) clones: neither consumer may take ownership of the cached buffer.
    const face = new FontFace(ANSWER_FONT_FAMILY, bytes.slice(0));
    await face.load();
    document.fonts.add(face);

    // A throwaway document purely to obtain a PDFFont to measure with. The export
    // embeds the same bytes into the real document and measures the same way.
    const doc = await PDFDocument.create();
    doc.registerFontkit(fontkit);
    const font = await doc.embedFont(bytes.slice(0));

    return createMetrics(font);
  })();
  return metricsPromise;
}
