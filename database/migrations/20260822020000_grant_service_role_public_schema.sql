-- service_role has zero table privileges locally, despite rolbypassrls = true.
--
-- BYPASSRLS only skips row-level security policies — Postgres still checks the
-- base table-level GRANT independently, and nothing in this migration history
-- ever gave service_role one explicitly. On Supabase Cloud this is invisible
-- because the platform bootstraps every new project with service_role already
-- holding full privileges; the local CLI (and, by extension, staging/CI) does
-- not replicate that bootstrap, so every service-role-authenticated write here
-- fails outright.
--
-- Discovered running database/scripts (build-paper-index.js) against a fresh
-- local reset: "permission denied for table paper_files" while clearing it
-- with the service-role key, before ever touching RLS.
--
-- Blanket, not per-table, and matches Cloud's own bootstrap: service_role is
-- the trusted backend credential (server.js handlers, cron jobs, indexing
-- scripts) and is meant to be able to do anything. The DEFAULT PRIVILEGES
-- clauses mean a future `CREATE TABLE` doesn't reopen this gap.
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO service_role;
GRANT ALL ON ALL ROUTINES IN SCHEMA public TO service_role;

ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON ROUTINES TO service_role;
