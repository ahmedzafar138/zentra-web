import type { BlogPost } from "@/lib/types";

function stripBlogHtml(value = "") {
  if (typeof window === "undefined") {
    return value.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
  }
  const parser = new DOMParser();
  const document = parser.parseFromString(value, "text/html");
  return document.body.textContent?.replace(/\s+/g, " ").trim() ?? "";
}

type WpPost = {
  id: number;
  title?: { rendered?: string };
  excerpt?: { rendered?: string };
  content?: { rendered?: string };
  date: string;
  jetpack_featured_media_url?: string;
  source_url?: string;
  yoast_head_json?: { og_image?: { url: string }[] };
  _embedded?: {
    "wp:featuredmedia"?: Array<{
      media_details?: { sizes?: { medium_large?: { source_url?: string }; large?: { source_url?: string }; full?: { source_url?: string } } };
      source_url?: string;
    }>;
  };
};

function firstInlineImg(html?: string): string | null {
  if (!html) return null;
  const match = html.match(/<img[^>]+(?:data-lazy-src|data-src|src)="([^"]+)"/i);
  if (!match) return null;
  const url = match[1];
  if (url.startsWith("data:") || url.length < 20) return null;
  return url;
}

function getBlogImage(post: WpPost): string | null {
  const media = post._embedded?.["wp:featuredmedia"]?.[0];
  return (
    post.jetpack_featured_media_url ||
    media?.media_details?.sizes?.medium_large?.source_url ||
    media?.media_details?.sizes?.large?.source_url ||
    media?.media_details?.sizes?.full?.source_url ||
    media?.source_url ||
    post.yoast_head_json?.og_image?.[0]?.url ||
    firstInlineImg(post.content?.rendered) ||
    null
  );
}

/**
 * Picsum returns a deterministic, lazy-cached image for any seed.
 * We use the post id so the same article always gets the same picture.
 */
function fallbackImage(id: string) {
  return `https://picsum.photos/seed/zentra-${id}/800/450`;
}

function mapPost(post: WpPost, category: string): BlogPost {
  const id = String(post.id);
  const image = getBlogImage(post) ?? fallbackImage(id);
  return {
    id,
    title: stripBlogHtml(post.title?.rendered) || "Untitled",
    snippet: stripBlogHtml(post.excerpt?.rendered),
    content: stripBlogHtml(post.content?.rendered),
    category,
    read_time_min: Math.max(3, Math.round((post.content?.rendered?.length ?? 2500) / 1200)),
    published_at: post.date,
    thumbnail_url: image,
    image_url: image,
  };
}

/**
 * Sources tried in order; first one that responds with >0 posts wins.
 * girlsgonestrong is the primary because nerdfitness returns mostly
 * image-less newsletter posts. Both are WordPress with the standard /wp-json
 * REST API. The `page` query param is the standard WP pagination knob — we
 * use it so the Refresh button can pull a different batch every click.
 */
const sources: Array<{ url: (perPage: number, page: number, cacheBust: number) => string; category: string }> = [
  {
    url: (n, p, t) => `https://www.girlsgonestrong.com/wp-json/wp/v2/posts?per_page=${n}&page=${p}&_embed=1&_=${t}`,
    category: "Strength",
  },
  {
    url: (n, p, t) => `https://www.nerdfitness.com/wp-json/wp/v2/posts?per_page=${n}&page=${p}&_embed=1&_=${t}`,
    category: "Fitness",
  },
];

export type FetchBlogsResult = { posts: BlogPost[]; page: number; exhausted: boolean };

/**
 * Fetch a page of fitness blog posts.
 *
 * WP returns HTTP 400 (`rest_post_invalid_page_number`) when `page` exceeds
 * the total page count. We detect that, fall back to page 1, and tell the
 * caller via `exhausted: true` so it can reset its page counter.
 *
 * Each request is cache-busted so the browser doesn't hand us the same body.
 */
export async function fetchBlogs(perPage = 18, page = 1): Promise<FetchBlogsResult> {
  const cacheBust = Date.now();

  const attempt = async (p: number): Promise<{ posts: BlogPost[] } | null> => {
    let lastError: unknown = null;
    for (const source of sources) {
      try {
        const response = await fetch(source.url(perPage, p, cacheBust));
        if (response.status === 400) {
          // page out of range — try next source first, then signal exhaustion
          continue;
        }
        if (!response.ok) throw new Error(`Blog API failed with ${response.status}`);
        const data = (await response.json()) as WpPost[];
        if (Array.isArray(data) && data.length > 0) {
          return { posts: data.map((post) => mapPost(post, source.category)) };
        }
      } catch (err) {
        lastError = err;
      }
    }
    if (lastError && p === 1) throw lastError instanceof Error ? lastError : new Error("Blog API failed");
    return null;
  };

  const primary = await attempt(page);
  if (primary) return { posts: primary.posts, page, exhausted: false };
  // We ran past the end — wrap to page 1.
  if (page > 1) {
    const wrapped = await attempt(1);
    if (wrapped) return { posts: wrapped.posts, page: 1, exhausted: true };
  }
  return { posts: [], page: 1, exhausted: true };
}

export function formatBlogDate(value: string) {
  return new Date(value).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}
