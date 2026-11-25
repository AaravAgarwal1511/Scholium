// Reads blog posts from Supabase over plain PostgREST. No supabase-js: the blog
// never signs anyone in, so all it needs is two GETs with the anon key, and the
// same code runs unchanged in the browser and in the server bundle.
//
// The anon key cannot see drafts — the blog_posts RLS policy only returns rows
// with published_at <= now(). The filter below repeats that so a mis-set policy
// still would not list a draft here; it is not the security boundary.

export interface PostSummary {
  id: string;
  slug: string;
  title: string;
  excerpt: string | null;
  cover_image_path: string | null;
  tags: string[];
  author_name: string | null;
  published_at: string;
  updated_at: string;
}

export interface Post extends PostSummary {
  body_md: string;
}

export interface AppLinkRow {
  id: string;
  title: string;
  url: string;
  icon?: string | null;
}

export interface BlogConfig {
  url: string;
  key: string;
  fetch?: typeof fetch;
}

const SUMMARY_COLUMNS =
  "id,slug,title,excerpt,cover_image_path,tags,author_name,published_at,updated_at";

export class PostsError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

export function createPostsApi({ url, key, fetch: f = globalThis.fetch }: BlogConfig) {
  const base = url.replace(/\/$/, "");
  const headers = { apikey: key, Authorization: `Bearer ${key}`, Accept: "application/json" };

  async function get<T>(path: string): Promise<T> {
    const res = await f(`${base}/rest/v1/${path}`, { headers });
    if (!res.ok) throw new PostsError(`Supabase ${res.status} on ${path.split("?")[0]}`, res.status);
    return (await res.json()) as T;
  }

  const live = () => `published_at=lte.${encodeURIComponent(new Date().toISOString())}`;

  return {
    /** Published posts, newest first. */
    listPosts(limit = 100): Promise<PostSummary[]> {
      return get(`blog_posts?select=${SUMMARY_COLUMNS}&${live()}&order=published_at.desc&limit=${limit}`);
    },

    /** One published post by slug, or null. */
    async getPost(slug: string): Promise<Post | null> {
      if (!isValidSlug(slug)) return null;
      const rows = await get<Post[]>(
        `blog_posts?select=${SUMMARY_COLUMNS},body_md&slug=eq.${encodeURIComponent(slug)}&${live()}&limit=1`,
      );
      return rows[0] ?? null;
    },

    /** The suite's apps, for the shared navbar's app switcher. Best effort. */
    async listApps(): Promise<AppLinkRow[]> {
      try {
        return await get<AppLinkRow[]>("scholium_apps?select=id,title,url,icon&order=sort_order");
      } catch {
        return [];
      }
    },

    /** Public URL of an object in the blog-images bucket. */
    imageUrl(path: string | null | undefined): string | null {
      if (!path) return null;
      if (/^https?:\/\//i.test(path)) return path;
      return `${base}/storage/v1/object/public/blog-images/${path.split("/").map(encodeURIComponent).join("/")}`;
    },
  };
}

export type PostsApi = ReturnType<typeof createPostsApi>;

/** Mirrors the CHECK on blog_posts.slug. */
export function isValidSlug(slug: string): boolean {
  return slug.length <= 120 && /^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug);
}

/** Dates render identically on server and client: fixed locale, UTC. */
export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}
