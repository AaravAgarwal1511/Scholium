# AdminDashboard

Admin web UI for the shared Supabase project.

- **Stats tab** — total users, 7d/30d active, per-user activity (via `get_user_stats()` RPC).
- **Content tab** — browse RecallApp data as Subject → Section → Chapter and edit each chapter's cards with a `Term : Definition` textarea (supports `:`, `-`, `=` as separators, same as LanguageHub's CreateSet).

## Setup

1. Apply every migration in `database/migrations/` in filename order (see [`database/README.md`](../database/README.md)).
2. Install + run:
   ```
   cd admin
   npm install
   npm run dev
   ```
3. Open http://localhost:5180 and sign in with the admin email.

Writes use `SECURITY DEFINER` RPCs that check `auth.uid()` against the admin email, so the shared publishable key is all that's needed on the client. `recall_chapters` / `recall_cards` stay locked down by RLS for every other user.

## Bulk queries
`database/queries/user_stats.sql` has the raw SQL if you'd rather run it in the Supabase SQL editor.
