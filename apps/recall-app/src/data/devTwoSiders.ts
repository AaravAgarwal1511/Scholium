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
// Add essays here freely; prefix ids `dev-` so they can never collide with a
// real row, and use the 🧪 emoji to mark them in the dashboard list. `subject`
// must name a real subject tab (matched slugified against the subject's id or
// name, see TwoSiderLauncher) — the dashboard only lists the essays belonging
// to the open tab, so a placeholder label here shows nowhere.
export const DEV_TWO_SIDERS: TwoSider[] = [];
