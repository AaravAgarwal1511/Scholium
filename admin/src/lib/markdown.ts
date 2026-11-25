// Preview renderer for the Blog editor. Mirrors packages/blog/src/lib/markdown.ts
// (same marked options, same sanitiser allow-list) so the preview matches what
// readers will see. admin is not a workspace package and cannot import it —
// change both together.

import { Marked, type Tokens } from "marked";
import * as xssModule from "xss";

const xss = ((xssModule as unknown as { default?: typeof xssModule }).default ?? xssModule) as typeof xssModule;
const { FilterXSS, getDefaultWhiteList } = xss;

const marked = new Marked({ gfm: true, breaks: false, async: false });

marked.use({
  renderer: {
    image({ href, title, text }: Tokens.Image) {
      const t = title ? ` title="${escapeAttr(title)}"` : "";
      return `<img src="${escapeAttr(href)}" alt="${escapeAttr(text)}"${t} loading="lazy" decoding="async">`;
    },
    link(this: { parser: { parseInline(t: Tokens.Link["tokens"]): string } }, { href, title, tokens }: Tokens.Link) {
      const inner = this.parser.parseInline(tokens);
      const t = title ? ` title="${escapeAttr(title)}"` : "";
      const ext = /^https?:\/\//i.test(href) ? ' target="_blank" rel="noopener noreferrer"' : "";
      return `<a href="${escapeAttr(href)}"${t}${ext}>${inner}</a>`;
    },
  },
});

const whiteList = getDefaultWhiteList();
whiteList.a = ["href", "title", "target", "rel"];
whiteList.img = ["src", "alt", "title", "width", "height", "loading", "decoding"];
whiteList.code = ["class"];
whiteList.input = ["type", "checked", "disabled"];

const filter = new FilterXSS({
  whiteList,
  stripIgnoreTag: true,
  stripIgnoreTagBody: ["script", "style", "iframe", "object", "embed"],
  onTagAttr(tag, name, value) {
    if (tag === "input" && name === "type" && value !== "checkbox") return "";
    return undefined;
  },
});

export function renderMarkdown(md: string): string {
  return filter.process(marked.parse(md ?? "") as string);
}

function escapeAttr(s: string | null | undefined): string {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/** "Why Spaced Repetition Works!" → "why-spaced-repetition-works". Matches the
 *  CHECK on blog_posts.slug. */
export function slugify(title: string): string {
  return title
    .normalize("NFKD")
    .replace(/\p{M}+/gu, "") // strip the accents NFKD split off
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120)
    .replace(/-+$/g, "");
}

export const SLUG_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/;
