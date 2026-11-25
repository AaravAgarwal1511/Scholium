import { describe, expect, it, vi } from "vitest";
import { createPostsApi, formatDate, isValidSlug } from "./posts";
import { serializeForScript } from "./pageData";

function fakeFetch(body: unknown, status = 200) {
  return vi.fn(async () => new Response(JSON.stringify(body), { status }));
}

describe("createPostsApi", () => {
  it("lists only published posts, newest first, with the anon key", async () => {
    const f = fakeFetch([]);
    await createPostsApi({ url: "https://p.supabase.co/", key: "anon", fetch: f }).listPosts();
    const [url, init] = f.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toMatch(/^https:\/\/p\.supabase\.co\/rest\/v1\/blog_posts\?/);
    expect(url).toContain("published_at=lte.");
    expect(url).toContain("order=published_at.desc");
    expect(url).not.toContain("body_md"); // the list never ships whole bodies
    expect((init.headers as Record<string, string>).apikey).toBe("anon");
  });

  it("getPost returns null without a request for an invalid slug", async () => {
    const f = fakeFetch([]);
    const api = createPostsApi({ url: "https://p", key: "k", fetch: f });
    expect(await api.getPost("../etc/passwd")).toBeNull();
    expect(await api.getPost("Upper")).toBeNull();
    expect(f).not.toHaveBeenCalled();
  });

  it("getPost returns the first row or null", async () => {
    const api = createPostsApi({ url: "https://p", key: "k", fetch: fakeFetch([{ slug: "a" }]) });
    expect(await api.getPost("a")).toEqual({ slug: "a" });
    const empty = createPostsApi({ url: "https://p", key: "k", fetch: fakeFetch([]) });
    expect(await empty.getPost("a")).toBeNull();
  });

  it("throws on a Supabase error so the server can answer 503, not an empty blog", async () => {
    const api = createPostsApi({ url: "https://p", key: "k", fetch: fakeFetch({ message: "down" }, 500) });
    await expect(api.listPosts()).rejects.toThrow(/500/);
  });

  it("listApps swallows errors", async () => {
    const api = createPostsApi({ url: "https://p", key: "k", fetch: fakeFetch({}, 500) });
    expect(await api.listApps()).toEqual([]);
  });

  it("builds public image URLs and passes absolute ones through", () => {
    const api = createPostsApi({ url: "https://p", key: "k" });
    expect(api.imageUrl("covers/a b.png")).toBe("https://p/storage/v1/object/public/blog-images/covers/a%20b.png");
    expect(api.imageUrl("https://cdn/x.png")).toBe("https://cdn/x.png");
    expect(api.imageUrl(null)).toBeNull();
  });
});

it("isValidSlug mirrors the database CHECK", () => {
  expect(isValidSlug("why-spaced-repetition-works")).toBe(true);
  expect(isValidSlug("a1")).toBe(true);
  for (const bad of ["", "-a", "a-", "a--b", "A", "a_b", "a/b", "a".repeat(121)]) {
    expect(isValidSlug(bad), bad).toBe(false);
  }
});

it("formatDate is timezone-independent", () => {
  expect(formatDate("2026-11-20T23:30:00.000Z")).toBe("20 November 2026");
});

it("serializeForScript cannot close its <script>", () => {
  const out = serializeForScript({ body: "</script><script>alert(1)</script>" });
  expect(out).not.toContain("</script>");
  expect(JSON.parse(out)).toEqual({ body: "</script><script>alert(1)</script>" });
});
