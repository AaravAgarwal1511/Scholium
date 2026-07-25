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
  },
});
