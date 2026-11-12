/// <reference types="vitest/config" />
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { storybookTest } from '@storybook/addon-vitest/vitest-plugin';
import { playwright } from '@vitest/browser-playwright';

export default defineConfig({
  // Subject-first suite: this tool is served from /recall/ on the shared origin.
  base: "/recall/",
  server: {
    host: "::",
    port: 8081,
    // Suite mode: pages arrive via scholium-home's proxy (localhost:3030), so
    // point the HMR socket straight at this server.
    hmr: { clientPort: 8081 },
  },
  plugins: [react()],
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
});
