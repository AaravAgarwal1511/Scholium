import { Link } from "react-router-dom";
import { usePageData, useBlog } from "../lib/context";
import { useHead } from "../lib/useHead";
import { formatDate, type PostSummary } from "../lib/posts";
import { SITE_DESCRIPTION } from "../lib/seo";
import { StatusMessage } from "../components/StatusMessage";

export default function IndexPage() {
  const state = usePageData("/", async (api) => ({ kind: "index", posts: await api.listPosts() }));
  useHead(state.status === "ready" ? state.data : null, "/");

  return (
    <>
      <header className="mb-10">
        <h1 className="text-4xl sm:text-5xl font-display font-bold tracking-tight">Blog</h1>
        <p className="mt-3 text-lg text-muted-foreground">{SITE_DESCRIPTION}</p>
      </header>

      {state.status === "loading" && <StatusMessage>Loading posts…</StatusMessage>}
      {state.status === "error" && <StatusMessage>Couldn&rsquo;t load posts. Please try again.</StatusMessage>}
      {state.status === "ready" && state.data.kind === "index" && (
        state.data.posts.length === 0 ? (
          <StatusMessage>No posts yet. Check back soon.</StatusMessage>
        ) : (
          <ol className="flex flex-col gap-6" aria-label="Posts">
            {state.data.posts.map((p) => (
              <PostCard key={p.id} post={p} />
            ))}
          </ol>
        )
      )}
    </>
  );
}

function PostCard({ post }: { post: PostSummary }) {
  const { api } = useBlog();
  const cover = api.imageUrl(post.cover_image_path);
  return (
    <li className="post-card group rounded-xl border border-border bg-card overflow-hidden transition-shadow hover:shadow-card">
      <Link to={`/${post.slug}`} className="block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-xl">
        {cover && (
          <img
            src={cover}
            alt=""
            loading="lazy"
            decoding="async"
            className="w-full aspect-[2/1] object-cover bg-muted"
          />
        )}
        <div className="p-5 sm:p-6">
          <p className="text-sm text-muted-foreground">
            <time dateTime={post.published_at}>{formatDate(post.published_at)}</time>
            {post.tags.length > 0 && <> · {post.tags.join(", ")}</>}
          </p>
          <h2 className="mt-1 text-2xl font-display font-semibold group-hover:underline underline-offset-4">
            {post.title}
          </h2>
          {post.excerpt && <p className="mt-2 text-muted-foreground">{post.excerpt}</p>}
        </div>
      </Link>
    </li>
  );
}
