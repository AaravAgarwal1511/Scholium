// The Vercel function body for /blog. Never imported by app code: the Vite plugin
// (vite/plugin.js) bundles this file, with every dependency inlined, into the host
// app's dist-server/blog.js after the client build, and the app's api/blog.js
// re-exports it. `virtual:blog-template` is that build's dist/blog.html, supplied
// by the plugin, so the function needs no file reads at runtime.
//
// The app's vercel.json rewrites /blog and /blog/:path* to /api/blog?path=<the
// part after /blog>.
//
// Env (the app's existing Vercel settings): VITE_SUPABASE_URL and
// VITE_SUPABASE_PUBLISHABLE_KEY, the public anon key the browser bundle already
// carries. Optional BLOG_SITE_URL pins the canonical origin (without /blog).

import type { IncomingMessage, ServerResponse } from "node:http";
import template from "virtual:blog-template";
import { handleRequest } from "./server";

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  const url = new URL(req.url ?? "/", "http://localhost");
  const raw = url.searchParams.get("path") || "/";

  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  const key = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  if (!supabaseUrl || !key) {
    res.statusCode = 500;
    res.setHeader("Content-Type", "text/plain; charset=utf-8");
    res.end("Missing VITE_SUPABASE_URL or VITE_SUPABASE_PUBLISHABLE_KEY");
    return;
  }

  const result = await handleRequest({
    pathname: raw.startsWith("/") ? raw : `/${raw}`,
    origin: canonicalOrigin(req),
    supabase: { url: supabaseUrl, key },
    template,
  });

  res.statusCode = result.status;
  for (const [k, v] of Object.entries(result.headers)) res.setHeader(k, v);
  res.end(result.body);
}

/** Production points every copy (www and pastpapers) at www, so search engines
 *  see one blog, not two. Previews and local runs use the request's own host. */
export function canonicalOrigin(req: IncomingMessage): string {
  if (process.env.BLOG_SITE_URL) return process.env.BLOG_SITE_URL.replace(/\/$/, "");
  if (process.env.VERCEL_ENV === "production") return "https://www.thescholium.com";
  const first = (h: string | string[] | undefined) => String(h ?? "").split(",")[0].trim();
  const proto = first(req.headers["x-forwarded-proto"]) || "https";
  const host = first(req.headers["x-forwarded-host"]) || first(req.headers.host) || "localhost";
  return `${proto}://${host}`;
}
