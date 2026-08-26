#!/usr/bin/env node

/**
 * Prerenders /terms and /privacy into real static HTML — the two pages that,
 * unlike /papers/*, are already in the sitemap but still served the bare SPA
 * shell (the homepage's own title/description/canonical) to any non-JS
 * fetch, because their content only ever existed as a client-rendered React
 * route (see src/App.tsx).
 *
 * That content lives in @repo/ui — TermsOfService/PrivacyPolicy — shared
 * across every Scholium app, so this renders those SAME components with
 * react-dom/server via scripts/ssr-entry.tsx, rather than hand-duplicating
 * the legal text into a second copy that could drift from what the SPA
 * itself shows.
 *
 * Run after `vite build` (see package.json's `build` script): it links the
 * client build's hashed CSS file so the prerendered markup picks up the same
 * rui-legal / rui-scholium classes the SPA route renders with — there is
 * exactly one CSS bundle since this app has a single entry (src/main.tsx).
 */

import { build } from "vite";
import { readdirSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { escapeHtml, SITE_URL } from "./build-subject-pages.js";

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const APP_DIR = path.join(SCRIPT_DIR, "..");
const DIST_DIR = path.join(APP_DIR, "dist");
const SSR_OUT_DIR = path.join(APP_DIR, "dist-ssr");
const SSR_ENTRY = path.join(SCRIPT_DIR, "ssr-entry.tsx");
const HOME_URL = "https://www.thescholium.com";

function findClientCss() {
  const assetsDir = path.join(DIST_DIR, "assets");
  const files = readdirSync(assetsDir).filter((f) => f.endsWith(".css"));
  if (files.length === 0) {
    throw new Error(`No CSS bundle found in ${assetsDir} — run 'vite build' before this script.`);
  }
  return `/assets/${files[0]}`;
}

// Deliberately its own minimal shell rather than build-subject-pages.js's
// pageShell(): that one wraps content in .pp-main (max-width 42rem), which
// would double-constrain LegalPage's own .rui-legal-inner (max-width 760px)
// and clip it. LegalPage already renders a complete, self-contained page
// (its own header with a home link, its own prose column) — this just adds
// the head metadata a static page needs around it.
function legalPageShell({ title, description, canonical, bodyHtml, stylesheet }) {
  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta name="description" content="${escapeHtml(description)}" />
    <meta name="theme-color" content="hsl(0, 0%, 98%)" media="(prefers-color-scheme: light)" />
    <meta name="theme-color" content="hsl(0, 0%, 6%)" media="(prefers-color-scheme: dark)" />
    <link rel="canonical" href="${canonical}" />
    <meta property="og:type" content="website" />
    <meta property="og:site_name" content="Scholium Past Papers" />
    <meta property="og:locale" content="en_US" />
    <meta property="og:title" content="${escapeHtml(title)}" />
    <meta property="og:description" content="${escapeHtml(description)}" />
    <meta property="og:url" content="${canonical}" />
    <meta property="og:image" content="${SITE_URL}/og.png" />
    <meta property="og:image:width" content="1200" />
    <meta property="og:image:height" content="630" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${escapeHtml(title)}" />
    <meta name="twitter:description" content="${escapeHtml(description)}" />
    <meta name="twitter:image" content="${SITE_URL}/og.png" />
    <link rel="stylesheet" href="${stylesheet}" />
    <title>${escapeHtml(title)}</title>
  </head>
  <body>
${bodyHtml}
  </body>
</html>
`;
}

async function main() {
  const clientCss = findClientCss();

  await build({
    configFile: path.join(APP_DIR, "vite.config.ts"),
    build: {
      ssr: SSR_ENTRY,
      outDir: "dist-ssr",
      emptyOutDir: true,
      minify: false,
      rollupOptions: { output: { format: "es", entryFileNames: "ssr-entry.mjs" } },
    },
    ssr: { noExternal: ["@repo/ui"] },
    logLevel: "warn",
  });

  // Cache-bust: nothing else imports this path, but a stale module-cache hit
  // on a re-run within the same process would otherwise serve last build's output.
  const mod = await import(`${path.join(SSR_OUT_DIR, "ssr-entry.mjs")}?t=${Date.now()}`);

  const pages = [
    {
      dir: "terms",
      title: "Terms of Service · Scholium Past Papers",
      description: "The Terms of Service that govern use of the Scholium suite of study tools, including Past Papers.",
      html: mod.renderTerms(HOME_URL),
    },
    {
      dir: "privacy",
      title: "Privacy Policy · Scholium Past Papers",
      description: "How Scholium handles personal data across its suite of study tools, including Past Papers.",
      html: mod.renderPrivacy(HOME_URL),
    },
  ];

  for (const page of pages) {
    const canonical = `${SITE_URL}/${page.dir}`;
    const outDir = path.join(DIST_DIR, page.dir);
    mkdirSync(outDir, { recursive: true });
    const full = legalPageShell({
      title: page.title,
      description: page.description,
      canonical,
      bodyHtml: page.html,
      stylesheet: clientCss,
    });
    writeFileSync(path.join(outDir, "index.html"), full);
  }

  rmSync(SSR_OUT_DIR, { recursive: true, force: true });
  console.log("✅ prerender-legal: wrote dist/terms/index.html and dist/privacy/index.html.");
}

main().catch((err) => {
  console.error("❌ prerender-legal:", err.message || err);
  process.exit(1);
});
