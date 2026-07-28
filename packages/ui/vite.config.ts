/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { storybookTest } from '@storybook/addon-vitest/vitest-plugin';
import { playwright } from '@vitest/browser-playwright';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default defineConfig({
  plugins: [react()],
  resolve: {
    // Without this the storybook test env resolves react-dom@18 (pulled in for the
    // React-18 apps) against this package's react@19, and every story render fails
    // with "Objects are not valid as a React child". All five apps dedupe likewise.
    dedupe: ['react', 'react-dom'],
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
