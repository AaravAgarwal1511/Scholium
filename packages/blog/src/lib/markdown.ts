// Markdown → safe HTML. One renderer for both sides: the server bundle
// (entry-server.tsx) and the browser render the post body through this same
// function, which is what lets the browser hydrate the server's HTML instead of
// replacing it.
//
// admin/src/lib/markdown.ts mirrors this config for the editor preview; it cannot
// import across (admin is not a workspace package). Change both together.
//
// Posts come from the admin only, but the output is sanitised anyway: it goes in
// through dangerouslySetInnerHTML, and "only the admin can write it" is one leaked
// session away from not being true.

import { Marked, type Tokens } from "marked";
// xss is CommonJS. Node's ESM loader can't see its named exports (they hang off
// module.exports, which arrives as `default`), while Vite's bundle exposes them
// directly — so take whichever object actually carries them.
import * as xssModule from "xss";

const xss = ((xssModule as unknown as { default?: typeof xssModule }).default ?? xssModule) as typeof xssModule;
const { FilterXSS, getDefaultWhiteList } = xss;

const marked = new Marked({ gfm: true, breaks: false, async: false });

marked.use({
  renderer: {
    // Lazy-load images and keep them out of the critical path.
    image({ href, title, text }: Tokens.Image) {
      const t = title ? ` title="${escapeAttr(title)}"` : "";
      return `<img src="${escapeAttr(href)}" alt="${escapeAttr(text)}"${t} loading="lazy" decoding="async">`;
    },
    // External links open in a new tab without handing the opener over.
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
whiteList.code = ["class"]; // marked emits class="language-xyz" on fenced blocks
whiteList.input = ["type", "checked", "disabled"]; // GFM task lists

const filter = new FilterXSS({
  whiteList,
  stripIgnoreTag: true,
  stripIgnoreTagBody: ["script", "style", "iframe", "object", "embed"],
  onTagAttr(tag, name, value) {
    if (tag === "input" && name === "type" && value !== "checkbox") return "";
    return undefined; // fall through to the default, which also vets URLs
  },
});

/** Render a post body to sanitised HTML. */
export function renderMarkdown(md: string | null | undefined): string {
  return filter.process(marked.parse(md ?? "") as string);
}

/** Plain-text summary of a Markdown body, for meta descriptions. */
export function plainText(md: string | null | undefined, max = 160): string {
  const text = String(md ?? "")
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, " ")
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/<[^>]+>/g, " ")
    .replace(/[#>*_`~|]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (text.length <= max) return text;
  const cut = text.slice(0, max - 1);
  const space = cut.lastIndexOf(" ");
  return (space > max * 0.6 ? cut.slice(0, space) : cut) + "…";
}

/** Rough reading time in whole minutes (at least 1). */
export function readingMinutes(md: string | null | undefined): number {
  const words = String(md ?? "").split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(words / 220));
}

export function escapeAttr(s: string | null | undefined): string {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
