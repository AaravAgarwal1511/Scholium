#!/usr/bin/env node

/**
 * Generates real, static, crawlable HTML for every subject and component this
 * app offers — apps/past-papers/public/papers/<code>/index.html and
 * .../<code>/<component-slug>/index.html — plus public/sitemap.xml.
 *
 * Why: the interactive tool at `/` holds subject/component/chapter selection
 * in React state with no URL, so none of that content was ever indexable.
 * These pages give the same content (subject → component → chapter list) a
 * real, unique, crawlable URL and description, with a CTA back into the tool.
 *
 * Runs before `vite build` (see package.json's `build` script) and writes
 * into public/, so Vite's existing verbatim-copy of public/ (the same
 * mechanism that already ships favicon.svg) carries the generated pages into
 * dist/ with no new build-plugin dependency.
 *
 * Reads the same anon-readable `paper_files` table src/lib/papers.ts queries
 * from the browser — no service-role key needed, safe to run in Vercel's
 * build environment using the same VITE_SUPABASE_URL /
 * VITE_SUPABASE_PUBLISHABLE_KEY already required for the client bundle.
 *
 * These pages deliberately do NOT ship the SPA's JS bundle. If they did, the
 * app's `*` catch-all route (src/App.tsx) would `Navigate` to `/` on load and
 * wipe the static content — the whole point of a crawlable page is defeated
 * if a crawler that doesn't execute JS is the only one who ever sees it, and
 * a crawler that DOES execute JS would see it disappear anyway. Script-free
 * also means no `App.tsx` route changes were needed for these to exist.
 *
 * SUBJECT_DISPLAY_NAMES / parseFileName / paperNumOf below are intentionally
 * duplicated from src/lib/papers.ts rather than imported — this is a plain
 * Node ESM script, papers.ts is TypeScript with a browser-coupled Supabase
 * client import at module scope, and this repo has no TS-in-Node execution
 * path (no tsx/ts-node dependency anywhere). Kept in sync by
 * src/lib/paperCatalogSync.test.ts, which imports both and asserts they
 * agree — the same pattern apps/mock-space/src/lib/paperRetention.test.ts
 * already uses to guard api/prune-papers.js's duplicated constants.
 *
 * A failure here (missing env, a Supabase hiccup, zero rows) logs a warning
 * and exits 0 rather than failing the build: these are bonus SEO pages, not
 * the product itself, and a transient data-fetch issue during a Vercel build
 * should not take the interactive tool down along with them.
 */

import { createClient } from "@supabase/supabase-js";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

try {
  process.loadEnvFile();
} catch {
  // No local .env — fine when Vercel injects env vars directly.
}

const SITE_URL = "https://pastpapers.thescholium.com";
const HOME_URL = "https://www.thescholium.com";
const PUBLIC_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "public");

// ---- duplicated from src/lib/papers.ts — see the sync test noted above ----

export const SUBJECT_DISPLAY_NAMES = {
  "0455": "Economics",
  "0478": "Computer Science",
  "0606": "Additional Mathematics",
  "0607": "International Mathematics",
  "0610": "Biology",
  "0620": "Chemistry",
  "0625": "Physics",
};

export const DISABLED_SUBJECTS = new Set([]);

export function subjectDisplayName(code) {
  return SUBJECT_DISPLAY_NAMES[code] ?? code;
}

export function isSubjectDisabled(code) {
  return DISABLED_SUBJECTS.has(code);
}

// Filename convention: {n}-{name}-{QP|MS}.pdf ("name" may itself contain hyphens).
export function parseFileName(fileName) {
  if (!fileName.toLowerCase().endsWith(".pdf")) return null;
  const stem = fileName.slice(0, -4);

  const lastDash = stem.lastIndexOf("-");
  if (lastDash === -1) return null;
  const typeRaw = stem.slice(lastDash + 1).toUpperCase();
  if (typeRaw !== "QP" && typeRaw !== "MS") return null;

  const rest = stem.slice(0, lastDash);
  const firstDash = rest.indexOf("-");
  if (firstDash === -1) return null;

  const numberRaw = rest.slice(0, firstDash);
  const number = Number(numberRaw);
  if (!Number.isFinite(number)) return null;

  const rawName = rest.slice(firstDash + 1).trim();
  if (!rawName) return null;
  const chapterName = rawName.replace(/-+/g, " ").replace(/\s+/g, " ").trim();

  return { chapterNumber: number, chapterName, type: typeRaw, fileName };
}

// Component label "Paper 2" → 2, used only to sort components numerically
// (alphabetical sort would put "Paper 10" before "Paper 2").
export function paperNumOf(component) {
  const m = component.match(/(\d+)/);
  return m ? parseInt(m[1], 10) : 0;
}

// ---- helpers specific to this script ----

export function slugify(raw) {
  return (
    raw
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "component"
  );
}

export function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// Group a flat file-name list into distinct, sorted {number, name} chapters.
// Mirrors buildChapters() in src/lib/papers.ts, minus the QP/MS file objects
// this script has no use for — it only needs the chapter number and name.
export function groupChapters(fileNames) {
  const byNumber = new Map();
  for (const name of fileNames) {
    const parsed = parseFileName(name);
    if (!parsed) continue;
    const existing = byNumber.get(parsed.chapterNumber);
    // Prefer the QP-derived name when both exist, matching papers.ts.
    if (!existing || parsed.type === "QP") {
      byNumber.set(parsed.chapterNumber, { number: parsed.chapterNumber, name: parsed.chapterName });
    }
  }
  return Array.from(byNumber.values()).sort((a, b) => a.number - b.number);
}

// ---- HTML rendering ----

function pageShell({ title, description, canonical, jsonLd, bodyHtml }) {
  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta name="description" content="${escapeHtml(description)}" />
    <meta name="theme-color" content="hsl(0, 0%, 6%)" />
    <link rel="canonical" href="${canonical}" />
    <meta property="og:type" content="website" />
    <meta property="og:title" content="${escapeHtml(title)}" />
    <meta property="og:description" content="${escapeHtml(description)}" />
    <meta property="og:url" content="${canonical}" />
    <meta name="twitter:card" content="summary" />
    <meta name="twitter:title" content="${escapeHtml(title)}" />
    <meta name="twitter:description" content="${escapeHtml(description)}" />
    <link rel="stylesheet" href="/papers/papers.css" />
    <title>${escapeHtml(title)}</title>
    <script type="application/ld+json">${JSON.stringify(jsonLd)}</script>
  </head>
  <body>
    <header class="pp-header">
      <a class="pp-brand" href="/">Scholium <span>Past Papers</span></a>
      <nav class="pp-header-links" aria-label="Account">
        <a href="/signin">Sign in</a>
        <a class="pp-btn pp-btn-primary" href="/signup">Join now</a>
      </nav>
    </header>
    <main class="pp-main">
${bodyHtml}
    </main>
    <footer class="pp-footer">
      <p class="pp-footer-copy">&copy; ${new Date().getFullYear()} Scholium. All rights reserved.</p>
      <nav class="pp-footer-links" aria-label="Footer">
        <a href="${HOME_URL}/about">About</a>
        <a href="/terms">Terms of Service</a>
        <a href="/privacy">Privacy Policy</a>
      </nav>
    </footer>
  </body>
</html>
`;
}

function breadcrumbJsonLd(items) {
  return {
    "@type": "BreadcrumbList",
    itemListElement: items.map(([name, url], i) => ({
      "@type": "ListItem",
      position: i + 1,
      name,
      item: url,
    })),
  };
}

function renderSubjectPage(subject) {
  const { code, displayName, components } = subject;
  const canonical = `${SITE_URL}/papers/${code}`;
  const title = `IGCSE ${displayName} (${code}) — Topical Past Papers & Mark Schemes`;
  const totalChapters = components.reduce((n, c) => n + c.chapters.length, 0);
  const componentNames = components.map((c) => c.raw).join(", ");
  const description = `Topical IGCSE ${displayName} (${code}) past papers and mark schemes, organised by component and chapter. Covers ${componentNames} — ${totalChapters} chapters in total.`;

  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      breadcrumbJsonLd([
        ["Past Papers", `${SITE_URL}/`],
        [displayName, canonical],
      ]),
      {
        "@type": "CollectionPage",
        "@id": `${canonical}#page`,
        url: canonical,
        name: title,
        description,
        isPartOf: { "@id": `${SITE_URL}/#webapplication` },
      },
    ],
  };

  const componentItems = components
    .map(
      (c) => `        <li>
          <a href="/papers/${code}/${c.slug}"><strong>${escapeHtml(c.raw)}</strong></a>
          — ${c.chapters.length} chapter${c.chapters.length === 1 ? "" : "s"}
        </li>`,
    )
    .join("\n");

  const bodyHtml = `      <nav class="pp-breadcrumb" aria-label="Breadcrumb">
        <a href="/">Past Papers</a> <span aria-hidden="true">›</span> ${escapeHtml(displayName)}
      </nav>
      <h1>IGCSE ${escapeHtml(displayName)} (${code}) — Topical Past Papers &amp; Mark Schemes</h1>
      <p class="pp-intro">
        Practice IGCSE ${escapeHtml(displayName)} (${code}) using real past-paper questions grouped by
        topic. ${components.length} component${components.length === 1 ? "" : "s"} —
        ${escapeHtml(componentNames)} — covering ${totalChapters} chapters in total. Pick a component
        below to see its full topic list, or generate a custom practice set with mark schemes now.
      </p>
      <ul class="pp-component-list">
${componentItems}
      </ul>
      <a class="pp-btn pp-btn-primary pp-cta" href="/?subject=${code}">
        Generate a custom ${escapeHtml(displayName)} practice paper →
      </a>`;

  return pageShell({ title, description, canonical, jsonLd, bodyHtml });
}

function renderComponentPage(subject, component) {
  const { code, displayName } = subject;
  const canonical = `${SITE_URL}/papers/${code}/${component.slug}`;
  const title = `IGCSE ${displayName} (${code}) ${component.raw} — Topical Past Papers by Chapter`;
  const chapterNames = component.chapters.map((c) => c.name).join(", ");
  const description = `Chapter-by-chapter topical past papers and mark schemes for IGCSE ${displayName} (${code}) ${component.raw}: ${chapterNames}.`;

  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      breadcrumbJsonLd([
        ["Past Papers", `${SITE_URL}/`],
        [displayName, `${SITE_URL}/papers/${code}`],
        [component.raw, canonical],
      ]),
      {
        "@type": "CollectionPage",
        "@id": `${canonical}#page`,
        url: canonical,
        name: title,
        description,
        isPartOf: { "@id": `${SITE_URL}/#webapplication` },
      },
    ],
  };

  const chapterItems = component.chapters
    .map((c) => `        <li>${c.number}. ${escapeHtml(c.name)}</li>`)
    .join("\n");

  const bodyHtml = `      <nav class="pp-breadcrumb" aria-label="Breadcrumb">
        <a href="/">Past Papers</a> <span aria-hidden="true">›</span>
        <a href="/papers/${code}">${escapeHtml(displayName)}</a> <span aria-hidden="true">›</span>
        ${escapeHtml(component.raw)}
      </nav>
      <h1>IGCSE ${escapeHtml(displayName)} (${code}) ${escapeHtml(component.raw)} — Topical Past Papers by Chapter</h1>
      <p class="pp-intro">
        This component covers ${component.chapters.length} topic${component.chapters.length === 1 ? "" : "s"},
        drawn from real IGCSE past-paper questions grouped by chapter. Generate a custom practice set
        across any combination below, with mark schemes included.
      </p>
      <ol class="pp-chapter-list">
${chapterItems}
      </ol>
      <a class="pp-btn pp-btn-primary pp-cta" href="/?subject=${code}">
        Generate a custom ${escapeHtml(displayName)} practice paper →
      </a>`;

  return pageShell({ title, description, canonical, jsonLd, bodyHtml });
}

function renderSitemap(subjects) {
  const urls = [
    { loc: `${SITE_URL}/`, lastmod: "2026-08-19" },
    { loc: `${SITE_URL}/terms`, lastmod: "2026-07-24" },
    { loc: `${SITE_URL}/privacy`, lastmod: "2026-07-24" },
  ];
  for (const subject of subjects) {
    urls.push({ loc: `${SITE_URL}/papers/${subject.code}` });
    for (const component of subject.components) {
      urls.push({ loc: `${SITE_URL}/papers/${subject.code}/${component.slug}` });
    }
  }
  const body = urls
    .map((u) => `  <url>\n    <loc>${u.loc}</loc>${u.lastmod ? `\n    <lastmod>${u.lastmod}</lastmod>` : ""}\n  </url>`)
    .join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${body}\n</urlset>\n`;
}

// ---- data assembly ----

// Groups raw {subject, component, file_name} rows into the subject →
// component → chapter tree the page renderers above expect. Exported so the
// sync test can exercise it directly against fixture rows.
export function buildCatalog(rows) {
  const bySubject = new Map();
  for (const row of rows) {
    if (isSubjectDisabled(row.subject)) continue;
    let subject = bySubject.get(row.subject);
    if (!subject) {
      subject = { code: row.subject, displayName: subjectDisplayName(row.subject), componentsByRaw: new Map() };
      bySubject.set(row.subject, subject);
    }
    let component = subject.componentsByRaw.get(row.component);
    if (!component) {
      component = { raw: row.component, fileNames: [] };
      subject.componentsByRaw.set(row.component, component);
    }
    component.fileNames.push(row.file_name);
  }

  const subjects = [];
  for (const subject of bySubject.values()) {
    const seenSlugs = new Set();
    const components = Array.from(subject.componentsByRaw.values())
      .map((c) => {
        let slug = slugify(c.raw);
        while (seenSlugs.has(slug)) slug = `${slug}-2`; // defensive; "Paper N" labels don't collide in practice
        seenSlugs.add(slug);
        return { raw: c.raw, slug, chapters: groupChapters(c.fileNames) };
      })
      .filter((c) => c.chapters.length > 0)
      .sort((a, b) => paperNumOf(a.raw) - paperNumOf(b.raw));
    if (components.length > 0) {
      subjects.push({ code: subject.code, displayName: subject.displayName, components });
    }
  }
  return subjects.sort((a, b) => a.code.localeCompare(b.code));
}

// ---- entry point ----

async function main() {
  const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
  const SUPABASE_KEY = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;

  if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.warn("⚠️  build-subject-pages: VITE_SUPABASE_URL / VITE_SUPABASE_PUBLISHABLE_KEY not set — skipping (build continues).");
    return;
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: false } });
  const { data, error } = await supabase.from("paper_files").select("subject, component, file_name");

  if (error) {
    console.warn(`⚠️  build-subject-pages: paper_files query failed (${error.message}) — skipping (build continues).`);
    return;
  }
  if (!data || data.length === 0) {
    console.warn("⚠️  build-subject-pages: paper_files returned 0 rows — skipping (build continues).");
    return;
  }

  const subjects = buildCatalog(data);
  if (subjects.length === 0) {
    console.warn("⚠️  build-subject-pages: no subject had any indexable chapters — skipping (build continues).");
    return;
  }

  let pageCount = 0;
  for (const subject of subjects) {
    const subjectDir = path.join(PUBLIC_DIR, "papers", subject.code);
    mkdirSync(subjectDir, { recursive: true });
    writeFileSync(path.join(subjectDir, "index.html"), renderSubjectPage(subject));
    pageCount++;

    for (const component of subject.components) {
      const componentDir = path.join(subjectDir, component.slug);
      mkdirSync(componentDir, { recursive: true });
      writeFileSync(path.join(componentDir, "index.html"), renderComponentPage(subject, component));
      pageCount++;
    }
  }

  writeFileSync(path.join(PUBLIC_DIR, "sitemap.xml"), renderSitemap(subjects));

  console.log(`✅ build-subject-pages: wrote ${pageCount} static page(s) across ${subjects.length} subject(s), and sitemap.xml.`);
}

const isMain = import.meta.url === `file://${process.argv[1]}`;
if (isMain) {
  main().catch((err) => {
    console.warn(`⚠️  build-subject-pages: unexpected error (${err.message}) — skipping (build continues).`);
  });
}
