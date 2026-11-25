import { describe, expect, it } from "vitest";
import { plainText, readingMinutes, renderMarkdown } from "./markdown";

describe("renderMarkdown", () => {
  it("renders GFM", () => {
    const html = renderMarkdown("## Hi\n\n**bold** and ~~gone~~\n\n| a | b |\n|---|---|\n| 1 | 2 |");
    expect(html).toContain("<h2>Hi</h2>");
    expect(html).toContain("<strong>bold</strong>");
    expect(html).toContain("<del>gone</del>");
    expect(html).toContain("<td>1</td>");
  });

  it("strips scripts, event handlers and javascript: URLs", () => {
    const html = renderMarkdown(
      '<script>alert(1)</script>\n\n<img src="x" onerror="alert(1)">\n\n[click](javascript:alert(1))\n\n<iframe src="https://evil"></iframe>',
    );
    expect(html).not.toMatch(/<script|onerror|javascript:|<iframe/i);
    expect(html).not.toContain("alert(1)</script>");
  });

  it("opens external links safely and leaves internal ones alone", () => {
    expect(renderMarkdown("[x](https://example.com)")).toContain('target="_blank" rel="noopener noreferrer"');
    expect(renderMarkdown("[x](/other-post)")).not.toContain("target=");
  });

  it("lazy-loads images and keeps alt text", () => {
    const html = renderMarkdown("![A chart](https://cdn.example/c.png)");
    expect(html).toContain('alt="A chart"');
    expect(html).toContain('loading="lazy"');
  });

  it("keeps the language class on fenced code", () => {
    expect(renderMarkdown("```ts\nconst a = 1;\n```")).toContain('class="language-ts"');
  });

  it("treats null as empty", () => {
    expect(renderMarkdown(null)).toBe("");
  });
});

describe("plainText", () => {
  it("drops markup, images and code, keeps link text", () => {
    expect(plainText("# Title\n\nSee [the docs](https://x) ![img](y)\n\n```js\ncode()\n```\nDone")).toBe(
      "Title See the docs Done",
    );
  });

  it("truncates on a word boundary", () => {
    const out = plainText("word ".repeat(100), 30);
    expect(out.length).toBeLessThanOrEqual(30);
    expect(out.endsWith("…")).toBe(true);
    expect(out).not.toMatch(/wor…$/);
  });
});

it("readingMinutes is at least 1 and scales with words", () => {
  expect(readingMinutes("")).toBe(1);
  expect(readingMinutes("w ".repeat(1100))).toBe(5);
});
