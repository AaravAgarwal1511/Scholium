import { escapeAttr, plainText } from "./markdown";
import type { PageData } from "./pageData";
import type { PostsApi } from "./posts";
import { siteUrl } from "./base";

export const SITE_NAME = "Scholium Blog";
export const SITE_DESCRIPTION =
  "Notes from Scholium on studying well: memory science, exam technique and the thinking behind our tools.";

export interface HeadInfo {
  title: string;
  description: string;
  path: string;
  type: "website" | "article";
  image?: string | null;
  publishedTime?: string;
  modifiedTime?: string;
  author?: string | null;
  tags?: string[];
  noindex?: boolean;
}

export function headFor(data: PageData, path: string, api: PostsApi): HeadInfo {
  switch (data.kind) {
    case "index":
      return { title: SITE_NAME, description: SITE_DESCRIPTION, path: "/", type: "website" };
    case "post": {
      const p = data.post;
      return {
        title: `${p.title} · ${SITE_NAME}`,
        description: p.excerpt?.trim() || plainText(p.body_md) || SITE_DESCRIPTION,
        path: `/${p.slug}`,
        type: "article",
        image: api.imageUrl(p.cover_image_path),
        publishedTime: p.published_at,
        modifiedTime: p.updated_at,
        author: p.author_name,
        tags: p.tags,
      };
    }
    case "not-found":
      return { title: `Not found · ${SITE_NAME}`, description: SITE_DESCRIPTION, path, type: "website", noindex: true };
  }
}

/** The <head> tags for a page, as an HTML string for the server template.
 *  `origin` is the canonical host only; the /blog prefix is added here. */
export function headToHtml(h: HeadInfo, origin: string, post?: { title: string } | null): string {
  const url = siteUrl(origin, h.path);
  const tags = [
    `<title>${escapeAttr(h.title)}</title>`,
    `<meta name="description" content="${escapeAttr(h.description)}">`,
    `<link rel="canonical" href="${escapeAttr(url)}">`,
    `<link rel="alternate" type="application/rss+xml" title="${SITE_NAME}" href="${escapeAttr(siteUrl(origin, "/rss.xml"))}">`,
    `<meta property="og:site_name" content="${SITE_NAME}">`,
    `<meta property="og:type" content="${h.type}">`,
    `<meta property="og:title" content="${escapeAttr(post?.title ?? h.title)}">`,
    `<meta property="og:description" content="${escapeAttr(h.description)}">`,
    `<meta property="og:url" content="${escapeAttr(url)}">`,
    `<meta name="twitter:card" content="${h.image ? "summary_large_image" : "summary"}">`,
  ];
  if (h.image) {
    tags.push(`<meta property="og:image" content="${escapeAttr(h.image)}">`);
    tags.push(`<meta name="twitter:image" content="${escapeAttr(h.image)}">`);
  }
  if (h.publishedTime) tags.push(`<meta property="article:published_time" content="${escapeAttr(h.publishedTime)}">`);
  if (h.modifiedTime) tags.push(`<meta property="article:modified_time" content="${escapeAttr(h.modifiedTime)}">`);
  for (const t of h.tags ?? []) tags.push(`<meta property="article:tag" content="${escapeAttr(t)}">`);
  if (h.noindex) tags.push(`<meta name="robots" content="noindex">`);

  if (h.type === "article" && post) {
    const ld = {
      "@context": "https://schema.org",
      "@type": "BlogPosting",
      headline: post.title,
      description: h.description,
      url,
      mainEntityOfPage: url,
      datePublished: h.publishedTime,
      dateModified: h.modifiedTime ?? h.publishedTime,
      ...(h.image ? { image: [h.image] } : {}),
      ...(h.tags?.length ? { keywords: h.tags.join(", ") } : {}),
      author: h.author ? { "@type": "Person", name: h.author } : { "@type": "Organization", name: "Scholium" },
      publisher: { "@type": "Organization", name: "Scholium", url: "https://www.thescholium.com" },
    };
    // `<` escaped so a title containing </script> cannot end the block.
    tags.push(`<script type="application/ld+json">${JSON.stringify(ld).replace(/</g, "\\u003c")}</script>`);
  }
  return tags.join("\n    ");
}
