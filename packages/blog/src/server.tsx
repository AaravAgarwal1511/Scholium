// Server renderer (`@repo/blog/server`). Turns a /blog request path into a
// complete HTML page, so posts are readable without JavaScript: by search engines,
// AI crawlers, link unfurlers and no-JS readers alike. The host apps never call
// this directly: the Vite plugin (`@repo/blog/vite`) calls it in dev, and bundles
// src/vercel.ts (which wraps it) into each app's dist-server/blog.js at build.
//
// Each response is cached by Vercel's CDN for 60s and then served stale while it
// revalidates, so a newly published post is live within about a minute with no
// rebuild or deploy.

import { renderToString } from "react-dom/server";
import { StaticRouter } from "react-router-dom/server";
import App from "./App";
import { createPostsApi, isValidSlug, PostsError, type BlogConfig } from "./lib/posts";
import { DATA_SCRIPT_ID, serializeForScript, type InitialState, type PageData } from "./lib/pageData";
import { headFor, headToHtml } from "./lib/seo";
import { buildRss, buildSitemap } from "./lib/feeds";
import { BASE_PATH, siteUrl } from "./lib/base";

export interface SsrRequest {
  /** Path inside the blog, prefix already stripped: "/" or "/my-post". */
  pathname: string;
  /** Canonical origin, e.g. "https://www.thescholium.com". BASE_PATH is added here. */
  origin: string;
  supabase: BlogConfig;
  /** The built dist/index.html, with the head/app markers. */
  template: string;
}

export interface SsrResponse {
  status: number;
  headers: Record<string, string>;
  body: string;
}

const CACHE_OK = "public, max-age=0, s-maxage=60, stale-while-revalidate=86400";
const HEAD_RE = /<!--head:start-->[\s\S]*?<!--head:end-->/;
const APP_MARK = "<!--app-html-->";
const DATA_MARK = "<!--app-data-->";

export async function handleRequest(req: SsrRequest): Promise<SsrResponse> {
  const api = createPostsApi(req.supabase);
  const origin = req.origin.replace(/\/$/, "");
  const path = req.pathname || "/";

  const site = siteUrl(origin, "/"); // https://www.thescholium.com/blog

  try {
    if (path === "/sitemap.xml") {
      return text(200, "application/xml", buildSitemap(await api.listPosts(1000), site));
    }
    if (path === "/rss.xml") {
      return text(200, "application/rss+xml", buildRss(await api.listPosts(50), site));
    }

    // One canonical URL per post: /blog/slug, never /blog/slug/. (The index's
    // "/blog/" arrives here as "/" and is served as-is; its canonical is /blog.)
    if (path.length > 1 && path.endsWith("/")) {
      const to = BASE_PATH + (path.replace(/\/+$/, "") || "");
      return { status: 301, headers: { Location: to || "/", "Cache-Control": CACHE_OK }, body: "" };
    }

    let data: PageData;
    if (path === "/") {
      data = { kind: "index", posts: await api.listPosts() };
    } else {
      const slug = decodeURIComponentSafe(path.slice(1));
      const post = slug && isValidSlug(slug) ? await api.getPost(slug) : null;
      data = post ? { kind: "post", post } : { kind: "not-found" };
    }

    const html = renderPage(req.template, { path, data }, origin, api);
    return text(data.kind === "not-found" ? 404 : 200, "text/html; charset=utf-8", html);
  } catch (e) {
    // Supabase down or misconfigured. Don't cache it, and don't render a "no
    // posts" page that a crawler would believe.
    const msg = e instanceof PostsError ? e.message : "Unexpected error";
    console.error("[blog ssr]", path, e);
    return {
      status: 503,
      headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store", "Retry-After": "30" },
      body: `The blog is temporarily unavailable. (${msg})`,
    };
  }
}

export function renderPage(
  template: string,
  initial: InitialState,
  origin: string,
  api: ReturnType<typeof createPostsApi>,
): string {
  const appHtml = renderToString(
    <StaticRouter basename={BASE_PATH} location={BASE_PATH + (initial.path === "/" ? "" : initial.path)}>
      <App api={api} initial={initial} />
    </StaticRouter>,
  );
  const head = headFor(initial.data, initial.path, api);
  const post = initial.data.kind === "post" ? initial.data.post : null;
  const dataTag = `<script type="application/json" id="${DATA_SCRIPT_ID}">${serializeForScript(initial)}</script>`;

  return template
    .replace(HEAD_RE, () => headToHtml(head, origin, post))
    .replace(APP_MARK, () => appHtml)
    .replace(DATA_MARK, () => dataTag);
}

function text(status: number, type: string, body: string): SsrResponse {
  return { status, headers: { "Content-Type": type, "Cache-Control": CACHE_OK }, body };
}

function decodeURIComponentSafe(s: string): string | null {
  try {
    return decodeURIComponent(s);
  } catch {
    return null;
  }
}
