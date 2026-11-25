import { defineConfig } from "vitest/config";

export default defineConfig({
  // @repo/ui resolves its own React 19 devDependency; one copy, as the host apps do.
  resolve: { dedupe: ["react", "react-dom", "react-router-dom"] },
  test: {
    projects: [
      {
        extends: true,
        test: {
          name: "unit",
          environment: "jsdom",
          include: ["src/**/*.test.{ts,tsx}"],
          exclude: ["src/**/*.server.test.{ts,tsx}"],
        },
      },
      {
        extends: true,
        test: {
          name: "server",
          environment: "node",
          include: ["src/**/*.server.test.{ts,tsx}", "vite/**/*.test.js"],
        },
      },
    ],
  },
});
