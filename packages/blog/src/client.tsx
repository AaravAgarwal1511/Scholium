import { StrictMode } from "react";
import { createRoot, hydrateRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import "@repo/ui/scholium-navbar.css";
import "@repo/ui/legal.css";
import "./blog.css";
import App from "./App";
import { createPostsApi, type BlogConfig } from "./lib/posts";
import { DATA_SCRIPT_ID, type InitialState } from "./lib/pageData";
import { BASE_PATH } from "./lib/base";

/**
 * Browser entry for the /blog pages. Each host app's blog.html loads a two-line
 * src/blog.tsx that calls this with its own Supabase env:
 *
 *   hydrateBlog({ url: import.meta.env.VITE_SUPABASE_URL, key: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY });
 *
 * The server embeds what it fetched for the URL. Present → the page is already
 * rendered, so hydrate it. Absent (a static fallback) → render from scratch and
 * let each page fetch its own data.
 */
export function hydrateBlog(config: Pick<BlogConfig, "url" | "key">, root = document.getElementById("root")!) {
  const api = createPostsApi(config);
  const initial = readInitial();
  const tree = (
    <StrictMode>
      <BrowserRouter basename={BASE_PATH}>
        <App api={api} initial={initial} />
      </BrowserRouter>
    </StrictMode>
  );
  if (initial && root.hasChildNodes()) hydrateRoot(root, tree);
  else createRoot(root).render(tree);
}

function readInitial(): InitialState | null {
  const el = document.getElementById(DATA_SCRIPT_ID);
  if (!el?.textContent) return null;
  try {
    return JSON.parse(el.textContent) as InitialState;
  } catch {
    return null;
  }
}
