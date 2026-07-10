import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { beforeAll, describe, expect, it } from "vitest";
import { PDFDocument } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import { createMetrics, type Metrics } from "./metrics";
import { layoutText } from "./textLayout";
import { exportAttempt } from "./exportPdf";
import { appendText, createBox, strikeRange, type AnswerBox, type Attempt } from "./model";

const require = createRequire(import.meta.url);
const TTF = readFileSync(require.resolve("dejavu-fonts-ttf/ttf/DejaVuSans.ttf"));
const SAMPLE = readFileSync(new URL("../../public/sample-paper.pdf", import.meta.url));

const toArrayBuffer = (b: Buffer): ArrayBuffer =>
  b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) as ArrayBuffer;

const A4 = { widthPt: 595.276, heightPt: 841.89 };

let metrics: Metrics;

beforeAll(async () => {
  const doc = await PDFDocument.create();
  doc.registerFontkit(fontkit);
  metrics = createMetrics(await doc.embedFont(TTF, { subset: true }));
});

function attemptWith(boxes: AnswerBox[]): Attempt {
  return {
    id: "a1",
    userId: null,
    title: "Sample",
    createdAt: 0,
    updatedAt: 0,
    pages: [A4, A4, A4],
    boxes,
    strokes: [],
    timer: { durationMs: 60_000, deadlineAt: null, remainingMs: 0, state: "expired" },
  };
}

const typed = (box: AnswerBox, text: string) => [...text].reduce(appendText, box);

async function exportOf(attempt: Attempt): Promise<Uint8Array> {
  return exportAttempt(attempt, toArrayBuffer(SAMPLE), toArrayBuffer(TTF));
}

/**
 * Reads the exported PDF back with pdf.js and groups text items into visual lines
 * by their baseline y. This is how a marker's PDF viewer sees the script.
 */
interface PlacedText {
  str: string;
  x: number;
  y: number;
}

/** Every text run on a page, with the baseline position the PDF actually gives it. */
async function textItemsOnPage(bytes: Uint8Array, pageNumber: number): Promise<PlacedText[]> {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const doc = await pdfjs.getDocument({
    data: new Uint8Array(bytes),
    useSystemFonts: false,
    isEvalSupported: false,
  }).promise;

  const page = await doc.getPage(pageNumber);
  const content = await page.getTextContent();

  return content.items
    .filter((i): i is Extract<typeof i, { str: string }> => "str" in i && i.str !== "")
    .map((i) => ({ str: i.str, x: i.transform[4], y: i.transform[5] }));
}

/** Groups runs into visual lines by baseline — how a marker's PDF viewer sees it. */
async function textLinesOnPage(bytes: Uint8Array, pageNumber: number): Promise<string[]> {
  const items = await textItemsOnPage(bytes, pageNumber);

  const byBaseline = new Map<number, PlacedText[]>();
  for (const item of items) {
    const key = Math.round(item.y * 10) / 10;
    const row = byBaseline.get(key) ?? [];
    row.push(item);
    byBaseline.set(key, row);
  }

  return [...byBaseline.entries()]
    .sort((a, b) => b[0] - a[0]) // top of the page first
    .map(([, row]) =>
      row
        .sort((a, b) => a.x - b.x)
        .map((i) => i.str)
        .join(""),
    );
}

const ANSWER =
  "Osmosis is the net movement of water molecules from a region of higher water " +
  "potential to a region of lower water potential across a partially permeable membrane.";

describe("exportAttempt", () => {
  it("leaves the original pages intact when nothing was written", async () => {
    const bytes = await exportOf(attemptWith([]));
    const doc = await PDFDocument.load(bytes);
    expect(doc.getPageCount()).toBe(3);
  });

  it("burns answers in as real, extractable text", async () => {
    const box = typed(createBox(0, 100, 640, 400), "the enzyme denatures");
    const lines = await textLinesOnPage(await exportOf(attemptWith([box])), 1);
    expect(lines.join("\n")).toContain("the enzyme denatures");
  });

  // Model space is top-origin; pdf-lib is bottom-origin. Get this wrong by a
  // baseline and every answer sits slightly off its ruled line; get it wrong by a
  // flip and answers land at the top of the page. Neither is visible in a diff.
  it("places text at the exact model coordinates, after the y-flip", async () => {
    const box = typed(createBox(0, 137, 402, 300), "anchor");
    const { baselineOffset } = layoutText(box.text, box.fontSizePt, box.wPt, metrics);

    const placed = await textItemsOnPage(await exportOf(attemptWith([box])), 1);
    const anchor = placed.find((i) => i.str === "anchor");

    expect(anchor).toBeDefined();
    expect(anchor!.x).toBeCloseTo(137, 3);
    expect(anchor!.y).toBeCloseTo(A4.heightPt - (402 + baselineOffset), 3);
  });

  // The central claim of the whole design.
  it("wraps in the PDF exactly where the editor wrapped", async () => {
    const box = typed(createBox(0, 80, 600, 300), ANSWER);
    const editorLines = layoutText(box.text, box.fontSizePt, box.wPt, metrics).lines.map((l) =>
      box.text.slice(l.start, l.end),
    );

    const pdfLines = await textLinesOnPage(await exportOf(attemptWith([box])), 1);
    // Only the lines that fit on page 1; the rest go to a continuation sheet.
    const answerLines = pdfLines.filter((l) => editorLines.some((e) => e.trim() === l.trim()));

    expect(answerLines.length).toBeGreaterThan(1);
    expect(editorLines.length).toBeGreaterThan(1);
    for (const line of answerLines) {
      expect(editorLines.map((l) => l.trim())).toContain(line.trim());
    }
  });

  it("splits struck text into separate runs but preserves the words", async () => {
    let box = typed(createBox(0, 100, 640, 400), "the mitochondira is the powerhouse");
    box = strikeRange(box, 4, 16); // "mitochondira"
    const lines = await textLinesOnPage(await exportOf(attemptWith([box])), 1);
    expect(lines.join("")).toContain("mitochondira");
    expect(lines.join("")).toContain("powerhouse");
  });

  it("appends a labelled continuation page when an answer outgrows the page", async () => {
    // Placed near the bottom, so almost everything overflows.
    const long = ANSWER + " " + ANSWER + " " + ANSWER;
    const box = typed(createBox(1, 80, 700, 300), long);

    const bytes = await exportOf(attemptWith([box]));
    const doc = await PDFDocument.load(bytes);
    expect(doc.getPageCount()).toBeGreaterThan(3);

    const continuation = await textLinesOnPage(bytes, 4);
    expect(continuation[0]).toMatch(/^Continuation of page 2, answer 1/);
  });

  it("marks the source page with where the answer continues", async () => {
    const long = ANSWER + " " + ANSWER + " " + ANSWER;
    const box = typed(createBox(1, 80, 700, 300), long);
    const lines = await textLinesOnPage(await exportOf(attemptWith([box])), 2);
    expect(lines.join("\n")).toMatch(/continues on page 4/);
  });

  it("numbers answers on a page in reading order", async () => {
    const long = ANSWER + " " + ANSWER + " " + ANSWER;
    const lower = typed(createBox(0, 80, 760, 300), long);
    const upper = typed(createBox(0, 80, 700, 300), long);

    const bytes = await exportOf(attemptWith([lower, upper]));
    const first = await textLinesOnPage(bytes, 4);
    expect(first[0]).toMatch(/answer 1/); // the upper box, despite being added second
  });

  it("refuses to export if the page geometry no longer matches", async () => {
    const attempt = attemptWith([typed(createBox(0, 100, 640, 400), "x")]);
    attempt.pages = [{ widthPt: 200, heightPt: 200 }, A4, A4];
    await expect(exportOf(attempt)).rejects.toThrow(/will not guess/);
  });

  it("exports freehand strokes as vectors", async () => {
    const attempt = attemptWith([]);
    attempt.strokes = [{ id: "s1", page: 0, points: [100, 100, 200, 150, 300, 120], widthPt: 1.5 }];
    const bytes = await exportOf(attempt);
    const doc = await PDFDocument.load(bytes);
    expect(doc.getPageCount()).toBe(3);
    // A vector path, not an image: no XObject images were added.
    expect(bytes.byteLength).toBeGreaterThan(SAMPLE.byteLength);
  });
});
