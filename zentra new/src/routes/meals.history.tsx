import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ChevronLeft, Loader2, Trash2, UtensilsCrossed } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { Protected } from "@/components/Protected";
import { useAuth } from "@/hooks/useAuth";
import { useMealPlan } from "@/state/MealPlanContext";
import { supabase, hasSupabaseConfig } from "@/integrations/supabase/client";
import type { RecipeResponse, ShoppingList, WeeklyMealPlan } from "@/lib/api";
import type { MealMeta } from "@/lib/types";

export const Route = createFileRoute("/meals/history")({
  head: () => ({ meta: [{ title: "Meal History — Zentra" }] }),
  component: () => (
    <Protected>
      <MealHistoryPage />
    </Protected>
  ),
});

type SavedRow = {
  id: string;
  week_start_date: string;
  meal_plan_data: {
    plan_type?: "daily" | "weekly";
    culinary_preference?: string;
    dietary_preference?: string;
    goal?: string;
    plan?: WeeklyMealPlan;
    recipes?: Record<string, RecipeResponse>;
    shopping_list?: ShoppingList | null;
    saved_at?: string;
  };
};

function MealHistoryPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { setGeneratedMealPlan, setGeneratedRecipes, setShoppingList, setMealMeta } = useMealPlan();
  const [rows, setRows] = useState<SavedRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!user || !hasSupabaseConfig) {
      setLoading(false);
      return;
    }
    let active = true;
    supabase
      .from("user_meal_history")
      .select("*")
      .eq("user_id", user.id)
      .order("week_start_date", { ascending: false })
      .then(({ data, error: queryError }) => {
        if (!active) return;
        if (queryError) setError(queryError.message);
        setRows((data as unknown as SavedRow[]) ?? []);
        setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [user]);

  const open = (row: SavedRow) => {
    const data = row.meal_plan_data;
    if (!data?.plan) return;
    setGeneratedMealPlan(data.plan);
    setGeneratedRecipes(data.recipes ?? {});
    setShoppingList(data.shopping_list ?? null);
    const meta: MealMeta = {
      culinary: data.culinary_preference ?? "Any",
      diet: data.dietary_preference ?? "None",
      goal: data.goal ?? "",
      planType: data.plan_type ?? "daily",
      // Re-arm expiration from this moment so the user can actually view
      // the plan they just opened instead of having it disappear instantly.
      generatedAt: new Date().toISOString(),
    };
    setMealMeta(meta);
    navigate({ to: meta.planType === "weekly" ? "/meals/weekly" : "/meals/daily-recipes" });
  };

  const remove = async (row: SavedRow) => {
    if (!user || !hasSupabaseConfig) return;
    const { error: deleteError } = await supabase
      .from("user_meal_history")
      .delete()
      .eq("id", row.id);
    if (deleteError) {
      setError(deleteError.message);
      return;
    }
    setRows((prev) => prev.filter((r) => r.id !== row.id));
  };

  return (
    <AppShell>
      <div className="space-y-6 max-w-4xl">
        <div className="flex items-center gap-3">
          <Link to="/history"
            className="h-10 w-10 grid place-items-center rounded-xl bg-surface border border-border hover:border-primary/40 transition">
            <ChevronLeft className="h-4 w-4" />
          </Link>
          <div>
            <p className="text-sm text-muted-foreground">Saved meal plans</p>
            <h1 className="text-3xl font-bold">Meal History</h1>
          </div>
        </div>

        {error && (
          <div className="rounded-xl border border-destructive/40 bg-destructive/10 px-4 py-2.5 text-sm text-destructive">{error}</div>
        )}

        {loading ? (
          <div className="grid place-items-center py-10">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : rows.length === 0 ? (
          <div className="card-elevated p-8 text-center">
            <UtensilsCrossed className="h-8 w-8 text-primary mx-auto" />
            <p className="font-semibold mt-3">No saved meal plans yet</p>
            <p className="text-sm text-muted-foreground mt-1">Generate one and tap Save to keep it here.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {rows.map((row) => {
              const data = row.meal_plan_data ?? {};
              return (
                <article key={row.id} className="card-elevated p-5 flex items-center gap-4">
                  <button onClick={() => open(row)} className="flex-1 text-left">
                    <p className="font-semibold capitalize">{data.plan_type ?? "daily"} plan · {row.week_start_date}</p>
                    <p className="text-sm text-muted-foreground mt-1">
                      {data.culinary_preference ?? "Any"} · {data.dietary_preference ?? "None"}
                      {data.goal ? ` · ${data.goal}` : ""}
                    </p>
                  </button>
                  <button onClick={() => remove(row)} aria-label="Delete saved plan"
                    className="h-10 w-10 grid place-items-center rounded-xl bg-surface border border-border hover:border-destructive/40 hover:text-destructive transition">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </article>
              );
            })}
          </div>
        )}
      </div>
    </AppShell>
  );
}
