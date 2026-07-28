/// <reference types="vitest/config" />
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";
import { storybookTest } from '@storybook/addon-vitest/vitest-plugin';
import { playwright } from '@vitest/browser-playwright';

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
    proxy: {
      "/api": {
        target: "http://localhost:3000",
        changeOrigin: true,
      },
    },
  },
  appType: 'spa',
  plugins: [react(), mode === "development" && componentTagger()].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
    dedupe: ["react", "react-dom"],
  },
  test: {
    projects: [{
      // Plain unit tests. Kept as its own project because a `projects` array
      // replaces the root-level `include` — without this entry, src/**/*.test.ts
      // is collected by nothing and passes silently.
      extends: true,
      test: {
        name: 'unit',
        environment: 'jsdom',
        include: ['src/**/*.test.{ts,tsx}'],
      },
    }, {
      extends: true,
      plugins: [storybookTest({ configDir: path.resolve(__dirname, '.storybook') })],
      test: {
        name: 'storybook',
        browser: {
          enabled: true,
          headless: true,
          provider: playwright({}),
          instances: [{ browser: 'chromium' }],
        },
      },
    }],
  },
}));
