#!/usr/bin/env node

/**
 * Renders the two brand raster images this app is missing entirely today:
 *
 *   public/og.png   1200×630 — the social/AI share card (og:image, twitter:image)
 *   public/logo.png  512×512 — a square brand mark for Organization.logo
 *
 * Neither existed before this script: og:image was absent everywhere (every
 * shared link and AI-search card rendered bare), and Organization.logo pointed
 * at favicon.svg — an SVG, which Google's Logo structured-data pipeline
 * doesn't reliably process, and one shaped nothing like a square brand mark.
 *
 * Run manually and commit the output, the same way `pnpm index:papers`
 * produces committed data rather than running at request or build time — a
 * static brand image has no reason to regenerate on every deploy. Re-run only
 * if the brand mark, palette, or subject list changes.
 *
 * Uses the Playwright Chromium already installed for this app's e2e/visual
 * suites (`@playwright/test` devDependency) — no new package needed, and
 * `npx playwright install chromium` if the browser binary isn't cached yet.
 */

import { chromium } from "@playwright/test";
import { mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const APP_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const PUBLIC_DIR = path.join(APP_DIR, "public");

// Same open-book mark as packages/ui/src/ScholiumLogo.tsx, inlined here since
// this script runs as plain Node/Playwright rather than through Vite — it
// can't import a .tsx component. Keep the path data identical if the mark
// changes there.
const MARK_SVG = `<svg viewBox="0 0 32 32" fill="none" stroke-linecap="round" stroke-linejoin="round">
  <path d="M5 6 L5 26 L16 23 L27 26 L27 6 L16 9 Z" stroke="currentColor" stroke-width="1.6" />
  <path d="M16 9 L16 23" stroke="currentColor" stroke-width="1.6" opacity="0.55" />
  <circle cx="16" cy="16" r="1.4" fill="currentColor" />
</svg>`;

// Palette lifted from public/papers/papers.css's dark values (that file's own
// header explains why: hand-copied from packages/ui/src/tokens.css, which
// only resolves through Vite's bundler, not as a plain static asset a
// screenshot script can load).
const BG = "hsl(0 0% 6%)";
const FG = "hsl(0 0% 94%)";
const FG_MUTED = "hsl(0 0% 65%)";
const ACCENT = "hsl(239 84% 67%)";

function ogTemplate() {
  return `<!doctype html><html><head><meta charset="utf-8"><style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html, body { width: 1200px; height: 630px; }
    body {
      background: ${BG};
      color: ${FG};
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      display: flex;
      flex-direction: column;
      justify-content: center;
      padding: 0 88px;
      position: relative;
      overflow: hidden;
    }
    .glow {
      position: absolute;
      top: -220px;
      right: -160px;
      width: 640px;
      height: 640px;
      border-radius: 50%;
      background: radial-gradient(circle, ${ACCENT} 0%, transparent 70%);
      opacity: 0.35;
    }
    .brand { display: flex; align-items: center; gap: 16px; margin-bottom: 40px; }
    .mark { width: 44px; height: 44px; color: ${ACCENT}; }
    .brand-name { font-size: 28px; font-weight: 700; letter-spacing: -0.01em; }
    .brand-name span { font-weight: 400; color: ${FG_MUTED}; }
    h1 { font-size: 64px; font-weight: 700; letter-spacing: -0.02em; line-height: 1.15; max-width: 900px; }
    p { margin-top: 22px; font-size: 28px; color: ${FG_MUTED}; max-width: 780px; line-height: 1.4; }
    .chips { display: flex; gap: 12px; margin-top: 44px; flex-wrap: wrap; max-width: 900px; }
    .chip {
      border: 1px solid hsl(0 0% 24%);
      color: ${FG_MUTED};
      border-radius: 999px;
      padding: 8px 18px;
      font-size: 18px;
    }
  </style></head>
  <body>
    <div class="glow"></div>
    <div class="brand">
      <span class="mark">${MARK_SVG}</span>
      <span class="brand-name">Scholium <span>Past Papers</span></span>
    </div>
    <h1>Topical IGCSE Past Papers &amp; Mark Schemes</h1>
    <p>Real Cambridge exam questions, grouped by chapter. Generate a custom practice paper in a minute.</p>
    <div class="chips">
      <span class="chip">Economics</span>
      <span class="chip">Biology</span>
      <span class="chip">Chemistry</span>
      <span class="chip">Physics</span>
      <span class="chip">Computer Science</span>
      <span class="chip">Mathematics</span>
    </div>
  </body></html>`;
}

function logoTemplate() {
  return `<!doctype html><html><head><meta charset="utf-8"><style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html, body { width: 512px; height: 512px; }
    body {
      background: ${BG};
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .mark { width: 300px; height: 300px; color: ${ACCENT}; }
  </style></head>
  <body><span class="mark">${MARK_SVG}</span></body></html>`;
}

// 1x, not retina: the file's actual pixel dimensions must match the
// og:image:width/height meta values pageShell() declares (1200×630, 512×512)
// — a mismatch there is exactly the kind of validator warning this script
// exists to avoid.
async function screenshot(browser, html, width, height, outPath) {
  const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 1 });
  await page.setContent(html, { waitUntil: "networkidle" });
  await page.screenshot({ path: outPath });
  await page.close();
}

async function main() {
  mkdirSync(PUBLIC_DIR, { recursive: true });
  const browser = await chromium.launch();
  try {
    await screenshot(browser, ogTemplate(), 1200, 630, path.join(PUBLIC_DIR, "og.png"));
    await screenshot(browser, logoTemplate(), 512, 512, path.join(PUBLIC_DIR, "logo.png"));
  } finally {
    await browser.close();
  }
  console.log("✅ build-og-image: wrote public/og.png (1200×630) and public/logo.png (512×512).");
  console.log("   Commit both — this is a one-off asset, not build output.");
}

main().catch((err) => {
  console.error("❌ build-og-image:", err.message || err);
  process.exit(1);
});
