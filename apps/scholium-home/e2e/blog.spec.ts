import { expect, test, type ConsoleMessage } from "@playwright/test";

// /blog is @repo/blog, server-rendered through the same function Vercel runs
// (see playwright.config.ts).
const POST = "/blog/why-spaced-repetition-works";

/** Fails the test on any React hydration warning or uncaught error. */
function watchConsole(page: import("@playwright/test").Page) {
  const problems: string[] = [];
  const onMsg = (m: ConsoleMessage) => {
    const t = m.text();
    if (m.type() === "error" || /hydrat/i.test(t)) problems.push(`${m.type()}: ${t}`);
  };
  page.on("console", onMsg);
  page.on("pageerror", (e) => problems.push(`pageerror: ${e.message}`));
  return problems;
}

test.describe("without JavaScript (what crawlers see)", () => {
  test.use({ javaScriptEnabled: false });

  test("the index lists published posts and hides drafts and scheduled posts", async ({ page }) => {
    await page.goto("/blog");
    await expect(page.getByRole("heading", { level: 1, name: "Blog" })).toBeVisible();
    await expect(page.getByRole("link", { name: /Why spaced repetition works/ })).toBeVisible();
    await expect(page.getByRole("link", { name: /Exam technique basics/ })).toBeVisible();
    await expect(page.getByText("Secret draft")).toHaveCount(0);
    await expect(page.getByText("Scheduled post")).toHaveCount(0);
  });

  test("a post renders in full, with head tags and sanitised body", async ({ page }) => {
    const res = await page.goto(POST);
    expect(res?.status()).toBe(200);
    await expect(page).toHaveTitle("Why spaced repetition works · Scholium Blog");
    await expect(page.getByRole("heading", { level: 2, name: "The forgetting curve" })).toBeVisible();
    await expect(page.locator('script[type="application/ld+json"]')).toHaveCount(1);
    await expect(page.locator('meta[property="og:image"]')).toHaveAttribute("content", /blog-images\/covers\/forgetting\.png$/);
    // The fixture body carries a <script>; it must not reach the DOM.
    await expect(page.locator(".post-body script")).toHaveCount(0);
  });

  test("drafts, scheduled and unknown posts are real 404s", async ({ page }) => {
    for (const path of ["/blog/secret-draft", "/blog/scheduled-post", "/blog/no-such-post"]) {
      const res = await page.goto(path);
      expect(res?.status(), path).toBe(404);
      await expect(page.getByRole("heading", { name: "Post not found" })).toBeVisible();
      await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", "noindex");
    }
  });
});

test.describe("with JavaScript", () => {
  test("hydrates the server HTML without mismatches", async ({ page }) => {
    const problems = watchConsole(page);
    await page.goto(POST);
    // The real navbar replaces the placeholder once React has hydrated.
    await expect(page.getByRole("button", { name: "Study tools" })).toBeVisible();
    await expect(page.getByRole("heading", { level: 1, name: "Why spaced repetition works" })).toBeVisible();
    expect(problems).toEqual([]);
  });

  test("navigates between index and posts client-side", async ({ page }) => {
    const problems = watchConsole(page);
    await page.goto("/blog");
    await expect(page.getByRole("button", { name: "Study tools" })).toBeVisible();

    // Mark the window: a full page load would wipe it, client routing keeps it.
    await page.evaluate(() => ((window as unknown as { __spa: boolean }).__spa = true));
    await page.getByRole("link", { name: /Exam technique basics/ }).click();
    await expect(page).toHaveURL("/blog/exam-technique-basics");
    await expect(page.getByRole("heading", { level: 1, name: "Exam technique basics" })).toBeVisible();
    await expect(page).toHaveTitle("Exam technique basics · Scholium Blog");

    await page.getByRole("link", { name: /All posts/ }).click();
    await expect(page.getByRole("link", { name: /Why spaced repetition works/ })).toBeVisible();
    expect(await page.evaluate(() => (window as unknown as { __spa?: boolean }).__spa)).toBe(true);
    expect(problems).toEqual([]);
  });
});

test("the sitemap and RSS feed are served, and robots.txt points at the sitemap", async ({ request }) => {
  const sitemap = await (await request.get("/blog/sitemap.xml")).text();
  expect(sitemap).toContain("/blog/why-spaced-repetition-works</loc>");
  expect(sitemap).not.toContain("secret-draft");

  const rss = await request.get("/blog/rss.xml");
  expect(rss.headers()["content-type"]).toContain("application/rss+xml");
  expect(await rss.text()).toContain("<title>Exam technique basics</title>");

  // scholium-home's own public/robots.txt (the blog no longer serves one).
  const robots = await (await request.get("/robots.txt")).text();
  expect(robots).toContain("Sitemap: https://www.thescholium.com/blog/sitemap.xml");
});

test("a trailing slash redirects to the canonical URL", async ({ request }) => {
  const res = await request.get(`${POST}/`, { maxRedirects: 0 });
  expect(res.status()).toBe(301);
  expect(res.headers().location).toBe(POST);
});
