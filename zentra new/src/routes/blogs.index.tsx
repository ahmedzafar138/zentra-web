import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { Loader2, Newspaper, RefreshCw } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { Protected } from "@/components/Protected";
import { useBlogs } from "@/state/BlogContext";
import { fetchBlogs, formatBlogDate } from "@/lib/blogs";

export const Route = createFileRoute("/blogs/")({
  head: () => ({ meta: [{ title: "Blogs — Zentra" }] }),
  component: () => (
    <Protected>
      <BlogsPage />
    </Protected>
  ),
});

function BlogsPage() {
  const navigate = useNavigate();
  const { blogs, setBlogs, setSelectedBlog } = useBlogs();
  const [loading, setLoading] = useState(blogs.length === 0);
  const [error, setError] = useState("");
  const [visibleCount, setVisibleCount] = useState(6);
  // Current WordPress page we're displaying. Refresh pulls the next page so
  // every click actually changes which blogs you see. When we run out of
  // pages the helper wraps to page 1 and tells us via `exhausted`.
  const pageRef = useRef(1);

  const load = async (page = 1) => {
    setLoading(true);
    setError("");
    try {
      const { posts, page: actualPage } = await fetchBlogs(18, page);
      setBlogs(posts);
      pageRef.current = actualPage;
      setVisibleCount(6);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load blogs.");
    } finally {
      setLoading(false);
    }
  };

  const refresh = () => {
    void load(pageRef.current + 1);
  };

  useEffect(() => {
    if (blogs.length === 0) void load(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const visible = blogs.slice(0, visibleCount);

  return (
    <AppShell>
      <div className="space-y-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-3xl md:text-4xl font-bold">Blogs</h1>
            <p className="text-sm text-muted-foreground mt-1.5">Fitness, nutrition, and recovery articles curated for you.</p>
          </div>
          <button onClick={refresh} disabled={loading}
            className="inline-flex items-center gap-2 h-11 px-4 rounded-xl bg-surface border border-border text-sm hover:border-primary/40 transition disabled:opacity-60">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />} Refresh
          </button>
        </div>

        {error && (
          <div className="rounded-xl border border-destructive/40 bg-destructive/10 px-4 py-2.5 text-sm text-destructive">{error}</div>
        )}

        {loading && blogs.length === 0 ? (
          <div className="grid place-items-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="mt-3 text-sm text-muted-foreground">Loading latest fitness articles…</p>
          </div>
        ) : blogs.length === 0 ? (
          <div className="card-elevated p-10 text-center">
            <Newspaper className="h-8 w-8 mx-auto text-primary" />
            <p className="font-semibold mt-3">No blog posts found</p>
            <p className="text-sm text-muted-foreground mt-1">The blog API did not return articles right now.</p>
          </div>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
            {visible.map((post) => {
              const image = post.thumbnail_url ?? post.image_url;
              return (
                <button key={post.id} onClick={() => { setSelectedBlog(post); navigate({ to: "/blogs/$id", params: { id: post.id } }); }}
                  className="card-elevated overflow-hidden group cursor-pointer block text-left">
                  <div className="aspect-[16/9] bg-gradient-to-br from-orange-500/30 via-red-600/20 to-transparent relative">
                    {image ? <img src={image} alt="" className="h-full w-full object-cover" loading="lazy" /> : null}
                    <div className="absolute top-3 left-3 px-2.5 py-1 rounded-full text-xs glass">{post.category}</div>
                  </div>
                  <div className="p-5">
                    <h3 className="font-semibold leading-snug group-hover:text-primary transition-colors">{post.title}</h3>
                    <p className="text-xs text-muted-foreground mt-2 line-clamp-2">{post.snippet}</p>
                    <p className="text-xs text-muted-foreground mt-3">{post.read_time_min} min read · {formatBlogDate(post.published_at)}</p>
                  </div>
                </button>
              );
            })}
          </div>
        )}

        {!loading && blogs.length > visible.length && (
          <div className="flex justify-center">
            <button onClick={() => setVisibleCount((c) => c + 6)}
              className="h-11 px-5 rounded-xl bg-surface border border-border text-sm hover:border-primary/40 transition">
              Show more blogs
            </button>
          </div>
        )}
      </div>
    </AppShell>
  );
}
