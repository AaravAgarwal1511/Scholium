/// <reference types="vitest/config" />
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";

// Subject-first multi-zone simulation. scholium-home is the one origin
// (localhost:3030); every tool keeps its own dev server and is reached through
// these proxies, exactly as Vercel rewrites would route it in production:
//
//   /:subject/:mount/...  →  tool dev server at /:mount/...   (page requests)
//   /:mount/...           →  tool dev server                  (assets, /api)
//
// The address bar never leaves localhost:3030, so the Supabase session in
// localStorage is shared by every tool.
const ZONES: Record<string, number> = {
  "language-hub": 8080,
  recall: 8081,
  "past-papers": 3040,
  "poetry-notes": 5173,
};

function zoneProxies() {
  const out: Record<string, object> = {};
  for (const [mount, port] of Object.entries(ZONES)) {
    const target = `http://localhost:${port}`;
    // /physics/recall/... (but never /tools/recall, which is home's own page)
    out[`^/(?!tools/)[^/]+/${mount}(/.*)?$`] = {
      target,
      // Always land inside the tool's base: Vite answers a bare "/recall" with a
      // redirect to "/recall/", which would bounce the browser off the subject URL.
      rewrite: (p: string) => p.replace(new RegExp(`^/[^/]+/${mount}/?`), `/${mount}/`),
    };
    out[`^/${mount}(/.*)?$`] = { target };
  }
  return out;
}

export default defineConfig({
  server: {
    host: "::",
    port: 3030,
    proxy: zoneProxies(),
  },
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
    dedupe: ["react", "react-dom"],
  },
  test: {
    environment: "jsdom",
    include: ["src/**/*.test.{ts,tsx}"],
  },
});
