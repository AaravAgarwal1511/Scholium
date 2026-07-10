// Generates public/sample-paper.pdf — the paper the no-signup /demo route opens.
// Written from scratch rather than bundling a real exam board's paper, which we
// have no licence to redistribute. Run: node scripts/make-sample-paper.mjs
import { writeFileSync, mkdirSync } from "node:fs";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

const W = 595.276;
const H = 841.89;
const MARGIN = 56;

const QUESTIONS = [
  [
    ["1", "Define the term osmosis.", 2],
    ["2", "A student heats an enzyme solution to 65 °C and the reaction stops.\nExplain, in terms of protein structure, why the reaction stops.", 4],
    ["3", "State two variables that must be controlled in this investigation.", 2],
  ],
  [
    ["4 (a)", "Describe how you would test a leaf for the presence of starch.", 4],
    ["4 (b)", "Explain why the leaf must be boiled in ethanol during this test.", 3],
    ["5", "The rate of photosynthesis increases with light intensity, then plateaus.\nSuggest what limits the rate at the plateau.", 3],
  ],
  [
    ["6", "Compare aerobic and anaerobic respiration in muscle cells.", 6],
    ["7", "Evaluate the use of antibiotics in intensive farming.", 6],
  ],
];

const doc = await PDFDocument.create();
const font = await doc.embedFont(StandardFonts.Helvetica);
const bold = await doc.embedFont(StandardFonts.HelveticaBold);

QUESTIONS.forEach((questions, pageIndex) => {
  const page = doc.addPage([W, H]);
  let y = H - MARGIN;

  if (pageIndex === 0) {
    page.drawText("Mock Space", { x: MARGIN, y: y - 14, size: 18, font: bold, color: rgb(0.1, 0.1, 0.15) });
    page.drawText("Sample Paper - Biology", { x: MARGIN, y: y - 32, size: 11, font, color: rgb(0.4, 0.4, 0.45) });
    page.drawText("Answer all questions. 45 minutes. 30 marks.", { x: MARGIN, y: y - 48, size: 9, font, color: rgb(0.5, 0.5, 0.55) });
    page.drawLine({
      start: { x: MARGIN, y: y - 60 },
      end: { x: W - MARGIN, y: y - 60 },
      thickness: 0.75,
      color: rgb(0.8, 0.8, 0.85),
    });
    y -= 86;
  }

  for (const [number, prompt, marks] of questions) {
    page.drawText(number, { x: MARGIN, y: y - 10, size: 10, font: bold, color: rgb(0.1, 0.1, 0.15) });

    for (const line of prompt.split("\n")) {
      page.drawText(line, { x: MARGIN + 48, y: y - 10, size: 10, font, color: rgb(0.15, 0.15, 0.2) });
      y -= 15;
    }

    const label = `[${marks}]`;
    page.drawText(label, {
      x: W - MARGIN - bold.widthOfTextAtSize(label, 9),
      y: y + 5,
      size: 9,
      font: bold,
      color: rgb(0.45, 0.45, 0.5),
    });

    // Ruled answer space, sized to the marks — where the student drops a text box.
    y -= 10;
    for (let i = 0; i < marks; i++) {
      page.drawLine({
        start: { x: MARGIN + 48, y },
        end: { x: W - MARGIN, y },
        thickness: 0.4,
        color: rgb(0.85, 0.85, 0.88),
      });
      y -= 22;
    }
    y -= 14;
  }

  const footer = `Page ${pageIndex + 1} of ${QUESTIONS.length}`;
  page.drawText(footer, {
    x: (W - font.widthOfTextAtSize(footer, 8)) / 2,
    y: 32,
    size: 8,
    font,
    color: rgb(0.6, 0.6, 0.65),
  });
});

mkdirSync("public", { recursive: true });
writeFileSync("public/sample-paper.pdf", await doc.save());
console.log("wrote public/sample-paper.pdf");
