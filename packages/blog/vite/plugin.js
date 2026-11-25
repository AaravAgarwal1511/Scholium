// `@repo/blog/vite`: mounts the blog at /blog in a host app, server-rendered in
// every mode. Plain JS (with plugin.d.ts) because Node loads it directly while
// Vite bundles the host's vite.config.ts.
//
//   vite dev      /blog/* is rendered by src/server.tsx through ssrLoadModule, with
//                 the host's blog.html as the template (HMR still works on hydrate).
//   vite build    adds blog.html as a second HTML entry; after the client build,
//                 bundles src/vercel.ts (all deps inlined, the built blog.html baked
//                 in) to <serverOutDir>/blog.js, then deletes dist/blog.html so it
//                 can never be served as an empty shell. The app's api/blog.js
//                 re-exports that file.
//   vite preview  /blog/* goes through that built function, as on Vercel.

import { readFileSync, rmSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { build, loadEnv } from "vite";

const here = path.dirname(fileURLToPath(import.meta.url));
const SERVER_ENTRY = path.resolve(here, "../src/server.tsx");
const VERCEL_ENTRY = path.resolve(here, "../src/vercel.ts");
const TEMPLATE_ID = "virtual:blog-template";
const MARKERS = ["<!--head:start-->", "<!--head:end-->", "<!--app-html-->", "<!--app-data-->"];
const ENV_KEYS = ["VITE_SUPABASE_URL", "VITE_SUPABASE_PUBLISHABLE_KEY", "BLOG_SITE_URL"];

/** "/blog" → "/", "/blog/x" → "/x"; null when the path is not the blog's. */
export function blogPath(pathname) {
  if (pathname === "/blog") return "/";
  if (pathname.startsWith("/blog/")) return pathname.slice("/blog".length);
  return null;
}

/** @param {{ html?: string, serverOutDir?: string }} [options] */
export function blog({ html = "blog.html", serverOutDir = "dist-server" } = {}) {
  /** @type {import("vite").ResolvedConfig} */
  let config;

  return {
    name: "repo-blog",

    config(user, env) {
      if (env.isSsrBuild) return; // the nested server build below
      const root = path.resolve(user.root ?? process.cwd());
      return {
        build: {
          rollupOptions: {
            input: { main: path.join(root, "index.html"), blog: path.join(root, html) },
          },
        },
      };
    },

    configResolved(resolved) {
      config = resolved;
    },

    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const url = req.originalUrl ?? req.url ?? "/";
        const appPath = blogPath(new URL(url, "http://localhost").pathname);
        if (!appPath) return next();
        try {
          const env = loadEnv(server.config.mode, server.config.envDir, "");
          const raw = readFileSync(path.resolve(server.config.root, html), "utf8");
          const template = await server.transformIndexHtml(url, raw, req.originalUrl);
          const { handleRequest } = await server.ssrLoadModule(SERVER_ENTRY);
          const result = await handleRequest({
            pathname: appPath,
            origin: `http://${req.headers.host ?? "localhost"}`,
            supabase: { url: env.VITE_SUPABASE_URL, key: env.VITE_SUPABASE_PUBLISHABLE_KEY },
            template,
          });
          res.statusCode = result.status;
          for (const [k, v] of Object.entries(result.headers)) res.setHeader(k, v);
          res.end(result.body);
        } catch (e) {
          server.ssrFixStacktrace(e);
          next(e);
        }
      });
    },

    async closeBundle() {
      if (config.command !== "build" || config.build.ssr) return;
      const outDir = path.resolve(config.root, config.build.outDir);
      const builtHtml = path.join(outDir, html);
      const template = readFileSync(builtHtml, "utf8");
      for (const m of MARKERS) {
        if (!template.includes(m)) throw new Error(`@repo/blog: ${m} is missing from ${html}; the server renderer needs it.`);
      }

      await build({
        configFile: config.configFile,
        root: config.root,
        mode: config.mode,
        logLevel: "warn",
        plugins: [
          {
            name: "repo-blog-template",
            resolveId: (id) => (id === TEMPLATE_ID ? "\0" + TEMPLATE_ID : undefined),
            load: (id) => (id === "\0" + TEMPLATE_ID ? `export default ${JSON.stringify(template)};` : undefined),
          },
        ],
        // One self-contained file: Vercel's function bundler only has to trace a
        // single import, and nothing is needed from node_modules at runtime.
        ssr: { noExternal: true },
        build: {
          ssr: VERCEL_ENTRY,
          outDir: path.resolve(config.root, serverOutDir),
          emptyOutDir: true,
          copyPublicDir: false,
          rollupOptions: { output: { entryFileNames: "blog.js" } },
        },
      });
      rmSync(builtHtml);
      config.logger.info(`@repo/blog: ${serverOutDir}/blog.js built, ${html} removed from ${config.build.outDir}`);
    },

    configurePreviewServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const { pathname } = new URL(req.url ?? "/", "http://localhost");
        const appPath = blogPath(pathname);
        if (!appPath) return next();
        try {
          const env = loadEnv(server.config.mode, server.config.envDir, "");
          for (const k of ENV_KEYS) if (env[k]) process.env[k] ??= env[k];
          const fn = path.resolve(server.config.root, serverOutDir, "blog.js");
          const { default: handler } = await import(pathToFileURL(fn).href);
          req.headers["x-forwarded-proto"] ??= "http"; // Vercel sets it; preview doesn't
          req.url = `/api/blog?path=${encodeURIComponent(appPath)}`;
          await handler(req, res);
        } catch (e) {
          next(e);
        }
      });
    },
  };
}
