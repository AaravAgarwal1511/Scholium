/// <reference types="vitest/config" />
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";

export default defineConfig({
  server: {
    host: "::",
    port: 3050,
  },
  plugins: [react()],
  resolve: {
    alias: { "@": path.resolve(__dirname, "./src") },
    dedupe: ["react", "react-dom"],
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    // Ratchet floor over the exam-logic library (src/lib). Set just below the
    // current measured coverage so a drop — untested new logic — fails, without
    // forcing coverage of the browser-only modules (pdfRender, domSelection,
    // paperStorage) that can't run under the node test env. Raise it as those
    // get covered; never lower it silently.
    coverage: {
      provider: "v8",
      include: ["src/lib/**"],
      exclude: ["src/lib/**/*.test.ts"],
      thresholds: { lines: 58, functions: 52, statements: 58, branches: 42 },
    },
  },
});
