// vitest/config, not vite: this package ships raw TS and does not depend on vite.
import { defineConfig } from 'vitest/config';

// The scheduling rules and the RPC mapping are the logic worth gating; the React
// wiring is exercised by @repo/ui's stories and the apps' e2e runs.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      include: ['src/schedule.ts', 'src/submit.ts'],
      thresholds: { lines: 90, functions: 90, statements: 90, branches: 80 },
    },
  },
});
