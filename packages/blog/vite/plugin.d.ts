import type { Plugin } from "vite";

export interface BlogPluginOptions {
  /** The host's blog template, relative to the Vite root. Default "blog.html". */
  html?: string;
  /** Where the server function is built, relative to the Vite root. Default "dist-server". */
  serverOutDir?: string;
}

export function blog(options?: BlogPluginOptions): Plugin;

/** "/blog" → "/", "/blog/x" → "/x"; null when the path is not the blog's. */
export function blogPath(pathname: string): string | null;
