-- Blog posts for the /blog route (packages/blog). Written only by the admin, through the RPCs below,
-- from the Blog tab in admin/. Read by everyone, but only once published.
--
--   published_at IS NULL          → draft, visible to the admin only
--   published_at <= now()         → live
--   published_at  > now()         → scheduled; hidden until that moment
--
-- The anon key ships in every client bundle, so the read policy is the only thing
-- keeping drafts private. There are deliberately NO insert/update/delete policies:
-- every write goes through a SECURITY DEFINER function that calls _assert_admin().
--
-- "Is this the admin?" has exactly one answer in this database: _assert_admin().
-- Its live definition (20260724000000) checks the caller's auth.users email; an
-- older one (20260423000000) checked a JWT app_metadata claim. The read policy and
-- the storage policies below must agree with whichever is live, so they ask
-- _is_admin() — a boolean wrapper around _assert_admin() — instead of restating a
-- check that could drift from it.

-- ── _is_admin(): _assert_admin() as a boolean, for use in policies ────────────
CREATE OR REPLACE FUNCTION public._is_admin()
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public._assert_admin();
  RETURN true;
EXCEPTION WHEN OTHERS THEN
  RETURN false;
END;
$$;

-- Policies run as the caller, so anon/authenticated must be able to execute it.
-- It only ever answers a question about the caller themselves.
REVOKE EXECUTE ON FUNCTION public._is_admin() FROM public;
GRANT  EXECUTE ON FUNCTION public._is_admin() TO anon, authenticated;

-- ── blog_posts ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.blog_posts (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug             text NOT NULL UNIQUE
                     CHECK (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' AND length(slug) <= 120),
  title            text NOT NULL CHECK (length(btrim(title)) > 0),
  excerpt          text,
  body_md          text NOT NULL DEFAULT '',
  cover_image_path text,                          -- object path inside the blog-images bucket
  tags             text[] NOT NULL DEFAULT '{}',
  author_name      text,
  published_at     timestamptz,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_blog_posts_published_at
  ON public.blog_posts (published_at DESC NULLS LAST);

-- ── RLS ──────────────────────────────────────────────────────────────────────
ALTER TABLE public.blog_posts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "blog_posts: read published, admin reads all" ON public.blog_posts;
CREATE POLICY "blog_posts: read published, admin reads all"
  ON public.blog_posts FOR SELECT
  USING (
    (published_at IS NOT NULL AND published_at <= now())
    -- (SELECT …) makes Postgres evaluate it once per query, not once per row.
    OR (SELECT public._is_admin())
  );

-- Reads only. Writes are RPC-only, so take the table-level write grants away too:
-- with RLS on and no write policy they would be refused anyway, but a grant that
-- can never be used is just a future policy away from being one that can.
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.blog_posts FROM anon, authenticated;
GRANT SELECT ON public.blog_posts TO anon, authenticated;

-- ── Admin RPCs ───────────────────────────────────────────────────────────────
-- Insert (p_id NULL) or update a post's content. Does not touch published_at:
-- publishing is its own call so that saving an edit can never publish a draft
-- or unpublish a live post by accident. Returns the post id.
CREATE OR REPLACE FUNCTION public.admin_save_blog_post(
  p_id               uuid,
  p_slug             text,
  p_title            text,
  p_excerpt          text,
  p_body_md          text,
  p_cover_image_path text,
  p_tags             text[],
  p_author_name      text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
BEGIN
  PERFORM public._assert_admin();

  IF p_id IS NULL THEN
    INSERT INTO public.blog_posts
      (slug, title, excerpt, body_md, cover_image_path, tags, author_name)
    VALUES
      (p_slug, p_title, NULLIF(btrim(p_excerpt), ''), COALESCE(p_body_md, ''),
       NULLIF(p_cover_image_path, ''), COALESCE(p_tags, '{}'), NULLIF(btrim(p_author_name), ''))
    RETURNING id INTO v_id;
  ELSE
    UPDATE public.blog_posts SET
      slug             = p_slug,
      title            = p_title,
      excerpt          = NULLIF(btrim(p_excerpt), ''),
      body_md          = COALESCE(p_body_md, ''),
      cover_image_path = NULLIF(p_cover_image_path, ''),
      tags             = COALESCE(p_tags, '{}'),
      author_name      = NULLIF(btrim(p_author_name), ''),
      updated_at       = now()
    WHERE id = p_id
    RETURNING id INTO v_id;

    IF v_id IS NULL THEN
      RAISE EXCEPTION 'blog post % not found', p_id;
    END IF;
  END IF;

  RETURN v_id;
END;
$$;

-- Publish (stamps now(), keeping the original date on a re-publish of an already
-- dated post) or unpublish (back to draft).
CREATE OR REPLACE FUNCTION public.admin_set_blog_post_published(
  p_id        uuid,
  p_published boolean
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public._assert_admin();
  UPDATE public.blog_posts
     SET published_at = CASE WHEN p_published THEN COALESCE(published_at, now()) ELSE NULL END,
         updated_at   = now()
   WHERE id = p_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_delete_blog_post(p_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public._assert_admin();
  DELETE FROM public.blog_posts WHERE id = p_id;
END;
$$;

-- Supabase grants EXECUTE directly to anon and authenticated, and a REVOKE aimed at
-- PUBLIC does not touch those direct grants (see CLAUDE.md). Revoke by name, then
-- give back only what the admin dashboard needs: it signs in, so `authenticated`.
REVOKE EXECUTE ON FUNCTION public.admin_save_blog_post(uuid, text, text, text, text, text, text[], text) FROM public, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.admin_set_blog_post_published(uuid, boolean)                          FROM public, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.admin_delete_blog_post(uuid)                                          FROM public, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.admin_save_blog_post(uuid, text, text, text, text, text, text[], text) TO authenticated;
GRANT  EXECUTE ON FUNCTION public.admin_set_blog_post_published(uuid, boolean)                          TO authenticated;
GRANT  EXECUTE ON FUNCTION public.admin_delete_blog_post(uuid)                                          TO authenticated;

-- ── blog-images bucket ───────────────────────────────────────────────────────
-- Cover and inline images. Public read so posts render for signed-out readers and
-- crawlers; uploads/replacements/deletes are admin-only.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('blog-images', 'blog-images', true, 5242880,                -- 5 MB per file
        ARRAY['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'image/avif'])
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "blog-images: public read" ON storage.objects;
CREATE POLICY "blog-images: public read"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'blog-images');

DROP POLICY IF EXISTS "blog-images: admin insert" ON storage.objects;
CREATE POLICY "blog-images: admin insert"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'blog-images'
    AND (SELECT public._is_admin())
  );

DROP POLICY IF EXISTS "blog-images: admin update" ON storage.objects;
CREATE POLICY "blog-images: admin update"
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'blog-images'
    AND (SELECT public._is_admin())
  );

DROP POLICY IF EXISTS "blog-images: admin delete" ON storage.objects;
CREATE POLICY "blog-images: admin delete"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'blog-images'
    AND (SELECT public._is_admin())
  );
