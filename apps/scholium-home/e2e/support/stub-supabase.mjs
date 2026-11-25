// A fake Supabase for the e2e run, on :54399 (the URL in .env.test).
//
// It has to be a real HTTP server, not page.route(): the posts are fetched by the
// SERVER renderer, which Playwright's browser-side interception never sees. It
// implements just the PostgREST shapes packages/blog/src/lib/posts.ts sends: the published_at
// filter, slug=eq., order and limit, plus scholium_apps and blog-images objects.
//
// The fixtures include a draft and a future-dated post that must never appear:
// the real RLS policy hides them, and this stub mimics that, so a regression in
// the client-side filter would still be caught by the "hidden" assertions.

import { createServer } from "node:http";

export const POSTS = [
  {
    id: "11111111-1111-4111-8111-111111111111",
    slug: "why-spaced-repetition-works",
    title: "Why spaced repetition works",
    excerpt: "The forgetting curve, and how to bend it.",
    body_md:
      "## The forgetting curve\n\nEbbinghaus found that memory decays **fast**.\n\n- Review just before you forget\n- Space reviews further apart\n\n<script>window.__pwned = true</script>\n\n[Read more](https://example.com)",
    cover_image_path: "covers/forgetting.png",
    tags: ["memory", "study"],
    author_name: "Scholium",
    published_at: "2026-11-20T09:00:00.000Z",
    updated_at: "2026-11-21T09:00:00.000Z",
  },
  {
    id: "22222222-2222-4222-8222-222222222222",
    slug: "exam-technique-basics",
    title: "Exam technique basics",
    excerpt: null,
    body_md: "Read the question. Then read it again.\n\nAllocate time by marks.",
    cover_image_path: null,
    tags: [],
    author_name: null,
    published_at: "2026-11-10T09:00:00.000Z",
    updated_at: "2026-11-10T09:00:00.000Z",
  },
  {
    id: "55555555-5555-4555-8555-555555555555",
    slug: "active-recall-vs-rereading",
    title: "Active recall vs. rereading",
    excerpt: "Rereading feels productive. Testing yourself actually is.",
    body_md: [
      "Most students reread their notes. It *feels* like learning because the material looks familiar, but familiarity is not recall.",
      "",
      "## What the research says",
      "",
      "> Retrieval practice produces more durable learning than repeated study. (Roediger & Karpicke, 2006)",
      "",
      "| Method | Feels effective | Retention after 1 week |",
      "|---|---|---|",
      "| Rereading | High | Low |",
      "| Self-testing | Low | High |",
      "",
      "## How to start",
      "",
      "1. Close the book.",
      "2. Write down everything you remember.",
      "3. Check what you missed, and test yourself on *that* tomorrow.",
    ].join("\n"),
    cover_image_path: "covers/recall.png",
    tags: ["memory", "technique"],
    author_name: "Scholium",
    published_at: "2026-11-15T09:00:00.000Z",
    updated_at: "2026-11-15T09:00:00.000Z",
  },
  {
    id: "66666666-6666-4666-8666-666666666666",
    slug: "building-a-revision-timetable",
    title: "Building a revision timetable that survives contact with reality",
    excerpt: "Plan for the week you'll actually have, not the one you wish you had.",
    body_md: [
      "Every timetable looks great on Sunday night. By Wednesday it's fiction.",
      "",
      "### Three rules",
      "",
      "- **Leave slack.** Fill 70% of your free time, not 100%.",
      "- **Interleave subjects** instead of blocking a whole day on one.",
      "- **Review the plan weekly**, not daily.",
      "",
      "A simple template:",
      "",
      "```",
      "Mon  Maths (45m)  · Chemistry recall (20m)",
      "Tue  English essay plan (40m)",
      "Wed  — slack —",
      "```",
      "",
      "Use [Recall](https://www.thescholium.com) for the short daily sessions.",
    ].join("\n"),
    cover_image_path: null,
    tags: ["planning"],
    author_name: null,
    published_at: "2026-11-05T09:00:00.000Z",
    updated_at: "2026-11-06T09:00:00.000Z",
  },
  {
    id: "33333333-3333-4333-8333-333333333333",
    slug: "secret-draft",
    title: "Secret draft",
    excerpt: null,
    body_md: "Not ready.",
    cover_image_path: null,
    tags: [],
    author_name: null,
    published_at: null,
    updated_at: "2026-11-22T09:00:00.000Z",
  },
  {
    id: "44444444-4444-4444-8444-444444444444",
    slug: "scheduled-post",
    title: "Scheduled post",
    excerpt: null,
    body_md: "From the future.",
    cover_image_path: null,
    tags: [],
    author_name: null,
    published_at: "2999-01-01T00:00:00.000Z",
    updated_at: "2026-11-22T09:00:00.000Z",
  },
];

const APPS = [{ id: "recall-app", title: "Recall", url: "https://recall.example", icon: "🧠" }];

// 1×1 transparent PNG.
const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=",
  "base64",
);

function visible(p) {
  return p.published_at !== null && Date.parse(p.published_at) <= Date.now();
}

export function startStub(port = 54399) {
  const server = createServer((req, res) => {
    const url = new URL(req.url ?? "/", "http://localhost");
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Headers", "*");
    if (req.method === "OPTIONS") return res.end();

    if (url.pathname === "/rest/v1/blog_posts") {
      let rows = POSTS.filter(visible); // what RLS gives the anon key
      const slug = url.searchParams.get("slug");
      if (slug?.startsWith("eq.")) rows = rows.filter((p) => p.slug === slug.slice(3));
      const lte = url.searchParams.get("published_at");
      if (lte?.startsWith("lte.")) rows = rows.filter((p) => Date.parse(p.published_at) <= Date.parse(lte.slice(4)));
      rows = [...rows].sort((a, b) => Date.parse(b.published_at) - Date.parse(a.published_at));
      rows = rows.slice(0, Number(url.searchParams.get("limit") ?? 1000));
      res.setHeader("Content-Type", "application/json");
      return res.end(JSON.stringify(rows));
    }
    if (url.pathname === "/rest/v1/scholium_apps") {
      res.setHeader("Content-Type", "application/json");
      return res.end(JSON.stringify(APPS));
    }
    if (url.pathname.startsWith("/storage/v1/object/public/blog-images/")) {
      res.setHeader("Content-Type", "image/png");
      return res.end(PNG);
    }
    res.statusCode = 404;
    res.end("{}");
  });
  return new Promise((resolve) => server.listen(port, () => resolve(server)));
}

// `node e2e/support/stub-supabase.mjs` runs it standalone (Playwright webServer).
if (import.meta.url === `file://${process.argv[1]}`) {
  await startStub(Number(process.env.STUB_PORT ?? 54399));
  console.log("stub supabase → http://localhost:54399");
}
