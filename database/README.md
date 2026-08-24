# Database

The **single source of truth** for every migration in the project — all app schemas included. Everything
here runs against the shared Supabase project (production: `ritfwedtjiotfxdmuief.supabase.co`; see
`../supabase/config.toml` and the staging/local setup below for the non-prod targets).

- **RecallApp** tables live here (instead of inside LanguageHub) because LanguageHub doesn't query them.
- **AdminDashboard**-only RPCs (`admin_*`, `get_user_stats`) live here because no user-facing app calls them.
- **LanguageHub**'s own tables (`vocabulary_sets`, `vocabulary_items`, `set_progress`, `folders`) also live
  here — `20251203142017_...sql` through `20260419000000_add_folders.sql`. They used to sit in a separate
  `apps/language-hub/supabase/migrations/` with their own `config.toml` pinning an orphaned project ref
  (`frwsezwwegfdxpaasjin`, not part of this Supabase org). That split predated the apps sharing one
  instance and was folded back in so `database/migrations/` is complete on its own — a prerequisite for
  local/staging environments to reproduce production exactly. RecallApp has no other app-only schema.

## Layout

```
migrations/   -- apply in filename order
queries/      -- ad-hoc SQL for the Supabase SQL editor
```

## Migrations (in order)

Pre-existing gap: this table stops at the first five shared migrations and was never kept current as the
set grew past 40 files — see `migrations/` for the full, authoritative list.

| File | Purpose | Used by |
| --- | --- | --- |
| `20260421000000_recall_tables.sql` | Creates `recall_chapters`, `recall_cards`, `recall_progress` with RLS and seed content | RecallApp (reads), AdminDashboard (writes via RPC) |
| `20260421010000_admin_stats_rpc.sql` | `get_user_stats()` — per-user activity aggregates, admin-gated | AdminDashboard |
| `20260422000000_admin_recall_rpcs.sql` | `_assert_admin`, `admin_save_chapter`, `admin_delete_chapter`, `admin_rename_section`, `admin_rename_subject` | AdminDashboard |
| `20260422010000_recall_disabled.sql` | `recall_disabled` table + `admin_set_disabled()` RPC | AdminDashboard (writes), RecallApp (reads to filter hidden sections) |
| `20260422020000_fix_rpc_param_order.sql` | Re-declares the admin RPCs with parameter names in alphabetical order so PostgREST's named-argument lookup resolves them | AdminDashboard |

All admin RPCs are `SECURITY DEFINER` and check `auth.uid()` against the admin email — clients call them with the shared publishable key.

## Queries

| File | Purpose |
| --- | --- |
| `queries/user_stats.sql` | Ad-hoc SQL equivalent of `get_user_stats()` — run in the Supabase SQL editor when you want the report without opening AdminDashboard |

## Applying

**Never apply a migration to production by hand (SQL editor or a local `db push`).** Order matters —
`fix_rpc_param_order.sql` replaces functions defined in the earlier admin migrations and assumes
`_assert_admin` exists (it recreates it defensively, so re-applying is safe) — and a hand-run migration is
exactly how that ordering assumption gets silently violated.

The path to production is:

1. **Local** — `pnpm db:reset` runs every migration plus `seed.sql` against a disposable Dockerized
   Postgres (`supabase start`). This is where you iterate and where a bad migration should first fail.
2. **Staging** — on every PR touching `database/**`, `.github/workflows/db-migrations.yml` applies the
   migration set to a dedicated staging Supabase project and runs `pnpm test:db` against it.
3. **Production** — only on merge to `main`, the same workflow applies the migrations to production,
   gated behind a required-reviewer approval on the `production` GitHub Environment.

`queries/*.sql` is the one exception — those are read-only, ad-hoc, and still meant to be pasted into the
SQL editor.
