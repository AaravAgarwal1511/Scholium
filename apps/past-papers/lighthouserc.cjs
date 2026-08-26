// Lighthouse CI for past-papers' PUBLIC surface — unlike the other four gated
// apps, browsing here is NOT auth-gated (see CLAUDE.md), so this covers the
// homepage plus the static /papers/* and /terms pages the SEO audit added,
// the same way scholium-home covers the marketing site and recall-app covers
// its public /signin and /demo. Runs against a production build in --mode
// test (committed .env.test, no secrets) served by `vite preview`.
//
// Budgets calibrated from measured medians across /, /papers/0455,
// /papers/0455/paper-1, a topic page, and /terms (desktop, 3 runs each):
// perf 0.98–1.00, a11y 0.96, best-practices 0.96, seo 1.00. Held at 0.9, well
// below all four, so a real regression (a dropped meta tag, a heavy new
// dependency, an unlabelled control, the homepage fallback fragment breaking
// CLS) fails while run-to-run Lighthouse noise does not.
// Run: pnpm --filter past-papers lighthouse
module.exports = {
  ci: {
    collect: {
      startServerCommand: 'pnpm exec vite preview --port 4275',
      url: [
        'http://localhost:4275/',
        'http://localhost:4275/papers/0455',
        'http://localhost:4275/papers/0455/paper-1',
        'http://localhost:4275/papers/0455/topics/fiscal-policy',
        'http://localhost:4275/terms',
      ],
      numberOfRuns: 3,
      settings: { preset: 'desktop' },
    },
    assert: {
      assertions: {
        'categories:performance': ['error', { minScore: 0.9 }],
        'categories:accessibility': ['error', { minScore: 0.9 }],
        'categories:best-practices': ['error', { minScore: 0.9 }],
        'categories:seo': ['error', { minScore: 0.9 }],
      },
    },
    upload: {
      target: 'filesystem',
      outputDir: './.lighthouseci',
    },
  },
};
