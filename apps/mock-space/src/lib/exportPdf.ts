import { LineCapStyle, PDFDocument, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import { createMetrics } from "./metrics";
import { layoutText, segmentLine, widthOf, type TextLayout } from "./textLayout";
import { flipY } from "./coords";
import type { AnswerBox, Attempt, Stroke } from "./model";

/** Answers stop this far above the page edge; the rest spills to a continuation sheet. */
const BOTTOM_MARGIN_PT = 42;
const CONT_TOP_PT = 92;
const CONT_LEFT_PT = 56;
const CONT_HEADER_SIZE = 9;
const STRIKE_HEIGHT_RATIO = 0.3;
const STRIKE_THICKNESS_RATIO = 0.06;
const EPSILON = 0.5;

const INK = rgb(0, 0, 0);
const MUTED = rgb(0.45, 0.45, 0.5);

interface Overflow {
  box: AnswerBox;
  layout: TextLayout;
  /** Index of the first line that did not fit on the source page. */
  from: number;
  ordinal: number;
  /** 1-based continuation page number in the finished document. */
  continuesOn: number;
}

/**
 * Burns the attempt into a copy of the original PDF.
 *
 * Answers become real, selectable text rather than a rasterised overlay, and the
 * original page content is untouched. Line breaks come from the same `layoutText`
 * the editor rendered with, so the exported script wraps exactly where the student
 * saw it wrap.
 *
 * `fontBytes` is passed in rather than fetched here: the caller already holds the
 * bytes the editor measured with, and injecting them keeps this whole function
 * runnable outside a browser, where its fidelity is tested.
 */
export async function exportAttempt(
  attempt: Attempt,
  pdfBytes: ArrayBuffer,
  fontBytes: ArrayBuffer,
): Promise<Uint8Array> {
  const out = await PDFDocument.load(pdfBytes.slice(0));
  out.registerFontkit(fontkit);

  const font = await out.embedFont(fontBytes.slice(0), { subset: true });
  const metrics = createMetrics(font);

  attempt.pages.forEach((geometry, i) => assertPageGeometry(out.getPage(i), i, geometry));

  const ordinals = ordinalsByPage(attempt.boxes);
  const overflows: Overflow[] = [];

  // Pass 1: draw what fits, and work out how many continuation pages we will need
  // so the "continues on page N" markers can be numbered before we add them.
  //
  // Reading order, not creation order: continuation sheets are appended in the
  // order this loop meets them, and a marker turning to the back of the script
  // expects answer 1's overflow before answer 2's.
  let nextContinuationPage = out.getPageCount() + 1;

  for (const box of readingOrder(attempt.boxes)) {
    if (box.text.length === 0) continue;

    const page = out.getPage(box.page);
    const pageHeightPt = page.getSize().height;
    const layout = layoutText(box.text, box.fontSizePt, box.wPt, metrics);
    const limitPt = pageHeightPt - BOTTOM_MARGIN_PT;

    let drawn = 0;
    for (let i = 0; i < layout.lines.length; i++) {
      const topPt = box.yPt + i * layout.lineHeight;
      if (topPt + layout.lineHeight > limitPt) break;
      drawLine(page, box, layout, i, box.xPt, topPt, pageHeightPt, font);
      drawn = i + 1;
    }

    if (drawn < layout.lines.length) {
      const overflow: Overflow = {
        box,
        layout,
        from: drawn,
        ordinal: ordinals.get(box.id) ?? 1,
        continuesOn: nextContinuationPage,
      };
      overflows.push(overflow);

      const remaining = layout.lines.length - drawn;
      const perPage = linesPerContinuationPage(pageHeightPt, layout.lineHeight);
      nextContinuationPage += Math.max(1, Math.ceil(remaining / perPage));

      page.drawText(`↳ continues on page ${overflow.continuesOn}`, {
        x: box.xPt,
        y: flipY(limitPt + CONT_HEADER_SIZE, pageHeightPt),
        size: CONT_HEADER_SIZE,
        font,
        color: MUTED,
      });
    }
  }

  for (const stroke of attempt.strokes) {
    drawStroke(out.getPage(stroke.page), stroke);
  }

  // Pass 2: the continuation sheets, in the order their markers promised.
  for (const overflow of overflows) {
    drawContinuation(out, overflow, font, attempt.pages[overflow.box.page].heightPt);
  }

  return out.save();
}

function linesPerContinuationPage(pageHeightPt: number, lineHeight: number): number {
  return Math.max(1, Math.floor((pageHeightPt - CONT_TOP_PT - BOTTOM_MARGIN_PT) / lineHeight));
}

function drawContinuation(
  out: PDFDocument,
  { box, layout, from, ordinal }: Overflow,
  font: PDFFont,
  pageHeightPt: number,
): void {
  const source = out.getPage(box.page);
  const { width } = source.getSize();
  const perPage = linesPerContinuationPage(pageHeightPt, layout.lineHeight);

  let cursor = from;
  let sheet = 0;

  while (cursor < layout.lines.length) {
    const page = out.addPage([width, pageHeightPt]);

    const heading =
      sheet === 0
        ? `Continuation of page ${box.page + 1}, answer ${ordinal}`
        : `Continuation of page ${box.page + 1}, answer ${ordinal} (cont.)`;

    page.drawText(heading, {
      x: CONT_LEFT_PT,
      y: flipY(52, pageHeightPt),
      size: CONT_HEADER_SIZE + 1,
      font,
      color: MUTED,
    });
    page.drawLine({
      start: { x: CONT_LEFT_PT, y: flipY(64, pageHeightPt) },
      end: { x: width - CONT_LEFT_PT, y: flipY(64, pageHeightPt) },
      thickness: 0.5,
      color: rgb(0.8, 0.8, 0.85),
    });

    const end = Math.min(layout.lines.length, cursor + perPage);
    for (let i = cursor; i < end; i++) {
      const topPt = CONT_TOP_PT + (i - cursor) * layout.lineHeight;
      drawLine(page, box, layout, i, CONT_LEFT_PT, topPt, pageHeightPt, font);
    }

    cursor = end;
    sheet += 1;
  }
}

/** Draws one wrapped line, with a rule through any struck runs. */
function drawLine(
  page: PDFPage,
  box: AnswerBox,
  layout: TextLayout,
  lineIndex: number,
  originXPt: number,
  topPt: number,
  pageHeightPt: number,
  font: PDFFont,
): void {
  const line = layout.lines[lineIndex];
  if (line.end <= line.start) return;

  const size = box.fontSizePt;
  const baselineY = flipY(topPt + layout.baselineOffset, pageHeightPt);

  for (const run of segmentLine(line, box.struck)) {
    const x = originXPt + widthOf(layout.prefix, line.start, run.start);
    const text = box.text.slice(run.start, run.end);

    page.drawText(text, { x, y: baselineY, size, font, color: INK });

    if (run.struck) {
      const y = baselineY + size * STRIKE_HEIGHT_RATIO;
      page.drawLine({
        start: { x, y },
        end: { x: x + widthOf(layout.prefix, run.start, run.end), y },
        thickness: Math.max(0.5, size * STRIKE_THICKNESS_RATIO),
        color: INK,
      });
    }
  }
}

/**
 * pdf-lib's `drawSvgPath` anchors the path at `(x, y)` and flips the y-axis, so
 * anchoring at the page's top-left maps SVG coordinates straight onto model space.
 * Strokes therefore export as vectors with no conversion at all.
 */
function drawStroke(page: PDFPage, stroke: Stroke): void {
  if (stroke.points.length < 4) return;

  const parts: string[] = [`M ${stroke.points[0]} ${stroke.points[1]}`];
  for (let i = 2; i < stroke.points.length; i += 2) {
    parts.push(`L ${stroke.points[i]} ${stroke.points[i + 1]}`);
  }

  page.drawSvgPath(parts.join(" "), {
    x: 0,
    y: page.getSize().height,
    borderColor: INK,
    borderWidth: stroke.widthPt,
    borderLineCap: LineCapStyle.Round,
  });
}

/**
 * The editor measured pages with pdf.js (crop box) while the exporter draws against
 * pdf-lib (media box). They agree for every ordinary PDF, and `loadPdf` already
 * refuses offset crop boxes — but if they ever disagree, every answer on the page
 * lands in the wrong place. Fail loudly instead.
 */
function assertPageGeometry(
  page: PDFPage,
  index: number,
  expected: { widthPt: number; heightPt: number },
): void {
  const media = page.getMediaBox();
  const crop = page.getCropBox();

  const consistent =
    Math.abs(media.x) < EPSILON &&
    Math.abs(media.y) < EPSILON &&
    Math.abs(crop.x) < EPSILON &&
    Math.abs(crop.y) < EPSILON &&
    Math.abs(crop.width - expected.widthPt) < EPSILON &&
    Math.abs(crop.height - expected.heightPt) < EPSILON;

  if (!consistent) {
    throw new Error(
      `Page ${index + 1} moved between opening and export. Mock Space will not guess where your answers belong.`,
    );
  }
}

/** Down the page, then across — the order a marker reads answers in. */
function readingOrder(boxes: AnswerBox[]): AnswerBox[] {
  return boxes.slice().sort((a, b) => a.page - b.page || a.yPt - b.yPt || a.xPt - b.xPt);
}

/** Stable "answer 1, answer 2…" numbering within each source page. */
function ordinalsByPage(boxes: AnswerBox[]): Map<string, number> {
  const seenOnPage = new Map<number, number>();
  const ordinals = new Map<string, number>();

  for (const box of readingOrder(boxes)) {
    const next = (seenOnPage.get(box.page) ?? 0) + 1;
    seenOnPage.set(box.page, next);
    ordinals.set(box.id, next);
  }
  return ordinals;
}

/** Hands the finished script to the browser as a download. */
export function downloadPdf(bytes: Uint8Array, filename: string): void {
  const blob = new Blob([bytes as BlobPart], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
