#!/usr/bin/env node

/**
 * Generates real, static, crawlable HTML for every subject, component, and
 * pilot topic this app offers — apps/past-papers/public/papers/<code>/index.html,
 * .../<code>/<component-slug>/index.html, .../<code>/topics/<topic-slug>/index.html
 * — plus public/sitemap.xml, public/llms.txt, public/404.html, and a homepage
 * fallback fragment consumed by vite.config.ts.
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
 * Reads scripts/seo-catalog.json — a committed snapshot of `paper_files` and
 * `questions_metadata`, produced by `node scripts/build-seo-catalog.js` (run
 * manually, like `pnpm index:papers`) — rather than querying Supabase live.
 * Two reasons: `questions_metadata`'s anon SELECT is revoked (see
 * database/migrations/20260821000000_revoke_anon_questions_metadata.sql), so
 * only a script holding the service-role key can read it; and reading a
 * committed file instead of a live table removes the failure class this file
 * used to fail soft on — a transient Supabase hiccup during a Vercel build
 * could silently ship zero /papers/* pages and a truncated sitemap. A missing
 * or empty snapshot still only warns and skips (these are bonus SEO pages,
 * not the product itself) — it just can no longer happen from ordinary
 * network flakiness.
 *
 * These pages deliberately do NOT ship the SPA's JS bundle. If they did, the
 * app's `*` catch-all route (src/App.tsx) would render on top of them, and a
 * crawler that doesn't execute JS is the only one who'd ever see the static
 * content anyway. Script-free also means no App.tsx route changes were needed
 * for these to exist.
 *
 * SUBJECT_DISPLAY_NAMES / parseFileName / paperNumOf below are intentionally
 * duplicated from src/lib/papers.ts rather than imported — this is a plain
 * Node ESM script, papers.ts is TypeScript with a browser-coupled Supabase
 * client import at module scope, and this repo has no TS-in-Node execution
 * path (no tsx/ts-node dependency anywhere). Kept in sync by
 * src/lib/paperCatalogSync.test.ts, which imports both and asserts they
 * agree — the same pattern apps/mock-space/src/lib/paperRetention.test.ts
 * already uses to guard api/prune-papers.js's duplicated constants.
 */

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const SITE_URL = "https://pastpapers.thescholium.com";
export const HOME_URL = "https://www.thescholium.com";
const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const APP_DIR = path.join(SCRIPT_DIR, "..");
const PUBLIC_DIR = path.join(APP_DIR, "public");
const SNAPSHOT_PATH = path.join(SCRIPT_DIR, "seo-catalog.json");
// Build-only scratch output, read by vite.config.ts's transformIndexHtml hook
// and never shipped itself — see that file for why the fragment lives outside
// public/ rather than being written straight into index.html.
const SEO_BUILD_DIR = path.join(APP_DIR, ".seo-build");

// ---- duplicated from src/lib/papers.ts — see the sync test noted above ----

export const SUBJECT_DISPLAY_NAMES = {
  "0455": "Economics",
  "0478": "Computer Science",
  "0580": "Mathematics",
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

// Truncate to a hard character budget without cutting a word in half — used
// to keep meta descriptions under Google's ~155-160 char SERP truncation.
export function truncateWords(text, maxLength) {
  if (text.length <= maxLength) return text;
  const cut = text.slice(0, maxLength - 1);
  const lastSpace = cut.lastIndexOf(" ");
  return `${cut.slice(0, lastSpace > 40 ? lastSpace : cut.length)}…`;
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

// ---- data assembly ----

// Groups raw {subject, component, file_name} rows into the subject →
// component → chapter tree the page renderers below expect. Exported so the
// sync test can exercise it directly against fixture rows. Deliberately
// unaware of questions_metadata — see enrichWithStats for the overlay.
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

// Overlays questions_metadata's per-(subject, chapter) aggregates onto the
// paper_files-derived catalog: a canonical, correctly-punctuated chapter name
// ("Firms' Costs, Revenue and Objectives" vs. the filename-derived "Firms
// Costs Revenue and Objectives"), a real question count, the exam-series/year
// range, and the most common sub-topics. Mutates `subjects` in place and
// returns it. A chapter with no classified questions yet (or one flagged
// `isUnclassified` — a catch-all bucket, never a real syllabus topic) keeps
// its filename-derived name and gets `stats: null`.
export function enrichWithStats(subjects, chapterStats) {
  for (const subject of subjects) {
    for (const component of subject.components) {
      for (const chapter of component.chapters) {
        const stats = chapterStats[`${subject.code}-${chapter.number}`];
        if (stats && !stats.isUnclassified) {
          chapter.name = stats.canonicalName;
          chapter.stats = stats;
        } else {
          chapter.stats = null;
        }
      }
    }
  }
  return subjects;
}

// Real per-page `<lastmod>` from paper_files.created_at, keyed by subject code
// and by "code component raw label". ISO 8601 strings with the same
// timezone offset compare correctly with plain string ordering, so this
// avoids parsing every row into a Date just to find the max.
export function computeLastMod(paperFiles) {
  const bySubject = new Map();
  const byComponent = new Map();
  for (const row of paperFiles) {
    if (!row.created_at) continue;
    if (!bySubject.has(row.subject) || row.created_at > bySubject.get(row.subject)) {
      bySubject.set(row.subject, row.created_at);
    }
    const key = `${row.subject} ${row.component}`;
    if (!byComponent.has(key) || row.created_at > byComponent.get(key)) {
      byComponent.set(key, row.created_at);
    }
  }
  return { bySubject, byComponent };
}

function dateOnly(iso) {
  return iso ? iso.slice(0, 10) : undefined;
}

// The same 2-node graph — Organization and WebApplication — declared in
// index.html. Prepended to every generated page's own @graph so a page's
// `isPartOf`/`publisher` reference resolves within that single page's JSON-LD
// rather than depending on a node only "/" ever defines (a validator reading
// one page in isolation won't cross-reference another URL's script tag).
function schemaBase() {
  return [
    {
      "@type": "Organization",
      "@id": `${HOME_URL}/#organization`,
      name: "Scholium",
      url: `${HOME_URL}/`,
      description:
        "Scholium builds free, focused study tools for IGCSE and secondary-level learners — spaced-repetition flashcards, active recall, poetry annotation, mock exam conditions, and topical past-paper practice.",
      logo: `${SITE_URL}/logo.png`,
      sameAs: ["https://www.instagram.com/scholiumedu/"],
      contactPoint: {
        "@type": "ContactPoint",
        email: "admin@thescholium.com",
        contactType: "customer support",
      },
    },
    {
      "@type": "WebApplication",
      "@id": `${SITE_URL}/#webapplication`,
      name: "Past Papers · Topical exam practice",
      url: `${SITE_URL}/`,
      description:
        "Assemble custom topical IGCSE past-paper practice sets by subject, component, and chapter, with mark schemes, for exam revision.",
      applicationCategory: "EducationalApplication",
      operatingSystem: "Any (web browser)",
      browserRequirements: "Requires JavaScript. Requires HTML5.",
      isAccessibleForFree: true,
      offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
      publisher: { "@id": `${HOME_URL}/#organization` },
      about: Object.values(SUBJECT_DISPLAY_NAMES).map((name) => `IGCSE ${name}`),
    },
  ];
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

function itemListJsonLd(name, items) {
  return {
    "@type": "ItemList",
    name,
    itemListElement: items.map((item, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: item.name,
      url: item.url,
    })),
  };
}

// ---- HTML rendering ----

const OG_IMAGE = `${SITE_URL}/og.png`;

function pageShell({ title, description, canonical, graph, bodyHtml, stylesheet = "/papers/papers.css", robots }) {
  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta name="description" content="${escapeHtml(description)}" />
    <meta name="theme-color" content="hsl(0, 0%, 98%)" media="(prefers-color-scheme: light)" />
    <meta name="theme-color" content="hsl(0, 0%, 6%)" media="(prefers-color-scheme: dark)" />
    ${robots ? `<meta name="robots" content="${robots}" />\n    ` : ""}${canonical ? `<link rel="canonical" href="${canonical}" />\n    ` : ""}<meta property="og:type" content="website" />
    <meta property="og:site_name" content="Scholium Past Papers" />
    <meta property="og:locale" content="en_US" />
    <meta property="og:title" content="${escapeHtml(title)}" />
    <meta property="og:description" content="${escapeHtml(description)}" />
    ${canonical ? `<meta property="og:url" content="${canonical}" />\n    ` : ""}<meta property="og:image" content="${OG_IMAGE}" />
    <meta property="og:image:width" content="1200" />
    <meta property="og:image:height" content="630" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${escapeHtml(title)}" />
    <meta name="twitter:description" content="${escapeHtml(description)}" />
    <meta name="twitter:image" content="${OG_IMAGE}" />
    <link rel="stylesheet" href="${stylesheet}" />
    <title>${escapeHtml(title)}</title>
    ${graph ? `<script type="application/ld+json">${JSON.stringify({ "@context": "https://schema.org", "@graph": graph })}</script>\n    ` : ""}</head>
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

// Every distinct chapter number across a subject's components, each counted
// once even though the same topic can appear on more than one component
// (Economics' 39 chapters are examined on both papers) — summing per-component
// would double the real total.
function subjectAggregate(subject) {
  const byNumber = new Map();
  for (const component of subject.components) {
    for (const chapter of component.chapters) {
      if (chapter.stats && !byNumber.has(chapter.number)) byNumber.set(chapter.number, chapter.stats);
    }
  }
  const statsList = Array.from(byNumber.values());
  const totalQuestions = statsList.reduce((sum, s) => sum + s.questionCount, 0);
  const years = statsList.flatMap((s) => [s.yearFrom, s.yearTo]).filter((y) => Number.isFinite(y));
  return {
    totalQuestions,
    yearFrom: years.length ? Math.min(...years) : null,
    yearTo: years.length ? Math.max(...years) : null,
  };
}

function freshnessLine(yearFrom, yearTo) {
  if (yearFrom == null || yearTo == null) return "";
  return yearFrom === yearTo
    ? `Question bank current through the ${yearFrom} exam series.`
    : `Question bank current through ${yearFrom}–${yearTo}.`;
}

function renderSubjectPage(subject, lastMod) {
  const { code, displayName, components } = subject;
  const canonical = `${SITE_URL}/papers/${code}`;
  const title = `IGCSE ${displayName} (${code}) — Topical Past Papers & Mark Schemes`;
  const totalChapters = components.reduce((n, c) => n + c.chapters.length, 0);
  const componentNames = components.map((c) => c.raw).join(", ");
  const description = `Topical IGCSE ${displayName} (${code}) past papers and mark schemes, organised by component and chapter. Covers ${componentNames} — ${totalChapters} chapters in total.`;
  const agg = subjectAggregate(subject);
  const fresh = freshnessLine(agg.yearFrom, agg.yearTo);

  const jsonLd = [
    ...schemaBase(),
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
    itemListJsonLd(
      `${displayName} components`,
      components.map((c) => ({ name: c.raw, url: `${SITE_URL}/papers/${code}/${c.slug}` })),
    ),
  ];

  const componentItems = components
    .map(
      (c) => `        <li>
          <a class="pp-card-link" href="/papers/${code}/${c.slug}">
            <strong>${escapeHtml(c.raw)}</strong>
            <span class="pp-card-meta">${c.chapters.length} chapter${c.chapters.length === 1 ? "" : "s"}</span>
          </a>
        </li>`,
    )
    .join("\n");

  const questionLine =
    agg.totalQuestions > 0
      ? ` The question bank behind it holds ${agg.totalQuestions} classified past-paper questions so far.`
      : "";

  const bodyHtml = `      <nav class="pp-breadcrumb" aria-label="Breadcrumb">
        <a href="/">Past Papers</a> <span aria-hidden="true">›</span> ${escapeHtml(displayName)}
      </nav>
      <h1>IGCSE ${escapeHtml(displayName)} (${code}) — Topical Past Papers &amp; Mark Schemes</h1>
      <p class="pp-lead">Which IGCSE ${escapeHtml(displayName)} topics come up most on Cambridge past papers?</p>
      <p class="pp-intro">
        Practice IGCSE ${escapeHtml(displayName)} (${code}) using real past-paper questions grouped by
        topic, so you can drill the chapters you're weakest on instead of sitting a whole paper cold.
        ${components.length} component${components.length === 1 ? "" : "s"} —
        ${escapeHtml(componentNames)} — cover ${totalChapters} chapters in total, and every question is
        cropped straight from the original Cambridge exam PDF and paired with its official mark scheme.${questionLine}
        Pick a component below to see its full topic list with real question counts, or jump straight
        into the generator to build a custom practice set now.
      </p>
      <a class="pp-btn pp-btn-primary pp-cta pp-cta-top" href="/?subject=${code}">
        Generate a custom ${escapeHtml(displayName)} practice paper →
      </a>
      <ul class="pp-component-list">
${componentItems}
      </ul>
      ${fresh ? `<p class="pp-freshness">${fresh}</p>` : ""}`;

  return pageShell({ title, description, canonical, graph: jsonLd, bodyHtml });
}

function renderComponentPage(subject, component, lastMod, topicSlugByChapter) {
  const { code, displayName } = subject;
  const canonical = `${SITE_URL}/papers/${code}/${component.slug}`;
  const title = `IGCSE ${displayName} (${code}) ${component.raw} — Topical Past Papers by Chapter`;
  const description = truncateWords(
    `Chapter-by-chapter topical past papers and mark schemes for IGCSE ${displayName} (${code}) ${component.raw} — ${component.chapters.length} chapters from real Cambridge exams.`,
    159,
  );

  const classified = component.chapters.filter((c) => c.stats);
  const years = classified.flatMap((c) => [c.stats.yearFrom, c.stats.yearTo]).filter((y) => Number.isFinite(y));
  const yearFrom = years.length ? Math.min(...years) : null;
  const yearTo = years.length ? Math.max(...years) : null;
  const fresh = freshnessLine(yearFrom, yearTo);
  const totalQuestions = classified.reduce((sum, c) => sum + c.stats.questionCount, 0);

  const jsonLd = [
    ...schemaBase(),
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
    itemListJsonLd(
      `${displayName} ${component.raw} chapters`,
      component.chapters.map((c) => ({
        name: `${c.number}. ${c.name}`,
        url: topicSlugByChapter.get(c.number)
          ? `${SITE_URL}/papers/${code}/topics/${topicSlugByChapter.get(c.number)}`
          : `${SITE_URL}/?subject=${code}&component=${component.slug}&chapter=${c.number}`,
      })),
    ),
  ];

  const chapterItems = component.chapters
    .map((c) => {
      const topicSlug = topicSlugByChapter.get(c.number);
      const href = topicSlug
        ? `/papers/${code}/topics/${topicSlug}`
        : `/?subject=${code}&component=${component.slug}&chapter=${c.number}`;
      const meta = c.stats ? `<span class="pp-chapter-meta">${c.stats.questionCount} questions</span>` : "";
      return `        <li>
          <a class="pp-card-link" href="${href}">
            <span>${c.number}. ${escapeHtml(c.name)}</span>
            ${meta}
          </a>
        </li>`;
    })
    .join("\n");

  const questionLine = totalQuestions > 0 ? ` It draws on ${totalQuestions} classified questions across those chapters.` : "";

  const bodyHtml = `      <nav class="pp-breadcrumb" aria-label="Breadcrumb">
        <a href="/">Past Papers</a> <span aria-hidden="true">›</span>
        <a href="/papers/${code}">${escapeHtml(displayName)}</a> <span aria-hidden="true">›</span>
        ${escapeHtml(component.raw)}
      </nav>
      <h1>IGCSE ${escapeHtml(displayName)} (${code}) ${escapeHtml(component.raw)} — Topical Past Papers by Chapter</h1>
      <p class="pp-lead">Which topics does ${escapeHtml(displayName)} ${escapeHtml(component.raw)} actually examine?</p>
      <p class="pp-intro">
        This component covers ${component.chapters.length} topic${component.chapters.length === 1 ? "" : "s"},
        drawn from real IGCSE past-paper questions grouped by chapter.${questionLine} Tap a chapter below
        to see it on its own page where one exists, or jump straight to it in the generator — either way
        you can build a custom practice set across any combination, with mark schemes included, in under
        a minute.
      </p>
      <a class="pp-btn pp-btn-primary pp-cta pp-cta-top" href="/?subject=${code}&component=${component.slug}">
        Generate a custom ${escapeHtml(displayName)} practice paper →
      </a>
      <ol class="pp-chapter-list">
${chapterItems}
      </ol>
      ${fresh ? `<p class="pp-freshness">${fresh}</p>` : ""}
      <a class="pp-btn pp-btn-primary pp-cta" href="/?subject=${code}&component=${component.slug}">
        Generate a custom ${escapeHtml(displayName)} practice paper →
      </a>`;

  return pageShell({ title, description, canonical, graph: jsonLd, bodyHtml });
}

// One pilot chapter's picked (topic name, question stats, and which
// components actually examine it — a chapter can appear on more than one,
// e.g. Economics' 39 chapters are shared across both its components).
function renderTopicPage(pick) {
  const { subject, chapterNumber, chapterName, stats, featuredIn } = pick;
  const { code, displayName } = subject;
  const slug = slugify(chapterName);
  const canonical = `${SITE_URL}/papers/${code}/topics/${slug}`;
  const title = `IGCSE ${displayName} (${code}): ${chapterName} — Past Paper Questions & Mark Schemes`;
  const description = truncateWords(
    `Practice ${chapterName} for IGCSE ${displayName} (${code}): ${stats.questionCount} real past-paper questions (${stats.yearFrom}–${stats.yearTo}) with mark schemes.`,
    159,
  );

  const primary = featuredIn[0];
  const ctaHref = primary
    ? `/?subject=${code}&component=${primary.slug}&chapter=${chapterNumber}`
    : `/?subject=${code}`;
  const featuredList = featuredIn.map((c) => c.raw).join(" and ");
  const fresh = freshnessLine(stats.yearFrom, stats.yearTo);

  const subTopicItems = stats.subTopics.map((t) => `          <li>${escapeHtml(t)}</li>`).join("\n");

  const jsonLd = [
    ...schemaBase(),
    breadcrumbJsonLd([
      ["Past Papers", `${SITE_URL}/`],
      [displayName, `${SITE_URL}/papers/${code}`],
      [chapterName, canonical],
    ]),
    {
      "@type": "CollectionPage",
      "@id": `${canonical}#page`,
      url: canonical,
      name: title,
      description,
      about: chapterName,
      isPartOf: { "@id": `${SITE_URL}/#webapplication` },
    },
    ...(stats.subTopics.length ? [itemListJsonLd(`${chapterName} sub-topics`, stats.subTopics.map((t) => ({ name: t })))] : []),
  ];

  const bodyHtml = `      <nav class="pp-breadcrumb" aria-label="Breadcrumb">
        <a href="/">Past Papers</a> <span aria-hidden="true">›</span>
        <a href="/papers/${code}">${escapeHtml(displayName)}</a> <span aria-hidden="true">›</span>
        ${escapeHtml(chapterName)}
      </nav>
      <h1>IGCSE ${escapeHtml(displayName)} (${code}): ${escapeHtml(chapterName)}</h1>
      <p class="pp-lead">What comes up on ${escapeHtml(chapterName)} in IGCSE ${escapeHtml(displayName)}?</p>
      <p class="pp-intro">
        ${escapeHtml(chapterName)} is examined on ${escapeHtml(featuredList)} of IGCSE ${escapeHtml(displayName)}
        (${code}). This topic has ${stats.questionCount} real Cambridge past-paper questions on record so
        far, drawn from the ${stats.series.join(", ")} exam series between ${stats.yearFrom} and ${stats.yearTo},
        each matched to its official mark scheme by position and question number. Every question is cropped
        straight from the original exam PDF — nothing here is retyped or rewritten — so what you practise on
        is exactly what was printed on the day. Pick how many questions you want below and generate a
        focused set on just this topic, mark schemes included, in under a minute — no need to sit a whole
        paper to drill the one chapter you're actually stuck on.
      </p>
      ${
        subTopicItems
          ? `<p class="pp-subtopics-label">Recent papers have tested:</p>
      <ul class="pp-subtopics-list">
${subTopicItems}
      </ul>`
          : ""
      }
      <a class="pp-btn pp-btn-primary pp-cta" href="${ctaHref}">
        Practice ${escapeHtml(chapterName)} now →
      </a>
      ${fresh ? `<p class="pp-freshness">${fresh}</p>` : ""}`;

  return pageShell({ title, description, canonical, graph: jsonLd, bodyHtml });
}

function renderNotFoundPage() {
  const title = "Page not found · Scholium Past Papers";
  const description = "This page doesn't exist. Browse subjects or generate a custom IGCSE practice paper instead.";
  const bodyHtml = `      <div class="pp-notfound">
        <h1>Page not found</h1>
        <p class="pp-intro">
          That address doesn't match a subject, component, or topic we have — or it's just mistyped.
          Head back to the generator and pick a subject from there.
        </p>
        <a class="pp-btn pp-btn-primary pp-cta" href="/">Go to the paper generator →</a>
      </div>`;
  // No canonical: a 404 has no canonical URL of its own, and noindex keeps it
  // out of the index if a crawler somehow reaches it directly.
  return pageShell({ title, description, canonical: null, graph: null, bodyHtml, robots: "noindex" });
}

// Reuses the app's own Tailwind classNames (Layout.tsx's header/main, and the
// same h1 the app renders) so the pre-hydration fallback lines up almost
// pixel-for-pixel with what createRoot().render() replaces it with — the
// classes already ship in the app's compiled CSS since Layout.tsx uses them,
// so no new stylesheet is needed for this fragment. Minimizing that visual
// delta is what keeps CLS low across the swap (see the Lighthouse gate).
function buildHomepageFallbackHtml(subjects, chapterStats) {
  const subjectLinks = subjects
    .map((s) => `            <li><a href="/papers/${s.code}">${escapeHtml(s.displayName)} (${s.code})</a></li>`)
    .join("\n");

  const years = Object.values(chapterStats)
    .flatMap((s) => [s.yearFrom, s.yearTo])
    .filter((y) => Number.isFinite(y));
  const seriesSet = new Set(Object.values(chapterStats).flatMap((s) => s.series ?? []));
  const yearFrom = years.length ? Math.min(...years) : null;
  const yearTo = years.length ? Math.max(...years) : null;
  const freshness =
    yearFrom != null && yearTo != null
      ? `<p class="mt-2 text-muted-foreground text-sm">Question bank current through ${yearTo} — spans ${yearFrom}–${yearTo} across the ${Array.from(seriesSet).sort().join(", ")} exam series.</p>`
      : "";

  return `<div class="min-h-screen flex flex-col">
      <header class="container mx-auto px-4 sm:px-6 pt-10 pb-2">
        <h1 class="text-foreground text-3xl sm:text-4xl font-bold tracking-tight">Past Papers.</h1>
        <p class="mt-2 text-muted-foreground max-w-2xl leading-relaxed">
          Generate a custom paper by picking chapters and how many questions you want from each.
        </p>
      </header>
      <main class="flex-1">
        <div class="container mx-auto px-4 sm:px-6 py-8 sm:py-10">
          <nav aria-label="Browse by subject">
            <h2 class="font-display font-semibold text-lg mb-3">Browse by subject</h2>
            <ul class="space-y-1 mb-6">
${subjectLinks}
            </ul>
          </nav>
          <details class="mt-4 rounded-lg border border-border bg-card px-4 py-3 text-sm text-muted-foreground">
            <summary class="cursor-pointer font-medium text-foreground">How this is put together</summary>
            <div class="mt-2 space-y-2">
              <p>
                Every question here is a real Cambridge IGCSE past-paper question, cropped straight from
                the original exam PDF — not retyped or rewritten, so what you see is exactly what was
                printed.
              </p>
              <p>
                Each question is matched to its syllabus topic by an AI model (Claude Haiku 4.5) that's
                shown the question and constrained to Cambridge's own official topic list for that
                subject — it can only pick a real syllabus topic, never invent one. Mark schemes are
                matched to their question automatically by position and question number, not
                reclassified separately, so the answer you get always belongs to the question you're
                practising.
              </p>
              <p>
                These papers are sourced from publicly available past-paper archives. Scholium is an
                independent project and isn't affiliated with, endorsed by, or connected to Cambridge
                Assessment International Education.
              </p>
            </div>
          </details>
          ${freshness}
        </div>
      </main>
    </div>`;
}

function renderSitemap(subjects, topicPages, lastMod) {
  const urls = [
    { loc: `${SITE_URL}/`, lastmod: dateOnly(new Date().toISOString()) },
    { loc: `${SITE_URL}/terms` },
    { loc: `${SITE_URL}/privacy` },
  ];
  for (const subject of subjects) {
    urls.push({ loc: `${SITE_URL}/papers/${subject.code}`, lastmod: dateOnly(lastMod.bySubject.get(subject.code)) });
    for (const component of subject.components) {
      urls.push({
        loc: `${SITE_URL}/papers/${subject.code}/${component.slug}`,
        lastmod: dateOnly(lastMod.byComponent.get(`${subject.code} ${component.raw}`)),
      });
    }
  }
  for (const pick of topicPages) {
    const slug = slugify(pick.chapterName);
    urls.push({
      loc: `${SITE_URL}/papers/${pick.subject.code}/topics/${slug}`,
      lastmod: dateOnly(lastMod.bySubject.get(pick.subject.code)),
    });
  }
  const body = urls
    .map((u) => `  <url>\n    <loc>${u.loc}</loc>${u.lastmod ? `\n    <lastmod>${u.lastmod}</lastmod>` : ""}\n  </url>`)
    .join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${body}\n</urlset>\n`;
}

function renderLlmsTxt(subjects, topicPages) {
  const topicsBySubject = new Map();
  for (const pick of topicPages) {
    const list = topicsBySubject.get(pick.subject.code) ?? [];
    list.push(pick);
    topicsBySubject.set(pick.subject.code, list);
  }

  const subjectBlocks = subjects
    .map((subject) => {
      const lines = [`- [IGCSE ${subject.displayName} (${subject.code})](${SITE_URL}/papers/${subject.code}): topical past papers and mark schemes.`];
      for (const component of subject.components) {
        lines.push(`  - [${component.raw}](${SITE_URL}/papers/${subject.code}/${component.slug}): ${component.chapters.length} chapters.`);
      }
      const topics = topicsBySubject.get(subject.code) ?? [];
      for (const pick of topics) {
        const slug = slugify(pick.chapterName);
        lines.push(`  - [${pick.chapterName}](${SITE_URL}/papers/${subject.code}/topics/${slug}): ${pick.stats.questionCount} questions.`);
      }
      return lines.join("\n");
    })
    .join("\n");

  return `# Past Papers · Scholium

> Assemble custom topical IGCSE past-paper practice sets by subject, component, and
> chapter, with mark schemes, for exam revision. Covers IGCSE Economics (0455), Computer
> Science (0478), Additional Mathematics (0606), International Mathematics (0607),
> Biology (0610), Chemistry (0620), and Physics (0625).

- [Past Papers tool](${SITE_URL}/): pick a subject, component, and chapters to generate a
  custom topical practice paper with its mark scheme.
${subjectBlocks}
- [Terms of Service](${SITE_URL}/terms)
- [Privacy Policy](${SITE_URL}/privacy)
`;
}

// Picks the highest-question-count real (non-Unclassified) chapters per
// subject, one page per topic rather than per paper — a shared topic like
// Economics' "Demand" is examined on more than one component, and a naive
// per-(subject, component, chapter) rollout would double-count and roughly
// double the page count for no new content. Counts chosen per the audit's
// phased rollout: a ~20-page pilot (Economics + Biology) against its 50-page
// quality-gate, not the full ~145-page rollout across all 7 subjects.
/** @type {Record<string, number>} */
const TOPIC_PILOT_COUNTS = { "0455": 12, "0610": 8 };

/**
 * @param {ReturnType<typeof buildCatalog>} subjects
 * @param {Record<string, number>} [counts]
 */
export function selectTopicPilot(subjects, counts = TOPIC_PILOT_COUNTS) {
  const picks = [];
  for (const subject of subjects) {
    const n = counts[subject.code];
    if (!n) continue;

    const seen = new Set();
    const candidates = [];
    for (const component of subject.components) {
      for (const chapter of component.chapters) {
        if (seen.has(chapter.number) || !chapter.stats) continue;
        seen.add(chapter.number);
        candidates.push({ number: chapter.number, name: chapter.name, stats: chapter.stats });
      }
    }
    candidates.sort((a, b) => b.stats.questionCount - a.stats.questionCount);

    for (const candidate of candidates.slice(0, n)) {
      const featuredIn = subject.components
        .filter((c) => c.chapters.some((ch) => ch.number === candidate.number))
        .sort((a, b) => paperNumOf(a.raw) - paperNumOf(b.raw));
      picks.push({
        subject,
        chapterNumber: candidate.number,
        chapterName: candidate.name,
        stats: candidate.stats,
        featuredIn,
      });
    }
  }
  return picks;
}

// ---- entry point ----

async function main() {
  let snapshot;
  try {
    snapshot = JSON.parse(readFileSync(SNAPSHOT_PATH, "utf8"));
  } catch (err) {
    console.warn(
      `⚠️  build-subject-pages: could not read ${SNAPSHOT_PATH} (${err.message}) — skipping (build continues). Run 'node scripts/build-seo-catalog.js' to generate it.`,
    );
    return;
  }

  const paperFiles = snapshot.paperFiles ?? [];
  if (paperFiles.length === 0) {
    console.warn("⚠️  build-subject-pages: snapshot has 0 paper_files rows — skipping (build continues).");
    return;
  }

  const subjects = buildCatalog(paperFiles);
  if (subjects.length === 0) {
    console.warn("⚠️  build-subject-pages: no subject had any indexable chapters — skipping (build continues).");
    return;
  }

  enrichWithStats(subjects, snapshot.chapterStats ?? {});
  const lastMod = computeLastMod(paperFiles);
  const topicPages = selectTopicPilot(subjects);

  // Chapter number -> topic slug, per subject, so component pages can link a
  // chapter straight to its topic page where the pilot covers it.
  const topicSlugByChapterBySubject = new Map();
  for (const pick of topicPages) {
    const map = topicSlugByChapterBySubject.get(pick.subject.code) ?? new Map();
    map.set(pick.chapterNumber, slugify(pick.chapterName));
    topicSlugByChapterBySubject.set(pick.subject.code, map);
  }

  let pageCount = 0;
  for (const subject of subjects) {
    const subjectDir = path.join(PUBLIC_DIR, "papers", subject.code);
    mkdirSync(subjectDir, { recursive: true });
    writeFileSync(path.join(subjectDir, "index.html"), renderSubjectPage(subject, lastMod));
    pageCount++;

    const topicSlugByChapter = topicSlugByChapterBySubject.get(subject.code) ?? new Map();
    for (const component of subject.components) {
      const componentDir = path.join(subjectDir, component.slug);
      mkdirSync(componentDir, { recursive: true });
      writeFileSync(path.join(componentDir, "index.html"), renderComponentPage(subject, component, lastMod, topicSlugByChapter));
      pageCount++;
    }
  }

  for (const pick of topicPages) {
    const topicDir = path.join(PUBLIC_DIR, "papers", pick.subject.code, "topics", slugify(pick.chapterName));
    mkdirSync(topicDir, { recursive: true });
    writeFileSync(path.join(topicDir, "index.html"), renderTopicPage(pick));
    pageCount++;
  }

  writeFileSync(path.join(PUBLIC_DIR, "sitemap.xml"), renderSitemap(subjects, topicPages, lastMod));
  writeFileSync(path.join(PUBLIC_DIR, "llms.txt"), renderLlmsTxt(subjects, topicPages));
  writeFileSync(path.join(PUBLIC_DIR, "404.html"), renderNotFoundPage());

  mkdirSync(SEO_BUILD_DIR, { recursive: true });
  writeFileSync(
    path.join(SEO_BUILD_DIR, "homepage-fallback.html"),
    buildHomepageFallbackHtml(subjects, snapshot.chapterStats ?? {}),
  );

  console.log(
    `✅ build-subject-pages: wrote ${pageCount} static page(s) (${topicPages.length} topic pilot) across ` +
      `${subjects.length} subject(s), plus sitemap.xml, llms.txt, 404.html, and the homepage fallback fragment.`,
  );
}

const isMain = import.meta.url === `file://${process.argv[1]}`;
if (isMain) {
  main().catch((err) => {
    console.warn(`⚠️  build-subject-pages: unexpected error (${err.message}) — skipping (build continues).`);
  });
}
