import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Bookmark, ChevronLeft, Flame, Loader2, ShoppingBag } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { Protected } from "@/components/Protected";
import { useAuth } from "@/hooks/useAuth";
import { useMealPlan } from "@/state/MealPlanContext";
import type { DayMealPlan } from "@/lib/api";
import { saveMealBundle, sortedMealDays } from "@/lib/mealStorage";

export const Route = createFileRoute("/meals/weekly")({
  head: () => ({ meta: [{ title: "Weekly Meal Plan — Zentra" }] }),
  component: () => (
    <Protected>
      <WeeklyPage />
    </Protected>
  ),
});

function WeeklyPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { generatedMealPlan, mealMeta, generatedRecipes, shoppingList, setSelectedMealRecipe } = useMealPlan();
  const days = sortedMealDays(generatedMealPlan);
  const [saving, setSaving] = useState(false);
  const [info, setInfo] = useState("");
  const [error, setError] = useState("");

  const openMeal = (dayKey: string, mealKey: keyof DayMealPlan) => {
    setSelectedMealRecipe({ dayKey, mealKey });
    navigate({ to: "/meals/recipe" });
  };

  const save = async () => {
    setSaving(true);
    setError("");
    setInfo("");
    const result = await saveMealBundle({
      user,
      plan: generatedMealPlan,
      meta: mealMeta,
      recipes: generatedRecipes,
      shoppingList,
    });
    if (result.error) setError(result.error);
    else setInfo("Meal plan saved to history.");
    setSaving(false);
  };

  return (
    <AppShell>
      <div className="space-y-6 max-w-5xl">
        <div className="flex items-center gap-3">
          <Link to="/meals"
            className="h-10 w-10 grid place-items-center rounded-xl bg-surface border border-border hover:border-primary/40 transition">
            <ChevronLeft className="h-4 w-4" />
          </Link>
          <div className="flex-1">
            <p className="text-sm text-muted-foreground">{mealMeta.planType === "weekly" ? "7-Day Meal Plan" : "Meal Plan"}</p>
            <h1 className="text-3xl font-bold">Weekly view</h1>
          </div>
          <Link to="/meals/shopping"
            className="hidden sm:inline-flex items-center gap-2 h-11 px-4 rounded-xl bg-surface border border-border text-sm hover:border-primary/40 transition">
            <ShoppingBag className="h-4 w-4" /> Shopping list
          </Link>
        </div>

        {error && (
          <div className="rounded-xl border border-destructive/40 bg-destructive/10 px-4 py-2.5 text-sm text-destructive">{error}</div>
        )}
        {info && (
          <div className="rounded-xl border border-primary/30 bg-primary/10 px-4 py-2.5 text-sm text-primary">{info}</div>
        )}

        {!generatedMealPlan ? (
          <div className="card-elevated p-8 text-center">
            <p className="font-semibold">No generated meal plan yet</p>
            <p className="text-sm text-muted-foreground mt-1">Generate a daily or weekly plan first.</p>
            <Link to="/meals" className="mt-4 inline-flex items-center gap-2 h-11 px-5 rounded-xl bg-gradient-primary text-white text-sm font-semibold">
              Go to meal generator
            </Link>
          </div>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {days.map((dayKey) => {
              const day = generatedMealPlan[dayKey];
              if (!day) return null;
              const meals = Object.entries(day) as [keyof DayMealPlan, DayMealPlan[keyof DayMealPlan]][];
              const dayCal = meals.reduce((sum, [, meal]) => sum + Number(meal.macros?.energy_kcal ?? 0), 0);
              return (
                <article key={dayKey} className="card-elevated p-5">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-semibold">Day {dayKey.replace("day", "")}</h3>
                    <span className="text-xs inline-flex items-center gap-1 text-primary">
                      <Flame className="h-3 w-3" /> {Math.round(dayCal)} kcal
                    </span>
                  </div>
                  <div className="space-y-2">
                    {meals.map(([mealKey, meal]) => (
                      <button key={mealKey} onClick={() => openMeal(dayKey, mealKey)}
                        className="w-full text-left rounded-xl bg-surface-elevated border border-border p-3 hover:border-primary/40 transition">
                        <p className="text-xs uppercase tracking-wider text-muted-foreground">{mealKey}</p>
                        <p className="text-sm font-medium mt-0.5">{meal.food}</p>
                        <p className="text-xs text-primary mt-1">{Math.round(meal.macros.energy_kcal)} cal</p>
                      </button>
                    ))}
                  </div>
                </article>
              );
            })}
          </div>
        )}

        <button onClick={save} disabled={!generatedMealPlan || saving}
          className="inline-flex items-center gap-2 h-12 px-5 rounded-xl bg-gradient-primary text-white font-semibold shadow-[0_10px_30px_-10px_var(--glow)] hover:brightness-110 transition disabled:opacity-60">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Bookmark className="h-4 w-4" />} Save meal plan
        </button>
      </div>
    </AppShell>
  );
}
