/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// This package ships raw TS source (no build step), so there is no vite.config.ts
// to hang a `test` block off — hence a standalone vitest config.
export default defineConfig({
  plugins: [react()],
  resolve: {
    // Matches @repo/ui and every app: without it the React-18 copies pulled in for
    // the older apps can be resolved against this package's React 19.
    dedupe: ['react', 'react-dom'],
  },
  test: {
    // Every hook here reads or writes the browser (localStorage, matchMedia,
    // classList, MutationObserver), so a DOM is not optional.
    environment: 'jsdom',
    include: ['src/**/*.test.{ts,tsx}'],
  },
});
