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

// ─────────────────────────────────────────────────────────────────────────
// public/sample-mcq-paper.pdf — what /demo/mcq opens. Every question is
// drawn as a FIXED-HEIGHT block (stem + 4 options), so its crop band is
// plain arithmetic — this is a plain script, run standalone, not something
// Demo.tsx can import, so MCQ_HEADER_H/MCQ_BLOCK_H/MCQ_GAP and the question
// list are duplicated by value in Demo.tsx (same pattern as
// PAPER_RETENTION_DAYS in api/prune-papers.js) and MUST stay in step with
// the numbers here. This mirrors what a real composed MCQ paper's Questions
// section looks like (stem + printed A–D options); the answer key a real
// paper gets from its mark scheme is, here, simply known up front.

const MCQ_HEADER_H = 70;
const MCQ_BLOCK_H = 110;
const MCQ_GAP = 10;

const MCQ_QUESTIONS = [
  {
    stem: "What is the SI unit of electric current?",
    options: ["Volt", "Ampere", "Ohm", "Watt"],
    answer: "B",
  },
  {
    stem: "Which organelle is the site of aerobic respiration in a cell?",
    options: ["Nucleus", "Ribosome", "Mitochondrion", "Golgi body"],
    answer: "C",
  },
  {
    stem: "Which gas is most abundant in Earth's atmosphere?",
    options: ["Nitrogen", "Oxygen", "Carbon dioxide", "Argon"],
    answer: "A",
  },
  {
    stem: "What is the chemical formula for table salt?",
    options: ["CaCO3", "KCl", "CO2", "NaCl"],
    answer: "D",
  },
  {
    stem: "Which planet is known as the Red Planet?",
    options: ["Venus", "Mars", "Jupiter", "Saturn"],
    answer: "B",
  },
];

const mcqDoc = await PDFDocument.create();
const mcqFont = await mcqDoc.embedFont(StandardFonts.Helvetica);
const mcqBold = await mcqDoc.embedFont(StandardFonts.HelveticaBold);
const mcqPage = mcqDoc.addPage([W, H]);

{
  let y = H - MARGIN;
  mcqPage.drawText("Mock Space", { x: MARGIN, y: y - 14, size: 18, font: mcqBold, color: rgb(0.1, 0.1, 0.15) });
  mcqPage.drawText("Sample Paper - Multiple Choice", { x: MARGIN, y: y - 32, size: 11, font: mcqFont, color: rgb(0.4, 0.4, 0.45) });
  mcqPage.drawText("Answer all questions. 5 minutes.", { x: MARGIN, y: y - 48, size: 9, font: mcqFont, color: rgb(0.5, 0.5, 0.55) });
  mcqPage.drawLine({
    start: { x: MARGIN, y: y - 60 },
    end: { x: W - MARGIN, y: y - 60 },
    thickness: 0.75,
    color: rgb(0.8, 0.8, 0.85),
  });
}

MCQ_QUESTIONS.forEach((q, i) => {
  const blockTop = H - MARGIN - MCQ_HEADER_H - i * (MCQ_BLOCK_H + MCQ_GAP);
  let y = blockTop - 16;

  mcqPage.drawText(`${i + 1}. ${q.stem}`, { x: MARGIN, y, size: 10, font: mcqBold, color: rgb(0.1, 0.1, 0.15) });
  y -= 18;

  ["A", "B", "C", "D"].forEach((letter, j) => {
    mcqPage.drawText(`${letter}.  ${q.options[j]}`, {
      x: MARGIN + 12,
      y,
      size: 10,
      font: mcqFont,
      color: rgb(0.15, 0.15, 0.2),
    });
    y -= 16;
  });
});

writeFileSync("public/sample-mcq-paper.pdf", await mcqDoc.save());
console.log("wrote public/sample-mcq-paper.pdf");
