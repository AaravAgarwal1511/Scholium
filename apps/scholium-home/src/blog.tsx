// Browser entry for /blog (loaded by blog.html). The blog itself is @repo/blog.
import { hydrateBlog } from "@repo/blog";

hydrateBlog({
  url: import.meta.env.VITE_SUPABASE_URL,
  key: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
});
