/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// This package ships raw TS source (no build step), so there is no vite.config.ts
// to hang a `test` block off — hence a standalone vitest config.
export default defineConfig({
  plugins: [react()],
  resolve: {
    dedupe: ['react', 'react-dom'],
  },
  test: {
    // SingleSessionGuard renders and subscribes to Realtime. The Supabase client
    // is injected as a prop, so a fake client covers the network half — but the
    // render half still needs a DOM.
    environment: 'jsdom',
    include: ['src/**/*.test.{ts,tsx}'],
    // High floor — this package is small and nearly fully exercised.
    coverage: {
      provider: 'v8',
      include: ['src/**'],
      exclude: ['src/index.ts', 'src/**/*.test.*'],
      thresholds: { lines: 90, functions: 75, statements: 90, branches: 85 },
    },
  },
});
