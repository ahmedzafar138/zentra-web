import { createFileRoute, Link } from "@tanstack/react-router";
import { BarChart3, Footprints, History as HistoryIcon, UtensilsCrossed } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { Protected } from "@/components/Protected";

export const Route = createFileRoute("/history")({
  head: () => ({ meta: [{ title: "History — Zentra" }] }),
  component: () => (
    <Protected>
      <HistoryHub />
    </Protected>
  ),
});

const options = [
  { to: "/workouts/history" as const, icon: BarChart3, title: "Logs History", subtitle: "View your workout history" },
  { to: "/sessions/history" as const, icon: HistoryIcon, title: "Session History", subtitle: "View live form correction summaries" },
  { to: "/meals/history" as const, icon: UtensilsCrossed, title: "Meal History", subtitle: "View your saved meal plans" },
  { to: "/steps/history" as const, icon: Footprints, title: "Steps History", subtitle: "View your step tracking history" },
];

function HistoryHub() {
  return (
    <AppShell>
      <div className="space-y-6 max-w-4xl">
        <div>
          <h1 className="text-3xl md:text-4xl font-bold">History</h1>
          <p className="text-sm text-muted-foreground mt-1.5">Track your fitness journey</p>
        </div>
        <div className="grid sm:grid-cols-2 gap-5">
          {options.map((o) => {
            const Icon = o.icon;
            return (
              <Link key={o.title} to={o.to} className="card-elevated p-6 group block">
                <div className="h-11 w-11 rounded-xl bg-gradient-primary grid place-items-center shadow-[0_8px_24px_-8px_var(--glow)]">
                  <Icon className="h-5 w-5 text-white" />
                </div>
                <h3 className="font-semibold mt-4 group-hover:text-primary transition-colors">{o.title}</h3>
                <p className="text-sm text-muted-foreground mt-1">{o.subtitle}</p>
              </Link>
            );
          })}
        </div>
      </div>
    </AppShell>
  );
}
