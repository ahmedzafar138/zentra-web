import { Link, useRouterState, useNavigate } from "@tanstack/react-router";
import {
  LayoutDashboard, Dumbbell, Footprints, UtensilsCrossed,
  Sparkles, BookOpen, User as UserIcon, Search, Flame, Menu, Activity, LogOut, History as HistoryIcon,
} from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";

const nav = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/workouts", label: "Workout Logs", icon: Dumbbell },
  { to: "/steps", label: "Step Counter", icon: Footprints },
  { to: "/meals", label: "Meal Plans", icon: UtensilsCrossed },
  { to: "/form-correction", label: "Form Correction", icon: Activity },
  { to: "/zentra-ai", label: "Zentra AI", icon: Sparkles },
  { to: "/blogs", label: "Blogs", icon: BookOpen },
  { to: "/history", label: "History", icon: HistoryIcon },
  { to: "/profile", label: "Profile", icon: UserIcon },
] as const;

export function AppShell({ children }: { children: React.ReactNode }) {
  const path = useRouterState({ select: (s) => s.location.pathname });
  const [collapsed, setCollapsed] = useState(false);
  const navigate = useNavigate();
  const { profile, user, signOut } = useAuth();

  const initial = (profile?.first_name?.[0] ?? user?.email?.[0] ?? "Z").toUpperCase();

  const handleSignOut = async () => {
    await signOut();
    navigate({ to: "/login" });
  };

  return (
    <div className="min-h-screen flex w-full relative z-10">
      <aside
        className={cn(
          "hidden md:flex flex-col bg-sidebar border-r border-sidebar-border transition-all duration-300",
          collapsed ? "w-20" : "w-[270px]",
        )}
      >
        <div className="h-16 flex items-center px-5 border-b border-sidebar-border">
          <Link to="/" className="flex items-center gap-2.5">
            <div className="h-9 w-9 rounded-xl bg-gradient-primary grid place-items-center shadow-[0_8px_24px_-8px_var(--glow)]">
              <Flame className="h-5 w-5 text-white" />
            </div>
            {!collapsed && <span className="text-lg font-bold tracking-tight">Zentra</span>}
          </Link>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-1">
          {nav.map((item) => {
            const active = path === item.to || (item.to !== "/dashboard" && path.startsWith(item.to));
            const Icon = item.icon;
            return (
              <Link
                key={item.to}
                to={item.to}
                className={cn(
                  "group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all",
                  active
                    ? "bg-sidebar-accent text-sidebar-accent-foreground"
                    : "text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent/60",
                )}
              >
                {active && (
                  <span className="absolute left-0 top-1/2 -translate-y-1/2 h-6 w-1 rounded-r-full bg-gradient-primary shadow-[0_0_12px_var(--glow)]" />
                )}
                <Icon className={cn("h-5 w-5 shrink-0 transition-colors", active && "text-primary")} />
                {!collapsed && <span>{item.label}</span>}
              </Link>
            );
          })}
        </nav>

        <button
          onClick={() => setCollapsed((v) => !v)}
          className="m-3 h-10 rounded-xl border border-sidebar-border text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent transition-colors flex items-center justify-center"
          aria-label="Toggle sidebar"
        >
          <Menu className="h-4 w-4" />
        </button>
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        <header className="sticky top-0 z-30 h-16 glass flex items-center gap-3 px-4 md:px-8">
          <div className="md:hidden">
            <div className="h-9 w-9 rounded-xl bg-gradient-primary grid place-items-center">
              <Flame className="h-5 w-5 text-white" />
            </div>
          </div>
          <div className="flex-1 max-w-md relative hidden sm:block">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              placeholder="Search workouts, meals, blogs…"
              className="w-full h-10 pl-10 pr-4 rounded-xl bg-surface border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary/40"
            />
          </div>
          <div className="flex-1 sm:hidden" />
          <div className="flex items-center gap-2">
            <Link to="/profile" className="h-10 w-10 rounded-xl bg-gradient-primary grid place-items-center font-semibold text-white text-sm uppercase overflow-hidden">
              {profile?.avatar_url ? <img src={profile.avatar_url} alt="" className="h-full w-full object-cover" /> : initial}
            </Link>
            <button onClick={handleSignOut}
              title="Sign out"
              className="h-10 w-10 grid place-items-center rounded-xl bg-surface border border-border hover:border-primary/40 hover:text-primary transition-colors">
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </header>

        <main className="flex-1 px-4 md:px-8 py-6 md:py-10 max-w-[1440px] w-full mx-auto animate-fade-in">
          {children}
        </main>
      </div>
    </div>
  );
}
