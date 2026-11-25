import { escapeAttr, plainText } from "./markdown";
import type { PostSummary } from "./posts";
import { SITE_DESCRIPTION, SITE_NAME } from "./seo";

const xml = escapeAttr; // &, <, >, " — enough for text and attribute content

// `site` below is the blog's root URL including its prefix, e.g.
// "https://www.thescholium.com/blog" (src/lib/base.ts siteUrl), no trailing slash.

export function buildSitemap(posts: PostSummary[], site: string): string {
  const newest = posts[0]?.updated_at;
  const urls = [
    `  <url><loc>${xml(site)}</loc>${newest ? `<lastmod>${xml(newest)}</lastmod>` : ""}</url>`,
    ...posts.map(
      (p) => `  <url><loc>${xml(`${site}/${p.slug}`)}</loc><lastmod>${xml(p.updated_at)}</lastmod></url>`,
    ),
  ];
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.join("\n")}
</urlset>
`;
}

export function buildRss(posts: PostSummary[], site: string): string {
  const items = posts.map((p) => {
    const link = `${site}/${p.slug}`;
    const desc = p.excerpt?.trim() || plainText(p.title);
    return `    <item>
      <title>${xml(p.title)}</title>
      <link>${xml(link)}</link>
      <guid isPermaLink="true">${xml(link)}</guid>
      <pubDate>${new Date(p.published_at).toUTCString()}</pubDate>
      <description>${xml(desc)}</description>${p.tags.map((t) => `\n      <category>${xml(t)}</category>`).join("")}
    </item>`;
  });
  const updated = posts[0] ? new Date(posts[0].published_at).toUTCString() : new Date(0).toUTCString();
  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${SITE_NAME}</title>
    <link>${xml(site)}</link>
    <description>${xml(SITE_DESCRIPTION)}</description>
    <language>en-gb</language>
    <lastBuildDate>${updated}</lastBuildDate>
    <atom:link href="${xml(site)}/rss.xml" rel="self" type="application/rss+xml"/>
${items.join("\n")}
  </channel>
</rss>
`;
}
