// vitest/config, not vite: this package does not depend on vite (it ships raw TS).
import { defineConfig } from 'vitest/config';

// core.ts is the framework-free, fully-injectable heart of the analytics package
// and is the part worth a coverage floor. AnalyticsProvider.tsx (the React wiring
// around it) and the thin hooks are not yet covered and are excluded from the
// gate rather than dragging the threshold down to meaninglessness.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      include: ['src/core.ts'],
      thresholds: { lines: 85, functions: 75, statements: 85, branches: 78 },
    },
  },
});
