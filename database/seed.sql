-- Seed data for local Supabase (`supabase db reset`) and the staging project.
--
-- Loaded per supabase/config.toml's [db.seed] block, after every migration in
-- database/migrations/ has applied. Never run this against production — nothing
-- here should ever be reachable from a prod connection string.
--
-- Two fixed-UUID users on purpose: the RLS suite (database/tests/rls-isolation.test.ts)
-- needs one signed-in caller to be unable to reach another's rows. Against prod it
-- discovers two real ids at run time because no fixed ids exist there; against
-- local/staging these two rows mean it never has to.
--
-- A third user, seed-admin@example.com, exists solely to pass _assert_admin()
-- (database/migrations/20260724000000_fix_assert_admin_null_bypass.sql), which
-- gates every admin_* RPC and get_user_stats() on auth.uid()'s email exactly
-- matching a hardcoded address — without this row, admin/ has nothing that can
-- authorize locally.
--
-- recall_chapters and recall_cards are NOT seeded here — they're static content
-- already inserted by 20260421000000_recall_tables.sql. This file only adds the
-- per-user and app-registry rows a fresh database has no other way to get.
--
-- mock_attempts is deliberately NOT seeded: every row's `pages`/`boxes` refer to a
-- question paper PDF that lives in the mock-space-papers Storage bucket, and a SQL
-- seed can't upload a real object. A row with no matching paper would just be a
-- guaranteed 404 in the app. Exercise that flow with the /demo route instead
-- (apps/mock-space/src/pages/Demo.tsx) — it's signed-out and ephemeral by design.

-- ── auth.users ───────────────────────────────────────────────────────────────
-- Standard local-dev recipe: GoTrue reads auth.users/auth.identities directly, so
-- inserting both by hand is how you get a working signed-in session without going
-- through a real signup flow. Empty-string tokens (not NULL) match what GoTrue
-- itself writes, avoiding a few known local-CLI edge cases.
insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, last_sign_in_at,
  raw_app_meta_data, raw_user_meta_data,
  created_at, updated_at,
  confirmation_token, email_change, email_change_token_new, recovery_token
) values
  (
    '00000000-0000-0000-0000-000000000000',
    '11111111-1111-1111-1111-111111111111',
    'authenticated', 'authenticated',
    'seed-user-1@example.com',
    crypt('seed-password-1', gen_salt('bf')),
    now(), now(),
    '{"provider":"email","providers":["email"]}', '{}',
    now(), now(),
    '', '', '', ''
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    '22222222-2222-2222-2222-222222222222',
    'authenticated', 'authenticated',
    'seed-user-2@example.com',
    crypt('seed-password-2', gen_salt('bf')),
    now(), now(),
    '{"provider":"email","providers":["email"]}', '{}',
    now(), now(),
    '', '', '', ''
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    '33333333-3333-3333-3333-333333333333',
    'authenticated', 'authenticated',
    -- Must match _assert_admin()'s hardcoded check exactly — not an
    -- example.com placeholder, since the RPC compares real email strings.
    'aaravagarwal.1511@gmail.com',
    crypt('seed-password-admin', gen_salt('bf')),
    now(), now(),
    '{"provider":"email","providers":["email"]}', '{}',
    now(), now(),
    '', '', '', ''
  );

insert into auth.identities (
  id, user_id, provider_id, identity_data, provider,
  last_sign_in_at, created_at, updated_at
) values
  (
    gen_random_uuid(), '11111111-1111-1111-1111-111111111111',
    '11111111-1111-1111-1111-111111111111',
    jsonb_build_object('sub', '11111111-1111-1111-1111-111111111111', 'email', 'seed-user-1@example.com'),
    'email', now(), now(), now()
  ),
  (
    gen_random_uuid(), '22222222-2222-2222-2222-222222222222',
    '22222222-2222-2222-2222-222222222222',
    jsonb_build_object('sub', '22222222-2222-2222-2222-222222222222', 'email', 'seed-user-2@example.com'),
    'email', now(), now(), now()
  ),
  (
    gen_random_uuid(), '33333333-3333-3333-3333-333333333333',
    '33333333-3333-3333-3333-333333333333',
    jsonb_build_object('sub', '33333333-3333-3333-3333-333333333333', 'email', 'aaravagarwal.1511@gmail.com'),
    'email', now(), now(), now()
  );

-- ── scholium_apps ────────────────────────────────────────────────────────────
-- Every app's navbar reads this for the cross-app switcher, and scholium-home's
-- SubjectPicker reads it signed out — so a local/staging environment with an
-- empty table renders a broken nav on every page. Seven rows, one per app. ids
-- match the slugs 20260613000000_scholium_apps_tags.sql filters on
-- ('language-hub', 'recall-app', 'poetry-notes').
insert into public.scholium_apps (id, title, url, icon, description, subjects, has_demo, no_login, sort_order) values
  ('language-hub',  'Language Hub',  'http://127.0.0.1:8080', '🗣️', 'Vocabulary sets and flashcard practice.',        '{"French","Spanish"}',      false, false, 1),
  ('recall-app',    'Recall',        'http://127.0.0.1:8081', '🧠', 'Spaced-repetition revision cards.',              '{"Physics","Economics"}',   false, false, 2),
  ('poetry-notes',  'Poetry Notes',  'http://127.0.0.1:5173', '📓', 'Rich-text notes for poetry study.',              '{"English Literature"}',    false, false, 3),
  ('past-papers',   'Past Papers',   'http://127.0.0.1:3040', '📄', 'Browse and generate past exam papers.',          '{"Mathematics"}',           false, true,  4),
  ('mock-space',    'Mock Space',    'http://127.0.0.1:3050', '⏱️', 'Sit a past paper under timed exam conditions.',  '{"Mathematics"}',           true,  false, 5),
  ('scholium-home', 'Scholium Home', 'http://127.0.0.1:3030', '🏠', 'The Scholium suite landing page.',               '{}',                        false, true,  6),
  ('notes',         'Notes',         'http://127.0.0.1:3060', '📝', 'Study notes for a range of subjects, as PDFs.',  '{}',                        false, false, 7);

-- ── user_prefs ───────────────────────────────────────────────────────────────
insert into public.user_prefs (user_id, analytics_opt_out) values
  ('11111111-1111-1111-1111-111111111111', false),
  ('22222222-2222-2222-2222-222222222222', true);

-- ── recall_progress ──────────────────────────────────────────────────────────
-- One user with progress on a couple of chapters; the other with none, so the
-- app's empty state is exercised too.
insert into public.recall_progress (user_id, chapter_id, pass) values
  ('11111111-1111-1111-1111-111111111111', 'ph-kinematics', 3),
  ('11111111-1111-1111-1111-111111111111', 'eco-demand', 2);

-- ── questions_metadata ───────────────────────────────────────────────────────
-- A handful of rows so Past Papers has something to index and browse locally.
-- No y_start/y_end/ms_y_start/ms_y_end — 20260709000000_questions_metadata_drop_coords.sql
-- removed them; crop geometry now comes from the R2 index files instead. subject
-- is required (PK is now (subject, id)) — '0607' (International Mathematics)
-- matches what 20260615000000_questions_metadata_subject.sql backfilled onto
-- every pre-existing row.
insert into public.questions_metadata (id, subject, paper, question_number, chapter_name, chapter_num, sub_topic) values
  ('P2-Q001', '0607', 'June-2020-2', '1', 'Number', 1, 'Fractions and percentages'),
  ('P2-Q002', '0607', 'June-2020-2', '2', 'Algebra', 2, 'Solving linear equations'),
  ('P2-Q003', '0607', 'November-2020-2', '1', 'Number', 1, 'Standard form');
