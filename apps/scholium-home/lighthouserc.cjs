// Lighthouse CI for scholium-home — the public marketing site, the one app where
// Lighthouse's SEO/performance signals genuinely matter and where no auth stands
// in the way. Runs against a PRODUCTION build served by `vite preview`; dev-server
// scores are meaningless (unminified, HMR overhead).
//
// Budgets are set in lighthouserc.assert.cjs, calibrated from measured scores.
// Run: pnpm --filter scholium-home lighthouse
module.exports = {
  ci: {
    collect: {
      // Build first (turbo), then LHCI starts the preview itself.
      startServerCommand: 'pnpm exec vite preview --port 4273',
      url: [
        'http://localhost:4273/',
        'http://localhost:4273/about',
        'http://localhost:4273/memory-science',
      ],
      // Median of 3 runs — single-run Lighthouse scores are noisy.
      numberOfRuns: 3,
      settings: {
        // A desktop profile: this is a study suite used on laptops, and mobile
        // throttling makes SPA scores swing wildly run to run.
        preset: 'desktop',
      },
    },
    assert: {
      // Budgets calibrated from measured medians (desktop): perf 1.00, a11y
      // 0.92–0.96, best-practices 0.96, seo 0.92. Held ~2–10 points below to
      // catch a real regression (a dropped meta tag, a heavy new dependency,
      // an unlabelled control) without flaking on run-to-run Lighthouse noise.
      assertions: {
        'categories:performance': ['error', { minScore: 0.9 }],
        'categories:accessibility': ['error', { minScore: 0.9 }],
        'categories:best-practices': ['error', { minScore: 0.9 }],
        'categories:seo': ['error', { minScore: 0.9 }],
      },
    },
    upload: {
      // Keep reports local; no LHCI server. `filesystem` writes them to disk.
      target: 'filesystem',
      outputDir: './.lighthouseci',
    },
  },
};
