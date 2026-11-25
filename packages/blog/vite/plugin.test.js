import { describe, expect, it } from "vitest";
import { blogPath } from "./plugin.js";

describe("blogPath", () => {
  it("maps /blog URLs to in-app paths", () => {
    expect(blogPath("/blog")).toBe("/");
    expect(blogPath("/blog/")).toBe("/");
    expect(blogPath("/blog/my-post")).toBe("/my-post");
    expect(blogPath("/blog/my-post/")).toBe("/my-post/"); // the renderer 301s it
  });

  it("leaves the host app's own paths alone", () => {
    for (const p of ["/", "/blogging", "/about", "/papers/blog", "/blog.html"]) {
      expect(blogPath(p), p).toBeNull();
    }
  });
});
