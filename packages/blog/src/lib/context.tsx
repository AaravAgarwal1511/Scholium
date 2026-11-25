import { createContext, useContext, useEffect, useRef, useState } from "react";
import type { PostsApi } from "./posts";
import type { InitialState, PageData } from "./pageData";

interface BlogContextValue {
  api: PostsApi;
  /** Consumed by the first page that matches its path, then discarded, so a
   *  later client-side navigation back to the same URL refetches fresh data. */
  initial: { current: InitialState | null };
}

const BlogContext = createContext<BlogContextValue | null>(null);

export function BlogProvider({
  api,
  initial,
  children,
}: {
  api: PostsApi;
  initial: InitialState | null;
  children: React.ReactNode;
}) {
  const ref = useRef<InitialState | null>(initial);
  return <BlogContext.Provider value={{ api, initial: ref }}>{children}</BlogContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useBlog(): BlogContextValue {
  const ctx = useContext(BlogContext);
  if (!ctx) throw new Error("useBlog outside BlogProvider");
  return ctx;
}

export type Load =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; data: PageData };

/** Page data for `path`: the server's copy on first render, a fetch otherwise. */
// eslint-disable-next-line react-refresh/only-export-components
export function usePageData(path: string, load: (api: PostsApi) => Promise<PageData>): Load {
  const { api, initial } = useBlog();
  const [state, setState] = useState<Load>(() => {
    const hit = initial.current;
    return hit && hit.path === path ? { status: "ready", data: hit.data } : { status: "loading" };
  });

  useEffect(() => {
    // Still on the server-rendered URL: nothing to fetch. (Kept rather than
    // cleared here, so StrictMode's dev double-run doesn't trigger a refetch.)
    if (initial.current?.path === path) return;
    initial.current = null; // first navigation away; from now on every page fetches

    let alive = true;
    setState({ status: "loading" });
    load(api).then(
      (data) => alive && setState({ status: "ready", data }),
      (e: unknown) =>
        alive && setState({ status: "error", message: e instanceof Error ? e.message : String(e) }),
    );
    return () => {
      alive = false;
    };
    // `load` is a fresh closure each render but depends only on `path`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [api, path]);

  return state;
}
