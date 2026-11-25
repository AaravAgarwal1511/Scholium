// The blog is a route of its host apps (scholium-home → www.thescholium.com/blog,
// past-papers → pastpapers.thescholium.com/blog), so every URL it emits carries
// the prefix. The host's vercel.json and vite/plugin.js route the same prefix.
//
// Routes inside the blog stay prefix-free ("/", "/:slug"); the routers get
// `basename={BASE_PATH}` and add it to every <Link>.

/** "/blog" — no trailing slash. */
export const BASE_PATH = "/blog";

/** Absolute URL of an in-blog path. The index is `${origin}/blog`, never `/blog/`. */
export function siteUrl(origin: string, path: string): string {
  return origin.replace(/\/$/, "") + BASE_PATH + (path === "/" ? "" : path);
}
