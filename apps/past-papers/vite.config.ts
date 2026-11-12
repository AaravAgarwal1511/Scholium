/// <reference types="vitest/config" />
import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { readFileSync } from "fs";

// createRoot().render() (src/main.tsx) replaces #root's children on mount, so
// whatever ships inside it in the built index.html is exactly what a
// non-JS-executing crawler sees before that swap. scripts/build-subject-pages.js
// (run before this config, see package.json's `build` script) writes that
// markup to .seo-build/homepage-fallback.html; this plugin splices it into the
// built HTML only — it never touches the committed index.html on disk, and a
// missing fragment (e.g. `vite dev`, or `vite build` run standalone without
// the pre-step) degrades to the empty div this app already ships today.
function injectHomepageFallback(): Plugin {
  const fragmentPath = path.resolve(__dirname, ".seo-build/homepage-fallback.html");
  return {
    name: "inject-homepage-fallback",
    transformIndexHtml(html) {
      let fragment = "";
      try {
        fragment = readFileSync(fragmentPath, "utf-8");
      } catch {
        // Not generated this run — leave #root empty, same as before this plugin existed.
      }
      return fragment ? html.replace('<div id="root"></div>', `<div id="root">${fragment}</div>`) : html;
    },
  };
}

export default defineConfig({
  // Subject-first suite: this tool is served from /past-papers/ on the shared origin.
  base: "/past-papers/",
  server: {
    host: "::",
    port: 3040,
    // Suite mode: pages arrive via scholium-home's proxy (localhost:3030), so
    // point the HMR socket straight at this server.
    hmr: { clientPort: 3040 },
    proxy: {
      // Mounted under /past-papers/ in suite mode, so its API is too — two tools
      // can't both own /api on one origin.
      "/past-papers/api": {
        target: "http://localhost:3002",
        changeOrigin: true,
        rewrite: (p: string) => p.replace(/^\/past-papers/, ""),
      },
      "/api": {
        target: "http://localhost:3002",
        changeOrigin: true,
      },
    },
  },
  plugins: [react(), injectHomepageFallback()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
    dedupe: ["react", "react-dom"],
  },
  test: {
    projects: [
      {
        extends: true,
        test: {
          name: "unit",
          environment: "jsdom",
          include: ["src/**/*.test.{ts,tsx}"],
        },
      },
      {
        // The Express/serverless half of the app. Plain Node ESM, no Vite
        // transform and no DOM — it never runs in a browser.
        extends: true,
        test: {
          name: "server",
          environment: "node",
          include: ["server/**/*.test.js", "api/**/*.test.js"],
        },
      },
    ],
  },
});
