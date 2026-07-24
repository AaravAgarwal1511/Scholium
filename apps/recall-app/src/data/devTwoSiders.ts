import type { TwoSider } from "@/types";

// Local-only Two-Sider essays — scratch content for working on the essay drills
// without seeding the database.
//
// This module is only ever reached from a `import.meta.env.DEV` branch in
// useTwoSiders, so `vite build` folds that branch to `false` and drops the
// dynamic import: none of the text below reaches the production bundle, and
// prod shows exactly what recall_two_siders holds. Nothing here is written to
// Supabase — only the localStorage stage progress is, keyed by the ids below.
//
// Add essays here freely; ids are prefixed `dev-` so they can never collide
// with a real row, and the 🧪 emoji marks them in the dashboard list.
export const DEV_TWO_SIDERS: TwoSider[] = [
  {
    id: "dev-four-day-week",
    subject: "Local draft — dev only",
    emoji: "🧪",
    question: "Evaluate the case for and against a four-day working week.",
    // Deliberately lopsided (7 against 4) — the counts are the retrieval cue
    // now, so the two sides should not be the same length in test content. The
    // keyword initials spell nothing, which is the whole point.
    sides: [
      {
        stance: "for",
        label: "FOR a four-day week",
        points: [
          { keyword: "Productivity", point: "Output per hour rises as fatigue falls, so four days can produce close to five days' work." },
          { keyword: "Wellbeing", point: "Shorter weeks cut burnout and sickness absence, lowering the long-run cost to employers." },
          { keyword: "Retention", point: "A cheap non-wage benefit that reduces costly staff turnover and recruitment." },
          { keyword: "Commuting", point: "One fewer commute a week cuts household transport costs and peak-time congestion." },
          { keyword: "Talent pool", point: "Flexible hours draw in carers and parents otherwise priced out of full-time work." },
          { keyword: "Automation", point: "Firms respond by mechanising low-value tasks, raising the capital-to-labour ratio." },
          { keyword: "Emissions", point: "Offices closed a fifth of the week cut heating, lighting and travel emissions." },
        ],
      },
      {
        stance: "against",
        label: "AGAINST a four-day week",
        points: [
          { keyword: "Coverage", point: "Shift-based sectors — hospitals, retail, logistics — cannot simply close for a day." },
          { keyword: "Unit costs", point: "Paying five days' wages for four days' output raises unit labour costs unless productivity fully compensates." },
          { keyword: "Intensification", point: "Compressing the same workload into fewer days can raise stress rather than cut it." },
          { keyword: "Competitiveness", point: "Firms facing foreign rivals on longer weeks may lose orders on lead times." },
        ],
      },
    ],
  },
];
