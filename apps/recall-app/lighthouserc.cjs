// Lighthouse CI for recall-app's PUBLIC pages — /signin and /demo render before
// any auth, so Lighthouse (which runs its own Chrome and can't use the network
// stubs) can reach them without a session. This extends the budgets beyond the
// scholium-home marketing site to a gated app's public surface, notably the
// shared AuthCard. Runs against a production build in --mode test (committed
// .env.test, no secrets) served by `vite preview`.
//
// Budgets are calibrated from measured medians (see below) and held below them.
// Run: pnpm --filter recall-app lighthouse
module.exports = {
  ci: {
    collect: {
      startServerCommand: 'pnpm exec vite preview --port 4274',
      url: ['http://localhost:4274/signin', 'http://localhost:4274/demo'],
      numberOfRuns: 3,
      settings: { preset: 'desktop' },
    },
    assert: {
      // Calibrated to measured medians; held below to catch a real regression
      // (a heavy dependency, an unlabelled control) without run-to-run flake.
      // Performance floor is a touch lower than scholium-home's — this is a full
      // app bundle (Supabase client, router), not a static marketing page.
      assertions: {
        'categories:performance': ['error', { minScore: 0.8 }],
        // 0.88, not 0.90: measured 0.91 on /demo is too close to gate at 0.90.
        // Structural a11y is already held at zero serious/critical by the axe e2e
        // gate; this is a secondary signal that catches minor/moderate slippage.
        'categories:accessibility': ['error', { minScore: 0.88 }],
        'categories:best-practices': ['error', { minScore: 0.9 }],
      },
    },
    upload: { target: 'filesystem', outputDir: './.lighthouseci' },
  },
};
