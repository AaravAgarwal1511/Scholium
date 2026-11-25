import { describe, expect, it, vi } from "vitest";
import { handleRequest } from "./server";
import type { Post } from "./lib/posts";

// The real template shape: the markers scripts/postbuild.mjs checks for.
const TEMPLATE = `<!DOCTYPE html><html><head><!--head:start--><title>x</title><!--head:end--></head>
<body><div id="root"><!--app-html--></div><!--app-data--></body></html>`;

const POST: Post = {
  id: "1",
  slug: "hello-world",
  title: "Hello </script> world",
  excerpt: "An excerpt",
  body_md: "## Section\n\nBody text.",
  cover_image_path: "c.png",
  tags: ["t1"],
  author_name: "Ada",
  published_at: "2026-11-20T09:00:00.000Z",
  updated_at: "2026-11-21T09:00:00.000Z",
};

/** A fake PostgREST: one published post, plus whatever `override` says. */
function supabase(override?: (url: string) => Response | undefined) {
  const fetch = vi.fn(async (input: string | URL | Request) => {
    const url = String(input);
    const o = override?.(url);
    if (o) return o;
    if (url.includes("/scholium_apps")) return Response.json([]);
    if (url.includes("slug=eq.hello-world")) return Response.json([POST]);
    if (url.includes("slug=eq.")) return Response.json([]);
    return Response.json([POST]);
  });
  return { url: "https://p.supabase.co", key: "anon", fetch: fetch as unknown as typeof globalThis.fetch };
}

const req = (pathname: string, sb = supabase()) =>
  handleRequest({ pathname, origin: "https://blog.example/", supabase: sb, template: TEMPLATE });

describe("handleRequest", () => {
  it("renders a post as complete HTML with head tags and hydration data", async () => {
    const res = await req("/hello-world");
    expect(res.status).toBe(200);
    expect(res.headers["Cache-Control"]).toContain("s-maxage=60");
    expect(res.body).toContain("<h2>Section</h2>");
    // Mounted at /blog on www and pastpapers: every emitted URL carries the prefix.
    expect(res.body).toContain('<link rel="canonical" href="https://blog.example/blog/hello-world">');
    expect(res.body).toContain('href="https://blog.example/blog/rss.xml"');
    expect(res.body).toContain('"@type":"BlogPosting"');
    expect(res.body).toContain('id="blog-data"');
    expect(res.body).not.toContain("<!--app-html-->");
    expect(res.body).not.toContain("<title>x</title>");
  });

  it("never lets post content close a script element", async () => {
    const res = await req("/hello-world");
    // The only </script> tags are the ones the renderer itself writes.
    expect(res.body.match(/<\/script>/g)).toHaveLength(2); // JSON-LD + data
  });

  it("answers 404 with noindex for an unknown or malformed slug", async () => {
    for (const p of ["/missing", "/Not_A_Slug", "/a/b", "/%E0%A4%A"]) {
      const res = await req(p);
      expect(res.status, p).toBe(404);
      expect(res.body).toContain('<meta name="robots" content="noindex">');
    }
  });

  it("redirects a trailing slash to the canonical URL", async () => {
    const res = await req("/hello-world/");
    expect(res.status).toBe(301);
    expect(res.headers.Location).toBe("/blog/hello-world");
  });

  it("links the index and posts under /blog, with /blog as the index canonical", async () => {
    const res = await req("/");
    expect(res.status).toBe(200);
    expect(res.body).toContain('href="/blog/hello-world"');
    expect(res.body).toContain('<link rel="canonical" href="https://blog.example/blog">');
  });

  it("serves the sitemap and RSS against the canonical origin", async () => {
    const sitemap = await req("/sitemap.xml");
    expect(sitemap.headers["Content-Type"]).toBe("application/xml");
    expect(sitemap.body).toContain("<loc>https://blog.example/blog</loc>");
    expect(sitemap.body).toContain("<loc>https://blog.example/blog/hello-world</loc>");

    const rss = await req("/rss.xml");
    expect(rss.body).toContain("<title>Hello &lt;/script&gt; world</title>");
    expect(rss.body).toContain("<link>https://blog.example/blog/hello-world</link>");

  });

  it("answers 503, uncached, when Supabase fails — never an empty blog", async () => {
    const sb = supabase(() => new Response("{}", { status: 500 }));
    vi.spyOn(console, "error").mockImplementation(() => {});
    const res = await req("/", sb);
    expect(res.status).toBe(503);
    expect(res.headers["Cache-Control"]).toBe("no-store");
  });
});
