import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Bookmark, ChevronLeft, Clock, Loader2, RefreshCw } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { Protected } from "@/components/Protected";
import { useAuth } from "@/hooks/useAuth";
import { useMealPlan } from "@/state/MealPlanContext";
import { generateDailyRecipes } from "@/lib/api";
import { saveMealBundle } from "@/lib/mealStorage";

export const Route = createFileRoute("/meals/daily-recipes")({
  head: () => ({ meta: [{ title: "Daily Recipes — Zentra" }] }),
  component: () => (
    <Protected>
      <DailyRecipesPage />
    </Protected>
  ),
});

const mealKeys = ["breakfast", "lunch", "dinner", "snacks"] as const;
const mealTimes: Record<typeof mealKeys[number], string> = {
  breakfast: "07:30",
  lunch: "12:30",
  snacks: "16:00",
  dinner: "19:30",
};

function DailyRecipesPage() {
  const { user } = useAuth();
  const { generatedMealPlan, mealMeta, generatedRecipes, setGeneratedRecipes, shoppingList } = useMealPlan();
  const day = generatedMealPlan?.day1;
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");

  const generateAll = async () => {
    if (!day) {
      setError("Generate a daily meal plan first.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const data = await generateDailyRecipes({
        breakfast: day.breakfast.food,
        lunch: day.lunch.food,
        dinner: day.dinner.food,
        snacks: day.snacks.food,
      });
      setGeneratedRecipes((prev) => ({
        ...prev,
        ...Object.fromEntries(Object.entries(data).map(([mealKey, recipe]) => [`day1:${mealKey}`, recipe])),
      }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Recipe generation failed.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (day && !mealKeys.every((k) => generatedRecipes[`day1:${k}`])) void generateAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [Boolean(day)]);

  const save = async () => {
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
    else setInfo("Recipes saved with your meal plan.");
  };

  return (
    <AppShell>
      <div className="space-y-6 max-w-4xl">
        <div className="flex items-center gap-3">
          <Link to="/meals"
            className="h-10 w-10 grid place-items-center rounded-xl bg-surface border border-border hover:border-primary/40 transition">
            <ChevronLeft className="h-4 w-4" />
          </Link>
          <div className="flex-1">
            <p className="text-sm text-muted-foreground">Your daily meals with time-wise recipes.</p>
            <h1 className="text-3xl font-bold">Daily Recipes</h1>
          </div>
          <button onClick={generateAll} disabled={!day || loading}
            className="inline-flex items-center gap-2 h-11 px-4 rounded-xl bg-surface border border-border text-sm hover:border-primary/40 transition disabled:opacity-60">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />} Refresh
          </button>
        </div>

        {error && (
          <div className="rounded-xl border border-destructive/40 bg-destructive/10 px-4 py-2.5 text-sm text-destructive">{error}</div>
        )}
        {info && !error && (
          <div className="rounded-xl border border-primary/30 bg-primary/10 px-4 py-2.5 text-sm text-primary">{info}</div>
        )}

        {!day ? (
          <div className="card-elevated p-8 text-center">
            <p className="font-semibold">No daily meal plan yet</p>
            <p className="text-sm text-muted-foreground mt-1">Generate a daily meal plan first.</p>
            <Link to="/meals" className="mt-4 inline-flex items-center gap-2 h-11 px-5 rounded-xl bg-gradient-primary text-white text-sm font-semibold">
              Go to meal generator
            </Link>
          </div>
        ) : (
          <div className="space-y-4">
            {mealKeys.map((mealKey) => {
              const meal = day[mealKey];
              const recipe = generatedRecipes[`day1:${mealKey}`];
              const ingredients = recipe?.ingredients?.items ?? [];
              const steps = recipe?.instructions?.steps ?? [];
              return (
                <article key={mealKey} className="card-elevated p-6 space-y-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-primary/15 text-primary capitalize">{mealKey}</span>
                      <h3 className="text-xl font-bold mt-2">{recipe?.meal_name ?? meal.food}</h3>
                      <p className="text-sm text-muted-foreground mt-1">{meal.portion} · {Math.round(meal.macros.energy_kcal)} cal</p>
                    </div>
                    <span className="inline-flex items-center gap-1 text-xs text-muted-foreground"><Clock className="h-3 w-3" /> {mealTimes[mealKey]}</span>
                  </div>
                  <div className="grid md:grid-cols-2 gap-5">
                    <Section title="Ingredients" items={ingredients.map((i) => `- ${i}`)} empty={loading ? "Asking the chef…" : "No ingredients yet."} />
                    <Section title="Steps" items={steps.map((s, i) => `${i + 1}. ${s}`)} empty={loading ? "Preparing steps…" : "No steps yet."} />
                  </div>
                </article>
              );
            })}
          </div>
        )}

        <button onClick={save} disabled={!generatedMealPlan}
          className="inline-flex items-center gap-2 h-12 px-5 rounded-xl bg-gradient-primary text-white font-semibold shadow-[0_10px_30px_-10px_var(--glow)] hover:brightness-110 transition disabled:opacity-60">
          <Bookmark className="h-4 w-4" /> Save recipes
        </button>
      </div>
    </AppShell>
  );
}

function Section({ title, items, empty }: { title: string; items: string[]; empty: string }) {
  return (
    <div>
      <strong className="block text-sm">{title}</strong>
      <div className="mt-2 text-sm space-y-1 text-muted-foreground">
        {items.length ? items.map((x, i) => <p key={i}>{x}</p>) : <p>{empty}</p>}
      </div>
    </div>
  );
}
