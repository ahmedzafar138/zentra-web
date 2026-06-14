import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
import type { BlogPost } from "@/lib/types";

type BlogCtx = {
  blogs: BlogPost[];
  setBlogs: (blogs: BlogPost[]) => void;
  selectedBlog: BlogPost | null;
  setSelectedBlog: (blog: BlogPost | null) => void;
};

const Ctx = createContext<BlogCtx | undefined>(undefined);

export function BlogProvider({ children }: { children: ReactNode }) {
  const [blogs, setBlogs] = useState<BlogPost[]>([]);
  const [selectedBlog, setSelectedBlog] = useState<BlogPost | null>(null);

  const value = useMemo<BlogCtx>(() => ({ blogs, setBlogs, selectedBlog, setSelectedBlog }), [blogs, selectedBlog]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useBlogs() {
  const c = useContext(Ctx);
  if (!c) throw new Error("useBlogs must be inside BlogProvider");
  return c;
}
