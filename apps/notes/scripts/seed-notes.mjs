// Seed the LOCAL `notes` Storage bucket with a few sample PDFs, so `pnpm dev`
// has something to list without hand-uploading files through the dashboard.
//
//   pnpm seed:notes --filter=notes      # or: node scripts/seed-notes.mjs
//
// Local-stack only. Refuses to run unless the target is 127.0.0.1 / localhost —
// there is no ingestion path to production by design (see CLAUDE.md): prod notes
// are uploaded by hand in the Supabase dashboard.
//
// The service-role key below is the Supabase CLI's fixed local demo value —
// identical on every machine, published in Supabase's own docs, and useless
// without also holding a shell on this machine's Docker containers. It is needed
// because the bucket has no INSERT policy; only the service role can write.

const SUPABASE_URL = process.env.VITE_SUPABASE_URL ?? "http://127.0.0.1:54321";
const SERVICE_ROLE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ??
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU";
const BUCKET = "notes";

const host = new URL(SUPABASE_URL).hostname;
if (host !== "127.0.0.1" && host !== "localhost") {
  console.error(`Refusing to seed a non-local target (${SUPABASE_URL}).`);
  console.error("Production notes are uploaded by hand in the Supabase dashboard.");
  process.exit(1);
}

// A minimal but genuinely valid single-page PDF: title + body lines in Helvetica,
// with a byte-accurate xref table. Kept ASCII so string length == byte length.
function makePdf(title, lines) {
  const esc = (s) => s.replace(/([\\()])/g, "\\$1");
  let content = "BT\n/F1 20 Tf\n72 720 Td\n";
  content += `(${esc(title)}) Tj\n/F1 12 Tf\n`;
  for (const line of lines) content += `0 -24 TD\n(${esc(line)}) Tj\n`;
  content += "ET";

  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] " +
      "/Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>",
    `<< /Length ${content.length} >>\nstream\n${content}\nendstream`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
  ];

  let pdf = "%PDF-1.4\n";
  const offsets = [];
  objects.forEach((body, i) => {
    offsets.push(pdf.length);
    pdf += `${i + 1} 0 obj\n${body}\nendobj\n`;
  });

  const xrefStart = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const off of offsets) pdf += `${String(off).padStart(10, "0")} 00000 n \n`;
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF\n`;

  return Buffer.from(pdf, "latin1");
}

// File name drives title + order in the app (see src/lib/notes.ts): a leading
// "n-" sets the sort position, the rest becomes the title. The last one is
// deliberately unnumbered, to exercise that branch.
const NOTES = [
  {
    name: "1-Electricity-and-Magnetism.pdf",
    title: "Electricity and Magnetism",
    lines: [
      "Sample note seeded by scripts/seed-notes.mjs.",
      "Current is the rate of flow of charge: I = Q / t.",
      "A magnetic field circles a current-carrying wire (right-hand grip rule).",
    ],
  },
  {
    name: "2-Kinematics.pdf",
    title: "Kinematics",
    lines: [
      "Sample note seeded by scripts/seed-notes.mjs.",
      "v = u + a t",
      "s = u t + 1/2 a t^2",
    ],
  },
  {
    name: "3-Waves-and-Sound.pdf",
    title: "Waves and Sound",
    lines: [
      "Sample note seeded by scripts/seed-notes.mjs.",
      "Wave speed: v = f * lambda.",
      "Sound needs a medium; light does not.",
    ],
  },
  {
    name: "Reference-tables.pdf",
    title: "Reference tables",
    lines: [
      "Sample note seeded by scripts/seed-notes.mjs.",
      "No number prefix, so this one sorts after the numbered notes.",
    ],
  },
];

let ok = 0;
for (const note of NOTES) {
  const res = await fetch(
    `${SUPABASE_URL}/storage/v1/object/${BUCKET}/${encodeURIComponent(note.name)}`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
        "Content-Type": "application/pdf",
        "x-upsert": "true",
      },
      body: makePdf(note.title, note.lines),
    },
  );
  if (res.ok) {
    console.log(`  ✓ ${note.name}`);
    ok += 1;
  } else {
    console.error(`  ✗ ${note.name} — ${res.status} ${await res.text()}`);
  }
}

console.log(`\nSeeded ${ok}/${NOTES.length} notes into the local "${BUCKET}" bucket.`);
process.exit(ok === NOTES.length ? 0 : 1);
