import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import App from "./App";
import { createPostsApi, type Post } from "./lib/posts";
import type { InitialState } from "./lib/pageData";

const POST: Post = {
  id: "1",
  slug: "hello-world",
  title: "Hello world",
  excerpt: "Excerpt here",
  body_md: "Body **text**.",
  cover_image_path: null,
  tags: [],
  author_name: null,
  published_at: "2026-11-20T09:00:00.000Z",
  updated_at: "2026-11-20T09:00:00.000Z",
};

beforeAll(() => {
  // jsdom has no matchMedia; the shared navbar's useDarkMode reads it.
  window.matchMedia ??= ((q: string) => ({
    matches: false,
    media: q,
    addEventListener() {},
    removeEventListener() {},
  })) as unknown as typeof window.matchMedia;
});
afterEach(cleanup);

function setup(path: string, initial: InitialState | null, rows: unknown[] = []) {
  const fetch = vi.fn(async (input: string | URL | Request) =>
    Response.json(String(input).includes("scholium_apps") ? [] : rows),
  );
  const api = createPostsApi({ url: "https://p", key: "k", fetch: fetch as unknown as typeof globalThis.fetch });
  render(
    <MemoryRouter initialEntries={[path]}>
      <App api={api} initial={initial} />
    </MemoryRouter>,
  );
  const postFetches = () => fetch.mock.calls.filter((c) => String(c[0]).includes("blog_posts"));
  return { postFetches };
}

describe("App", () => {
  it("renders the server's data on first paint without refetching it", async () => {
    const { postFetches } = setup("/", { path: "/", data: { kind: "index", posts: [POST] } });
    expect(screen.getByRole("link", { name: /Hello world/ })).toBeTruthy();
    await screen.findByRole("button", { name: "Study tools" }); // navbar mounted
    expect(postFetches()).toHaveLength(0);
  });

  it("fetches when there is no server data (dev / client navigation)", async () => {
    const { postFetches } = setup("/hello-world", null, [POST]);
    expect(screen.getByRole("status").textContent).toContain("Loading");
    expect(await screen.findByRole("heading", { level: 1, name: "Hello world" })).toBeTruthy();
    expect(postFetches()).toHaveLength(1);
  });

  it("shows the not-found page for a missing post", async () => {
    setup("/missing", null, []);
    expect(await screen.findByRole("heading", { name: "Post not found" })).toBeTruthy();
  });

  it("shows an empty state when nothing is published", async () => {
    setup("/", { path: "/", data: { kind: "index", posts: [] } });
    expect(screen.getByText(/No posts yet/)).toBeTruthy();
  });
});
