import { useEffect } from "react";
import { useBlog } from "./context";
import type { PageData } from "./pageData";
import { headFor } from "./seo";
import { siteUrl } from "./base";

/**
 * Keeps <title>, description and canonical in step on client-side navigation.
 * The server already wrote the full head for the first page; this only matters
 * once the reader clicks around, so it touches the few tags a tab shows.
 */
export function useHead(data: PageData | null, path: string) {
  const { api } = useBlog();
  useEffect(() => {
    if (!data) return;
    const h = headFor(data, path, api);
    document.title = h.title;
    upsert('meta[name="description"]', "meta", { name: "description" }).setAttribute("content", h.description);
    // Keep the server's canonical host (www, even when read on pastpapers):
    // only the path changes on client navigation.
    const canonical = upsert('link[rel="canonical"]', "link", { rel: "canonical" });
    const host = canonicalOrigin(canonical.getAttribute("href"));
    canonical.setAttribute("href", siteUrl(host, h.path));
  }, [data, path, api]);
}

function upsert(selector: string, tag: string, attrs: Record<string, string>): Element {
  let el = document.head.querySelector(selector);
  if (!el) {
    el = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
    document.head.appendChild(el);
  }
  return el;
}

function canonicalOrigin(href: string | null): string {
  try {
    return href ? new URL(href).origin : window.location.origin;
  } catch {
    return window.location.origin;
  }
}
