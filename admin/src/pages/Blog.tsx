import { useEffect, useState } from "react";
import { supabase } from "../supabase";
import BlogEditor, { type BlogRow } from "./BlogEditor";

// Admin-only view of every post, drafts included. The blog_posts SELECT policy
// returns drafts only to a caller _assert_admin() accepts (via _is_admin());
// writes go through the admin_*_blog_post RPCs (see
// database/migrations/20261124000000_blog_posts.sql).

export const BLOG_URL = (import.meta.env.VITE_BLOG_URL as string | undefined)?.replace(/\/$/, "");

const COLUMNS = "id, slug, title, excerpt, cover_image_path, tags, author_name, published_at, updated_at";

export function statusOf(row: Pick<BlogRow, "published_at">): "draft" | "scheduled" | "live" {
  if (!row.published_at) return "draft";
  return Date.parse(row.published_at) > Date.now() ? "scheduled" : "live";
}

export default function Blog() {
  const [list, setList] = useState<BlogRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState<BlogRow | "new" | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [err, setErr] = useState("");

  async function load() {
    const { data, error } = await supabase
      .from("blog_posts")
      .select(COLUMNS)
      .order("published_at", { ascending: false, nullsFirst: true })
      .order("updated_at", { ascending: false });
    setLoading(false);
    if (error) return setErr(error.message);
    setList((data as BlogRow[]) ?? []);
  }

  useEffect(() => {
    load();
  }, []);

  async function togglePublished(row: BlogRow) {
    const publish = statusOf(row) === "draft";
    setBusyId(row.id);
    const { error } = await supabase.rpc("admin_set_blog_post_published", { p_id: row.id, p_published: publish });
    setBusyId(null);
    if (error) return setErr(error.message);
    load();
  }

  async function del(row: BlogRow) {
    const live = statusOf(row) !== "draft";
    const warn = live ? " It is published — its URL will start returning 404." : "";
    if (!confirm(`Delete "${row.title}"?${warn} This cannot be undone.`)) return;
    setBusyId(row.id);
    const { error } = await supabase.rpc("admin_delete_blog_post", { p_id: row.id });
    setBusyId(null);
    if (error) return setErr(error.message);
    setList((prev) => prev.filter((r) => r.id !== row.id));
  }

  if (open) {
    return (
      <BlogEditor
        post={open === "new" ? null : open}
        onBack={() => {
          setOpen(null);
          load();
        }}
      />
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-8">
      <div className="flex items-baseline justify-between mb-4">
        <h1 className="text-2xl font-bold">Blog</h1>
        <span className="text-sm text-slate-500">
          {list.length} post{list.length === 1 ? "" : "s"}
          {BLOG_URL && (
            <>
              {" · "}
              <a href={BLOG_URL} target="_blank" rel="noreferrer" className="underline hover:text-slate-800">
                View blog ↗
              </a>
            </>
          )}
        </span>
      </div>
      <p className="text-sm text-slate-500 mb-6">
        Write in Markdown. Drafts are only visible here; publishing makes a post live on the blog within about a minute.
      </p>

      {err && (
        <div className="mb-4 rounded-lg bg-red-50 text-red-700 text-sm px-4 py-3 flex justify-between">
          <span>{err}</span>
          <button onClick={() => setErr("")} className="font-semibold">Dismiss</button>
        </div>
      )}

      {loading ? (
        <div className="text-slate-500">Loading…</div>
      ) : (
        <div className="flex flex-col gap-2">
          <button
            onClick={() => setOpen("new")}
            className="rounded-xl border-2 border-dashed border-slate-300 text-slate-500 py-5 hover:border-slate-400 hover:text-slate-700"
          >
            + New post
          </button>
          {list.map((row) => {
            const status = statusOf(row);
            return (
              <div key={row.id} className="rounded-xl bg-white shadow hover:shadow-md transition-shadow flex items-stretch overflow-hidden">
                <button onClick={() => setOpen(row)} className="flex-1 p-4 text-left min-w-0">
                  <div className="font-semibold truncate">{row.title}</div>
                  <div className="text-xs text-slate-500 mt-1 truncate">
                    <StatusBadge status={status} /> /{row.slug}
                    {row.published_at && <> · {new Date(row.published_at).toLocaleDateString()}</>}
                    {row.tags.length > 0 && <> · {row.tags.join(", ")}</>}
                  </div>
                </button>
                <div className="flex items-center gap-3 pr-3 flex-shrink-0">
                  {status !== "draft" && BLOG_URL && (
                    <a
                      href={`${BLOG_URL}/${row.slug}`}
                      target="_blank"
                      rel="noreferrer"
                      className="text-xs text-slate-400 hover:text-slate-700"
                    >
                      View ↗
                    </a>
                  )}
                  <button
                    onClick={() => togglePublished(row)}
                    disabled={busyId === row.id}
                    className="text-xs font-semibold text-slate-600 hover:text-slate-900 disabled:opacity-40"
                  >
                    {status === "draft" ? "Publish" : "Unpublish"}
                  </button>
                  <button
                    onClick={() => del(row)}
                    disabled={busyId === row.id}
                    className="text-xs text-slate-400 hover:text-red-600 disabled:opacity-40"
                  >
                    Delete
                  </button>
                  <button
                    onClick={() => setOpen(row)}
                    aria-label={`Edit "${row.title}"`}
                    className="text-sm font-semibold text-slate-600 hover:text-slate-900"
                  >
                    Edit →
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export function StatusBadge({ status }: { status: "draft" | "scheduled" | "live" }) {
  const cls =
    status === "live"
      ? "bg-emerald-100 text-emerald-800"
      : status === "scheduled"
        ? "bg-sky-100 text-sky-800"
        : "bg-amber-100 text-amber-800";
  return (
    <span className={`inline-block rounded px-1.5 py-0.5 mr-1 font-semibold uppercase tracking-wide text-[10px] ${cls}`}>
      {status}
    </span>
  );
}
