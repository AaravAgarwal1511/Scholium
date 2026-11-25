import { useMemo } from "react";
import { Link, useParams } from "react-router-dom";
import { usePageData, useBlog } from "../lib/context";
import { useHead } from "../lib/useHead";
import { formatDate, type Post } from "../lib/posts";
import { readingMinutes, renderMarkdown } from "../lib/markdown";
import { StatusMessage } from "../components/StatusMessage";
import NotFound from "./NotFound";

export default function PostPage() {
  const { slug = "" } = useParams();
  const path = `/${slug}`;
  const state = usePageData(path, async (api) => {
    const post = await api.getPost(slug);
    return post ? { kind: "post", post } : { kind: "not-found" };
  });
  useHead(state.status === "ready" ? state.data : null, path);

  if (state.status === "loading") return <StatusMessage>Loading…</StatusMessage>;
  if (state.status === "error") return <StatusMessage>Couldn&rsquo;t load this post. Please try again.</StatusMessage>;
  if (state.data.kind !== "post") return <NotFound />;
  return <Article post={state.data.post} />;
}

function Article({ post }: { post: Post }) {
  const { api } = useBlog();
  const html = useMemo(() => renderMarkdown(post.body_md), [post.body_md]);
  const cover = api.imageUrl(post.cover_image_path);

  return (
    <article>
      <p className="mb-6">
        <Link to="/" className="text-sm text-muted-foreground hover:text-foreground">
          &larr; All posts
        </Link>
      </p>
      <header className="mb-8">
        <h1 className="text-4xl sm:text-5xl font-display font-bold tracking-tight leading-tight">{post.title}</h1>
        <p className="mt-4 text-sm text-muted-foreground">
          {post.author_name && <>{post.author_name} · </>}
          <time dateTime={post.published_at}>{formatDate(post.published_at)}</time>
          {" · "}
          {readingMinutes(post.body_md)} min read
        </p>
        {post.tags.length > 0 && (
          <ul className="mt-3 flex flex-wrap gap-2" aria-label="Tags">
            {post.tags.map((t) => (
              <li key={t} className="text-xs rounded-full border border-border px-2.5 py-0.5 text-muted-foreground">
                {t}
              </li>
            ))}
          </ul>
        )}
      </header>
      {cover && (
        <img src={cover} alt="" decoding="async" className="mb-8 w-full rounded-xl aspect-[2/1] object-cover bg-muted" />
      )}
      <div className="post-body" dangerouslySetInnerHTML={{ __html: html }} />
    </article>
  );
}
