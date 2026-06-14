import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ChevronLeft, Loader2, Newspaper } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { Protected } from "@/components/Protected";
import { useBlogs } from "@/state/BlogContext";
import { fetchBlogs } from "@/lib/blogs";
import type { BlogPost } from "@/lib/types";

export const Route = createFileRoute("/blogs/$id")({
  head: () => ({ meta: [{ title: "Blog — Zentra" }] }),
  component: () => (
    <Protected>
      <BlogDetailPage />
    </Protected>
  ),
});

function BlogDetailPage() {
  const { id } = useParams({ from: "/blogs/$id" });
  const { blogs, selectedBlog, setBlogs, setSelectedBlog } = useBlogs();
  const [post, setPost] = useState<BlogPost | null>(selectedBlog?.id === id ? selectedBlog : blogs.find((b) => b.id === id) ?? null);
  const [loading, setLoading] = useState(post === null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (post) {
      setSelectedBlog(post);
      return;
    }
    let active = true;
    (async () => {
      try {
        const list = await fetchBlogs(18);
        if (!active) return;
        setBlogs(list);
        const match = list.find((b) => b.id === id) ?? null;
        setPost(match);
        setSelectedBlog(match);
      } catch (err) {
        if (active) setError(err instanceof Error ? err.message : "Could not load blog.");
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  return (
    <AppShell>
      <div className="space-y-6 max-w-3xl">
        <div className="flex items-center gap-3">
          <Link to="/blogs"
            className="h-10 w-10 grid place-items-center rounded-xl bg-surface border border-border hover:border-primary/40 transition">
            <ChevronLeft className="h-4 w-4" />
          </Link>
          <h1 className="text-3xl font-bold">Blog</h1>
        </div>

        {error && (
          <div className="rounded-xl border border-destructive/40 bg-destructive/10 px-4 py-2.5 text-sm text-destructive">{error}</div>
        )}

        {loading ? (
          <div className="grid place-items-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : !post ? (
          <div className="card-elevated p-10 text-center">
            <Newspaper className="h-8 w-8 mx-auto text-primary" />
            <p className="font-semibold mt-3">Blog not found</p>
            <p className="text-sm text-muted-foreground mt-1">This article may no longer be available.</p>
          </div>
        ) : (
          <article className="card-elevated overflow-hidden">
            {(post.thumbnail_url ?? post.image_url) ? (
              <img src={(post.thumbnail_url ?? post.image_url) ?? ""} alt="" className="w-full aspect-[16/9] object-cover" />
            ) : (
              <div className="w-full aspect-[16/9] grid place-items-center bg-gradient-to-br from-orange-500/30 via-red-600/20 to-transparent">
                <Newspaper className="h-12 w-12 text-primary/50" />
              </div>
            )}
            <div className="p-6 sm:p-8">
              <span className="px-2.5 py-1 rounded-full text-xs glass">{post.category}</span>
              <h2 className="text-2xl sm:text-3xl font-bold mt-4 leading-tight">{post.title}</h2>
              <p className="text-xs text-muted-foreground mt-2">
                {post.read_time_min} min read · {new Date(post.published_at).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
              </p>
              <p className="mt-5 text-base text-muted-foreground leading-relaxed">{post.snippet}</p>
              <div className="mt-6 space-y-4 text-sm leading-relaxed">
                {(post.content || post.snippet)
                  .split(/(?<=[.!?])\s+/)
                  .filter(Boolean)
                  .map((paragraph, index) => (
                    <p key={index}>{paragraph}</p>
                  ))}
              </div>
            </div>
          </article>
        )}
      </div>
    </AppShell>
  );
}
