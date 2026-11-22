import fs from "node:fs";
import path from "node:path";
import type { Plugin } from "vite";
import { fileURLToPath } from "node:url";
import {
  SUITE_SITE_URL,
  SUITE_SUBJECTS,
  SUITE_TOOLS,
  getTool,
  subjectIntro,
  subjectLabel,
  subjectPageMeta,
  subjectsForTool,
  toolPageMeta,
  toolUrl,
  type SuiteSubject,
  type SuiteTool,
} from "@repo/ui/suite-data";

// The config is loaded as ESM (--configLoader runner), so there is no __dirname.
const here = path.dirname(fileURLToPath(import.meta.url));

/**
 * Static HTML for the subject-first suite's public pages.
 *
 * scholium-home is a client-rendered SPA, so without this every URL would be
 * the same empty shell with a 200 status and a title set by JavaScript. At build
 * time this plugin copies the built index.html once per page and bakes in that
 * page's <title>, description, canonical/OG tags and its readable content:
 *
 *   dist/_prerender/subjects/<slug>/index.html   ← served at /<slug>
 *   dist/_prerender/tools/<mount>/index.html     ← served at /tools/<mount>
 *   dist/404.html                                ← every unmatched path, status 404
 *
 * vercel.json routes those URLs here (static file, real status), and React then
 * renders over the baked-in content as usual (createRoot replaces it).
 *
 * The copy comes from @repo/ui's suite registry, the same source the React pages
 * read, so the two can't drift. The plugin also checks that vercel.json routes
 * exactly the registry's subjects and tools, and fails the build if not, since
 * a missed subject there would 404 (and an extra one would proxy nonsense).
 */

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

interface Page {
  title: string;
  description: string;
  canonicalPath: string | null;
  body: string;
  noindex?: boolean;
}

function renderPage(template: string, page: Page): string {
  const head = [
    `<title>${esc(page.title)}</title>`,
    `<meta name="description" content="${esc(page.description)}" />`,
    `<meta property="og:title" content="${esc(page.title)}" />`,
    `<meta property="og:description" content="${esc(page.description)}" />`,
    page.canonicalPath
      ? `<link rel="canonical" href="${SUITE_SITE_URL}${page.canonicalPath}" />\n    <meta property="og:url" content="${SUITE_SITE_URL}${page.canonicalPath}" />`
      : "",
    page.noindex ? `<meta name="robots" content="noindex" />` : "",
  ]
    .filter(Boolean)
    .join("\n    ");

  let html = template
    .replace(/<title>[\s\S]*?<\/title>/, "")
    .replace(/<meta name="description"[^>]*>/, "")
    .replace("</head>", `    ${head}\n  </head>`);
  if (!html.includes('<div id="root"></div>')) throw new Error('prerender: index.html has no empty <div id="root">');
  html = html.replace('<div id="root"></div>', `<div id="root">${page.body}</div>`);
  return html;
}

// Plain, styled-enough markup: what a crawler indexes and what shows for the
// moment before the app mounts. Classes are ones the app already uses.
function shell(inner: string): string {
  return `<main class="max-w-4xl mx-auto px-6 py-20">${inner}</main>`;
}

function subjectBody(subject: SuiteSubject): string {
  const tools = subject.tools
    .map((id) => getTool(id))
    .filter((t): t is SuiteTool => Boolean(t))
    .map(
      (t) =>
        `<li><a href="${toolUrl(t.id, subject.slug)}">${esc(t.title)} for ${esc(subject.name)}</a>: ${esc(t.description)}</li>`,
    )
    .join("");
  return shell(
    `<h1 class="text-4xl font-bold">${esc(subjectLabel(subject))}</h1>` +
      subjectIntro(subject)
        .map((p) => `<p class="mt-4 text-lg">${esc(p)}</p>`)
        .join("") +
      `<ul class="mt-8 space-y-2">${tools}</ul>`,
  );
}

function toolBody(tool: SuiteTool): string {
  const subjects = subjectsForTool(tool.id)
    .map((s) => `<li><a href="${toolUrl(tool.id, s.slug)}">${esc(subjectLabel(s))}</a>: ${esc(s.blurb)}</li>`)
    .join("");
  return shell(
    `<h1 class="text-4xl font-bold">${esc(tool.title)}</h1>` +
      `<p class="mt-4 text-lg">${esc(tool.description)}</p>` +
      `<h2 class="mt-10 text-xl font-semibold">Subjects</h2><ul class="mt-4 space-y-2">${subjects}</ul>`,
  );
}

const NOT_FOUND: Page = {
  title: "Page not found · Scholium",
  description: "That page doesn't exist.",
  canonicalPath: null,
  noindex: true,
  body: shell(`<h1 class="text-4xl font-bold">Page not found</h1><p class="mt-4"><a href="/">Go to the home page</a></p>`),
};

// ── vercel.json ↔ registry check ─────────────────────────────────────────────

interface VercelRule {
  source: string;
  destination: string;
}

const alternation = (source: string, prefix: string, suffix = ""): Set<string> | null => {
  const m = source.match(new RegExp(`^${prefix.replace(/[/]/g, "\\/")}\\(([^)]+)\\)${suffix.replace(/[/+]/g, "\\$&")}$`));
  return m ? new Set(m[1].split("|")) : null;
};
const sameSet = (a: Set<string> | null, b: string[]) => !!a && a.size === b.length && b.every((x) => a.has(x));

export function checkVercelRoutes(vercelJsonPath: string): string[] {
  const config = JSON.parse(fs.readFileSync(vercelJsonPath, "utf8")) as {
    rewrites?: VercelRule[];
    redirects?: VercelRule[];
  };
  const rewrites = config.rewrites ?? [];
  const redirects = config.redirects ?? [];
  const problems: string[] = [];
  const find = (rules: VercelRule[], test: (r: VercelRule) => boolean) => rules.find(test);

  const subjectSlugs = SUITE_SUBJECTS.map((s) => s.slug);
  const subjectRule = find(rewrites, (r) => r.destination === "/_prerender/subjects/:subject/index.html");
  if (!subjectRule || !sameSet(alternation(subjectRule.source, "/:subject"), subjectSlugs)) {
    problems.push(`rewrite "/:subject(${subjectSlugs.join("|")})" → "/_prerender/subjects/:subject/index.html"`);
  }

  const multi = SUITE_TOOLS.filter((t) => subjectsForTool(t.id).length > 1).map((t) => t.mount);
  const toolRule = find(rewrites, (r) => r.destination === "/_prerender/tools/:mount/index.html");
  if (multi.length && (!toolRule || !sameSet(alternation(toolRule.source, "/tools/:mount"), multi))) {
    problems.push(`rewrite "/tools/:mount(${multi.join("|")})" → "/_prerender/tools/:mount/index.html"`);
  }

  for (const tool of SUITE_TOOLS) {
    const subjects = subjectsForTool(tool.id);
    const slugs = subjects.map((s) => s.slug);
    for (const suffix of [`/${tool.mount}`, `/${tool.mount}/:path+`]) {
      const rule = find(rewrites, (r) => r.source.startsWith("/:subject(") && r.source.endsWith(`)${suffix}`));
      if (!rule || !sameSet(alternation(rule.source, "/:subject", suffix), slugs)) {
        problems.push(`rewrite "/:subject(${slugs.join("|")})${suffix}" → the ${tool.title} zone`);
      }
    }
    if (subjects.length === 1) {
      const target = toolUrl(tool.id, subjects[0].slug);
      if (!find(redirects, (r) => r.source === `/tools/${tool.mount}` && r.destination === target)) {
        problems.push(`redirect "/tools/${tool.mount}" → "${target}"`);
      }
    }
  }
  return problems;
}

export function prerenderSuite(): Plugin {
  return {
    name: "scholium-prerender-suite",
    apply: "build",
    enforce: "post",
    buildStart() {
      const problems = checkVercelRoutes(path.resolve(here, "vercel.json"));
      if (problems.length) {
        this.error(
          `vercel.json is out of sync with the suite registry (packages/ui/src/suiteData.ts). Expected:\n  - ${problems.join("\n  - ")}`,
        );
      }
    },
    // After Vite has written dist/: the built index.html (hashed asset tags and
    // all) is the template every static page starts from.
    writeBundle(options) {
      const outDir = options.dir ?? path.resolve(here, "dist");
      const template = fs.readFileSync(path.join(outDir, "index.html"), "utf8");
      const emit = (fileName: string, page: Page) => {
        const file = path.join(outDir, fileName);
        fs.mkdirSync(path.dirname(file), { recursive: true });
        fs.writeFileSync(file, renderPage(template, page));
      };

      for (const subject of SUITE_SUBJECTS) {
        const meta = subjectPageMeta(subject);
        emit(`_prerender/subjects/${subject.slug}/index.html`, {
          ...meta,
          canonicalPath: `/${subject.slug}`,
          body: subjectBody(subject),
        });
      }
      for (const tool of SUITE_TOOLS) {
        if (subjectsForTool(tool.id).length < 2) continue; // redirected straight into the tool
        const meta = toolPageMeta(tool);
        emit(`_prerender/tools/${tool.mount}/index.html`, {
          ...meta,
          canonicalPath: `/tools/${tool.mount}`,
          body: toolBody(tool),
        });
      }
      emit("404.html", NOT_FOUND);
    },
  };
}
