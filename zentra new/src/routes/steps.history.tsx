import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Activity, ChevronLeft, Flame, Footprints, Loader2 } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { Protected } from "@/components/Protected";
import { useAuth } from "@/hooks/useAuth";
import { supabase, hasSupabaseConfig } from "@/integrations/supabase/client";
import { monthKey } from "@/lib/format";

export const Route = createFileRoute("/steps/history")({
  head: () => ({ meta: [{ title: "Steps History — Zentra" }] }),
  component: () => (
    <Protected>
      <StepsHistoryPage />
    </Protected>
  ),
});

type StepRow = {
  id: string;
  date: string;
  steps: number | null;
  goal: number | null;
  kcal: number | null;
  distance_km: number | null;
};

function StepsHistoryPage() {
  const { user } = useAuth();
  const [rows, setRows] = useState<StepRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!user || !hasSupabaseConfig) {
      setLoading(false);
      return;
    }
    let active = true;
    supabase
      .from("step_tracking")
      .select("*")
      .eq("user_id", user.id)
      .gte("date", `${monthKey()}-01`)
      .order("date", { ascending: false })
      .then(({ data, error: queryError }) => {
        if (!active) return;
        if (queryError) setError(queryError.message);
        setRows((data as unknown as StepRow[]) ?? []);
        setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [user]);

  const totals = rows.reduce(
    (sum, row) => ({
      steps: sum.steps + Number(row.steps ?? 0),
      km: sum.km + Number(row.distance_km ?? 0),
      kcal: sum.kcal + Number(row.kcal ?? 0),
    }),
    { steps: 0, km: 0, kcal: 0 },
  );

  return (
    <AppShell>
      <div className="space-y-8 max-w-4xl">
        <div className="flex items-center gap-3">
          <Link to="/steps"
            className="h-10 w-10 grid place-items-center rounded-xl bg-surface border border-border hover:border-primary/40 transition">
            <ChevronLeft className="h-4 w-4" />
          </Link>
          <div>
            <p className="text-sm text-muted-foreground">This month</p>
            <h1 className="text-3xl font-bold">Steps History</h1>
          </div>
        </div>

        {error && (
          <div className="rounded-xl border border-destructive/40 bg-destructive/10 px-4 py-2.5 text-sm text-destructive">{error}</div>
        )}

        <div className="grid grid-cols-3 gap-3">
          {[
            { icon: Footprints, value: totals.steps.toLocaleString(), label: "Total steps" },
            { icon: Activity, value: totals.km.toFixed(1), label: "Kilometers" },
            { icon: Flame, value: Math.round(totals.kcal).toLocaleString(), label: "Calories" },
          ].map((s) => (
            <div key={s.label} className="card-elevated p-4 text-center">
              <s.icon className="h-5 w-5 mx-auto text-primary" />
              <p className="text-xl font-semibold mt-2">{s.value}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{s.label}</p>
            </div>
          ))}
        </div>

        <div className="card-elevated p-6">
          <h2 className="text-lg font-semibold mb-4">Daily entries</h2>
          {loading ? (
            <div className="grid place-items-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : rows.length === 0 ? (
            <p className="text-sm text-muted-foreground py-6 text-center">No step entries yet this month.</p>
          ) : (
            <div className="divide-y divide-border">
              {rows.map((row) => (
                <div key={row.id} className="py-4 flex items-center justify-between">
                  <div>
                    <p className="font-medium">{new Date(row.date).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {Number(row.distance_km ?? 0).toFixed(2)} km · {Math.round(Number(row.kcal ?? 0))} kcal
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold">{Number(row.steps ?? 0).toLocaleString()}</p>
                    <p className="text-xs text-muted-foreground">of {Number(row.goal ?? 0).toLocaleString()}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </AppShell>
  );
}
