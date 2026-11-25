/// <reference types="vitest/config" />
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { blog } from "@repo/blog/vite";

export default defineConfig({
  server: {
    host: "::",
    port: 3030,
  },
  // /blog is @repo/blog, server-rendered: see packages/blog/vite/plugin.js.
  plugins: [react(), blog()],
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
