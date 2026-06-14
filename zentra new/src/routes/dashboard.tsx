import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Activity, Apple, Sparkles, Dumbbell, ArrowUpRight, Footprints, Newspaper, BarChart3 } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { Protected } from "@/components/Protected";
import { useAuth } from "@/hooks/useAuth";
import { supabase, hasSupabaseConfig } from "@/integrations/supabase/client";
import { bmiCategory, calculateBmi, todayKey } from "@/lib/format";
import { fetchBlogs } from "@/lib/blogs";
import { useBlogs } from "@/state/BlogContext";
import type { BlogPost } from "@/lib/types";

export const Route = createFileRoute("/dashboard")({
  head: () => ({ meta: [{ title: "Dashboard — Zentra" }] }),
  component: () => (
    <Protected>
      <Dashboard />
    </Protected>
  ),
});

const features = [
  { to: "/form-correction", icon: Activity, title: "Form Correction", desc: "Live AI pose feedback", tint: "from-sky-500/20 to-cyan-600/10" },
  { to: "/meals", icon: Apple, title: "Meal Plans", desc: "Smart weekly nutrition", tint: "from-green-500/20 to-emerald-600/10" },
  { to: "/zentra-ai", icon: Sparkles, title: "Zentra AI", desc: "Your conversational coach", tint: "from-purple-500/20 to-fuchsia-600/10" },
  { to: "/workouts", icon: Dumbbell, title: "Workout Logs", desc: "Track every set & rep", tint: "from-orange-500/20 to-red-600/10" },
] as const;

function Dashboard() {
  const navigate = useNavigate();
  const { profile, user } = useAuth();
  const { blogs: cachedBlogs, setBlogs: setCachedBlogs, setSelectedBlog } = useBlogs();
  const [stepsToday, setStepsToday] = useState(0);
  const [latestBlogs, setLatestBlogs] = useState<BlogPost[]>(cachedBlogs.slice(0, 3));
  const goal = profile?.steps_goal ?? 8000;
  const progress = goal > 0 ? Math.min((stepsToday / goal) * 100, 100) : 0;
  const bmi = profile?.bmi ?? calculateBmi(profile?.height_cm, profile?.weight_kg);

  useEffect(() => {
    let active = true;
    if (user && hasSupabaseConfig) {
      supabase
        .from("step_tracking")
        .select("steps")
        .eq("user_id", user.id)
        .eq("date", todayKey())
        .maybeSingle()
        .then(({ data }) => {
          if (active) setStepsToday(Number(data?.steps ?? 0));
        });
    }
    if (cachedBlogs.length === 0) {
      fetchBlogs(6).then((list) => {
        if (!active) return;
        setCachedBlogs(list);
        setLatestBlogs(list.slice(0, 3));
      }).catch(() => undefined);
    } else {
      setLatestBlogs(cachedBlogs.slice(0, 3));
    }
    return () => {
      active = false;
    };
  }, [user, cachedBlogs, setCachedBlogs]);

  const dashOffset = 97.4 - (97.4 * progress) / 100;

  return (
    <AppShell>
      <div className="space-y-8">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-sm text-muted-foreground">
              {new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
            </p>
            <h1 className="text-3xl md:text-4xl font-bold mt-1">
              Welcome back{profile?.first_name ? `, ${profile.first_name}` : ""} 👋
            </h1>
            {bmi && (
              <p className="text-sm text-muted-foreground mt-1.5">
                BMI {bmi} · {bmiCategory(bmi)}
              </p>
            )}
          </div>
        </div>

        <div className="grid sm:grid-cols-2 gap-5">
          {features.map((f) => (
            <Link key={f.to} to={f.to} className="card-elevated p-6 group relative overflow-hidden">
              <div className={`absolute inset-0 bg-gradient-to-br ${f.tint} opacity-60 group-hover:opacity-100 transition-opacity`} />
              <div className="relative flex items-start justify-between">
                <div>
                  <div className="h-11 w-11 rounded-xl bg-gradient-primary grid place-items-center shadow-[0_8px_24px_-8px_var(--glow)]">
                    <f.icon className="h-5 w-5 text-white" />
                  </div>
                  <h3 className="text-lg font-semibold mt-4">{f.title}</h3>
                  <p className="text-sm text-muted-foreground mt-1">{f.desc}</p>
                </div>
                <ArrowUpRight className="h-5 w-5 text-muted-foreground group-hover:text-primary transition-colors" />
              </div>
            </Link>
          ))}
        </div>

        <div className="grid lg:grid-cols-3 gap-5">
          <div className="card-elevated p-6 lg:col-span-1">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold">Today's Steps</h3>
              <Link to="/steps" className="text-xs text-primary hover:underline">View</Link>
            </div>
            <div className="mt-6 grid place-items-center">
              <div className="relative h-44 w-44">
                <svg viewBox="0 0 36 36" className="h-44 w-44 -rotate-90">
                  <circle cx="18" cy="18" r="15.5" className="fill-none stroke-border" strokeWidth="2.5" />
                  <circle cx="18" cy="18" r="15.5" className="fill-none stroke-primary" strokeWidth="2.5"
                    strokeDasharray="97.4" strokeDashoffset={dashOffset} strokeLinecap="round"
                    style={{ filter: "drop-shadow(0 0 8px var(--glow))" }} />
                </svg>
                <div className="absolute inset-0 grid place-items-center text-center">
                  <div>
                    <p className="text-3xl font-bold">{stepsToday.toLocaleString()}</p>
                    <p className="text-xs text-muted-foreground mt-1">of {goal.toLocaleString()}</p>
                  </div>
                </div>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2 mt-6">
              {[
                { l: "Cal", v: (stepsToday * 0.04).toFixed(0) },
                { l: "Min", v: String(Math.floor(stepsToday / 120)) },
                { l: "Km", v: (stepsToday * 0.0008).toFixed(2) },
              ].map((s) => (
                <div key={s.l} className="rounded-lg bg-surface-elevated border border-border p-2.5 text-center">
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{s.l}</p>
                  <p className="text-sm font-semibold mt-0.5">{s.v}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="card-elevated p-6 lg:col-span-2">
            <h3 className="font-semibold">Quick links</h3>
            <p className="text-xs text-muted-foreground mt-0.5">Jump straight into the rest of Zentra</p>
            <div className="mt-5 grid sm:grid-cols-3 gap-3">
              <UtilityLink to="/history" icon={BarChart3} title="History" subtitle="Logs · meals · steps" />
              <UtilityLink to="/steps" icon={Footprints} title="Step Counter" subtitle="Track daily steps" />
              <UtilityLink to="/blogs" icon={Newspaper} title="Blogs" subtitle="Stay updated" />
            </div>
          </div>
        </div>

        {latestBlogs.length > 0 && (
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold">Trending in fitness</h2>
              <Link to="/blogs" className="text-sm text-primary hover:underline">All articles →</Link>
            </div>
            <div className="grid md:grid-cols-3 gap-5">
              {latestBlogs.map((b) => (
                <button key={b.id} onClick={() => { setSelectedBlog(b); navigate({ to: "/blogs/$id", params: { id: b.id } }); }}
                  className="card-elevated overflow-hidden group cursor-pointer block text-left">
                  <div className="aspect-[16/9] bg-gradient-to-br from-orange-500/30 via-red-600/20 to-transparent relative">
                    {b.thumbnail_url ? (
                      <img src={b.thumbnail_url} alt="" className="h-full w-full object-cover" loading="lazy" />
                    ) : null}
                    <div className="absolute top-3 left-3 px-2.5 py-1 rounded-full text-xs glass">{b.category}</div>
                  </div>
                  <div className="p-5">
                    <h3 className="font-semibold leading-snug group-hover:text-primary transition-colors">{b.title}</h3>
                    <p className="text-xs text-muted-foreground mt-2">{b.read_time_min ?? 5} min read</p>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}

function UtilityLink({ to, icon: Icon, title, subtitle }: { to: "/history" | "/steps" | "/blogs"; icon: typeof BarChart3; title: string; subtitle: string }) {
  return (
    <Link to={to} className="rounded-xl border border-border bg-surface p-4 hover:border-primary/40 transition group">
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-lg bg-primary/10 grid place-items-center text-primary">
          <Icon className="h-5 w-5" />
        </div>
        <div>
          <p className="font-medium text-sm">{title}</p>
          <p className="text-xs text-muted-foreground">{subtitle}</p>
        </div>
      </div>
    </Link>
  );
}
