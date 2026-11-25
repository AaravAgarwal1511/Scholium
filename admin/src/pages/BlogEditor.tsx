import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "../supabase";
import { renderMarkdown, slugify, SLUG_RE } from "../lib/markdown";
import { BLOG_URL, StatusBadge, statusOf } from "./Blog";

export type BlogRow = {
  id: string;
  slug: string;
  title: string;
  excerpt: string | null;
  cover_image_path: string | null;
  tags: string[];
  author_name: string | null;
  published_at: string | null;
  updated_at: string;
};

const BUCKET = "blog-images";
const MAX_IMAGE_BYTES = 5 * 1024 * 1024; // the bucket's file_size_limit

function publicUrl(path: string) {
  return supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
}

/** Postgres errors → something the admin can act on. */
function friendly(message: string): string {
  if (/blog_posts_slug_key|duplicate key/i.test(message)) return "That slug is already used by another post.";
  if (/blog_posts_slug_check/i.test(message)) return "Slug must be lowercase letters and numbers separated by single hyphens.";
  if (/blog_posts_title_check/i.test(message)) return "Title can't be empty.";
  if (/not authorized/i.test(message)) return "This account isn't the admin, so it can't change blog posts.";
  return message;
}

export default function BlogEditor({ post, onBack }: { post: BlogRow | null; onBack: () => void }) {
  const [id, setId] = useState<string | null>(post?.id ?? null);
  const [title, setTitle] = useState(post?.title ?? "");
  const [slug, setSlug] = useState(post?.slug ?? "");
  // A new post's slug follows its title until edited by hand. An existing post's
  // never does: changing a live URL breaks every link to it.
  const [slugTouched, setSlugTouched] = useState(!!post);
  const [excerpt, setExcerpt] = useState(post?.excerpt ?? "");
  const [tags, setTags] = useState((post?.tags ?? []).join(", "));
  const [author, setAuthor] = useState(post?.author_name ?? "");
  const [cover, setCover] = useState<string | null>(post?.cover_image_path ?? null);
  const [body, setBody] = useState("");
  const [publishedAt, setPublishedAt] = useState<string | null>(post?.published_at ?? null);
  const [loadingBody, setLoadingBody] = useState(!!post);
  const [busy, setBusy] = useState<"" | "save" | "publish" | "upload">("");
  const [err, setErr] = useState("");
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const [dirty, setDirty] = useState(false);
  const bodyRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!post) return;
    supabase
      .from("blog_posts")
      .select("body_md")
      .eq("id", post.id)
      .single()
      .then(({ data, error }) => {
        setLoadingBody(false);
        if (error) return setErr(error.message);
        setBody(data.body_md ?? "");
      });
  }, [post]);

  // Warn before closing the tab with unsaved edits.
  useEffect(() => {
    if (!dirty) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [dirty]);

  const preview = useMemo(() => renderMarkdown(body), [body]);
  const status = statusOf({ published_at: publishedAt });
  const slugOk = SLUG_RE.test(slug) && slug.length <= 120;
  const canSave = title.trim().length > 0 && slugOk && !loadingBody && !busy;

  function edit<T>(setter: (v: T) => void) {
    return (v: T) => {
      setter(v);
      setDirty(true);
    };
  }

  function onTitle(v: string) {
    edit(setTitle)(v);
    if (!slugTouched) setSlug(slugify(v));
  }

  async function save(): Promise<string | null> {
    setErr("");
    const { data, error } = await supabase.rpc("admin_save_blog_post", {
      p_id: id,
      p_slug: slug,
      p_title: title.trim(),
      p_excerpt: excerpt,
      p_body_md: body,
      p_cover_image_path: cover ?? "",
      p_tags: tags.split(",").map((t) => t.trim()).filter(Boolean),
      p_author_name: author,
    });
    if (error) {
      setErr(friendly(error.message));
      return null;
    }
    const newId = data as string;
    setId(newId);
    setDirty(false);
    setSavedAt(new Date());
    return newId;
  }

  async function onSave() {
    setBusy("save");
    await save();
    setBusy("");
  }

  async function onPublishToggle() {
    const publish = status === "draft";
    if (!publish && !confirm("Unpublish this post? Its URL will return 404 within about a minute.")) return;
    setBusy("publish");
    const postId = await save(); // publish exactly what is on screen
    if (postId) {
      const { error } = await supabase.rpc("admin_set_blog_post_published", { p_id: postId, p_published: publish });
      if (error) setErr(friendly(error.message));
      else setPublishedAt(publish ? publishedAt ?? new Date().toISOString() : null);
    }
    setBusy("");
  }

  async function upload(file: File): Promise<string | null> {
    if (!file.type.startsWith("image/")) {
      setErr("Only images can be uploaded.");
      return null;
    }
    if (file.size > MAX_IMAGE_BYTES) {
      setErr("Images must be 5 MB or smaller.");
      return null;
    }
    setBusy("upload");
    setErr("");
    const safeName = file.name.toLowerCase().replace(/[^a-z0-9.]+/g, "-");
    const path = `${id ?? "unsaved"}/${Date.now()}-${safeName}`;
    const { error } = await supabase.storage.from(BUCKET).upload(path, file, { contentType: file.type, upsert: false });
    setBusy("");
    if (error) {
      setErr(friendly(error.message));
      return null;
    }
    return path;
  }

  async function onCoverFile(file: File | undefined) {
    if (!file) return;
    const path = await upload(file);
    if (path) edit(setCover)(path);
  }

  async function onInlineImage(file: File | undefined) {
    if (!file) return;
    const path = await upload(file);
    if (!path) return;
    const alt = file.name.replace(/\.[^.]+$/, "").replace(/[-_]+/g, " ");
    const snippet = `\n\n![${alt}](${publicUrl(path)})\n\n`;
    const ta = bodyRef.current;
    const at = ta ? ta.selectionStart : body.length;
    edit(setBody)(body.slice(0, at) + snippet + body.slice(at));
  }

  function back() {
    if (dirty && !confirm("Discard unsaved changes?")) return;
    onBack();
  }

  return (
    <div className="max-w-7xl mx-auto p-6">
      <div className="flex items-center justify-between gap-4 mb-5">
        <button onClick={back} className="text-sm text-slate-600 hover:text-slate-900">
          ← All posts
        </button>
        <div className="flex items-center gap-3">
          <span className="text-xs text-slate-500">
            <StatusBadge status={status} />
            {dirty ? "Unsaved changes" : savedAt ? `Saved ${savedAt.toLocaleTimeString()}` : ""}
          </span>
          {status !== "draft" && BLOG_URL && id && (
            <a href={`${BLOG_URL}/${slug}`} target="_blank" rel="noreferrer" className="text-sm text-slate-600 underline">
              View ↗
            </a>
          )}
          <button
            onClick={onSave}
            disabled={!canSave}
            className="px-3 py-1.5 rounded-lg text-sm font-semibold border border-slate-300 bg-white hover:bg-slate-50 disabled:opacity-40"
          >
            {busy === "save" ? "Saving…" : status === "draft" ? "Save draft" : "Save"}
          </button>
          <button
            onClick={onPublishToggle}
            disabled={!canSave}
            className={
              "px-3 py-1.5 rounded-lg text-sm font-semibold disabled:opacity-40 " +
              (status === "draft" ? "bg-emerald-600 text-white hover:bg-emerald-700" : "bg-slate-200 text-slate-800 hover:bg-slate-300")
            }
          >
            {busy === "publish" ? "Working…" : status === "draft" ? "Publish" : "Unpublish"}
          </button>
        </div>
      </div>

      {err && <div className="mb-4 rounded-lg bg-red-50 text-red-700 text-sm px-4 py-3">{err}</div>}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
        <Field label="Title">
          <input value={title} onChange={(e) => onTitle(e.target.value)} className="input" placeholder="Why spaced repetition works" />
        </Field>
        <Field
          label="Slug (URL)"
          hint={
            !slugOk && slug
              ? "Lowercase letters and numbers, separated by single hyphens."
              : status !== "draft" && post && slug !== post.slug
                ? "Changing a published post's URL breaks existing links to it."
                : undefined
          }
          warn={!slugOk && !!slug}
        >
          <input
            value={slug}
            onChange={(e) => {
              setSlugTouched(true);
              edit(setSlug)(e.target.value.toLowerCase());
            }}
            className="input font-mono"
            placeholder="why-spaced-repetition-works"
          />
        </Field>
        <Field label="Excerpt" hint="Shown on the post list and in search results. Falls back to the opening text.">
          <textarea value={excerpt} onChange={(e) => edit(setExcerpt)(e.target.value)} rows={2} className="input" />
        </Field>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Tags" hint="Comma-separated.">
            <input value={tags} onChange={(e) => edit(setTags)(e.target.value)} className="input" placeholder="memory, study" />
          </Field>
          <Field label="Author">
            <input value={author} onChange={(e) => edit(setAuthor)(e.target.value)} className="input" placeholder="Scholium" />
          </Field>
        </div>
      </div>

      <div className="flex flex-col gap-1">
        <span className="text-sm font-semibold text-slate-700">Cover image</span>
        <div className="flex items-center gap-3">
          {cover && <img src={publicUrl(cover)} alt="" className="h-16 w-32 object-cover rounded border border-slate-200" />}
          <label className="text-sm px-3 py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 cursor-pointer">
            {busy === "upload" ? "Uploading…" : cover ? "Replace" : "Upload"}
            <input type="file" accept="image/*" className="hidden" onChange={(e) => onCoverFile(e.target.files?.[0])} />
          </label>
          {cover && (
            <button onClick={() => edit(setCover)(null)} className="text-sm text-slate-500 hover:text-red-600">
              Remove
            </button>
          )}
        </div>
        <span className="text-xs text-slate-500">Optional. Also the preview image when the post is shared.</span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-4">
        <div className="flex flex-col">
          <div className="flex items-center justify-between mb-1">
            <span className="text-sm font-semibold text-slate-700">Body (Markdown)</span>
            <label className="text-xs text-slate-600 hover:text-slate-900 cursor-pointer underline">
              Insert image
              <input type="file" accept="image/*" className="hidden" onChange={(e) => onInlineImage(e.target.files?.[0])} />
            </label>
          </div>
          <textarea
            ref={bodyRef}
            value={loadingBody ? "Loading…" : body}
            disabled={loadingBody}
            onChange={(e) => edit(setBody)(e.target.value)}
            className="input font-mono text-sm leading-relaxed min-h-[60vh] flex-1"
            placeholder={"## A heading\n\nSome **bold** text, a [link](https://…), and a list:\n\n- one\n- two"}
          />
        </div>
        <div className="flex flex-col">
          <span className="text-sm font-semibold text-slate-700 mb-1">Preview</span>
          <div className="rounded-lg border border-slate-200 bg-white p-6 min-h-[60vh] overflow-auto">
            {title && <h1 className="text-3xl font-bold mb-4">{title}</h1>}
            <div className="blog-preview" dangerouslySetInnerHTML={{ __html: preview }} />
          </div>
        </div>
      </div>
    </div>
  );
}

function Field({
  label,
  hint,
  warn,
  children,
}: {
  label: string;
  hint?: string;
  warn?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-sm font-semibold text-slate-700">{label}</span>
      {children}
      {hint && <span className={"text-xs " + (warn ? "text-red-600" : "text-slate-500")}>{hint}</span>}
    </label>
  );
}
