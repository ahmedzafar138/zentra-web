import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Bookmark, ChevronLeft, Loader2, RefreshCw } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { Protected } from "@/components/Protected";
import { useAuth } from "@/hooks/useAuth";
import { useMealPlan } from "@/state/MealPlanContext";
import { generateDailyRecipes } from "@/lib/api";
import { saveMealBundle } from "@/lib/mealStorage";

export const Route = createFileRoute("/meals/recipe")({
  head: () => ({ meta: [{ title: "Meal Recipe — Zentra" }] }),
  component: () => (
    <Protected>
      <RecipePage />
    </Protected>
  ),
});

function RecipePage() {
  const { user } = useAuth();
  const {
    generatedMealPlan, mealMeta,
    selectedMealRecipe,
    generatedRecipes, setGeneratedRecipes,
    shoppingList,
  } = useMealPlan();

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");

  const recipeKey = selectedMealRecipe ? `${selectedMealRecipe.dayKey}:${selectedMealRecipe.mealKey}` : "";
  const meal = selectedMealRecipe ? generatedMealPlan?.[selectedMealRecipe.dayKey]?.[selectedMealRecipe.mealKey] : null;
  const recipe = recipeKey ? generatedRecipes[recipeKey] : null;

  const generate = async () => {
    if (!selectedMealRecipe || !meal) {
      setError("Open a meal from the weekly plan first.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const data = await generateDailyRecipes({ [selectedMealRecipe.mealKey]: meal.food });
      const nextRecipe = data[selectedMealRecipe.mealKey] ?? Object.values(data)[0];
      setGeneratedRecipes((prev) => ({ ...prev, [recipeKey]: nextRecipe }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Recipe generation failed.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (meal && recipeKey && !generatedRecipes[recipeKey]) void generate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recipeKey]);

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
    else setInfo("Recipe saved with your meal plan.");
  };

  const ingredients = recipe?.ingredients?.items ?? [];
  const steps = recipe?.instructions?.steps ?? [];

  return (
    <AppShell>
      <div className="space-y-6 max-w-3xl">
        <div className="flex items-center gap-3">
          <Link to="/meals/weekly"
            className="h-10 w-10 grid place-items-center rounded-xl bg-surface border border-border hover:border-primary/40 transition">
            <ChevronLeft className="h-4 w-4" />
          </Link>
          <div>
            <p className="text-sm text-muted-foreground">{selectedMealRecipe ? `Day ${selectedMealRecipe.dayKey.replace("day", "")} · ${selectedMealRecipe.mealKey}` : "Recipe"}</p>
            <h1 className="text-3xl font-bold">Recipe</h1>
          </div>
        </div>

        {error && (
          <div className="rounded-xl border border-destructive/40 bg-destructive/10 px-4 py-2.5 text-sm text-destructive">{error}</div>
        )}
        {info && !error && (
          <div className="rounded-xl border border-primary/30 bg-primary/10 px-4 py-2.5 text-sm text-primary">{info}</div>
        )}

        {!meal ? (
          <div className="card-elevated p-8 text-center">
            <p className="font-semibold">No meal selected</p>
            <p className="text-sm text-muted-foreground mt-1">Open a meal from the weekly plan first.</p>
            <Link to="/meals/weekly"
              className="mt-4 inline-flex items-center gap-2 h-11 px-5 rounded-xl bg-gradient-primary text-white text-sm font-semibold">
              Go to weekly plan
            </Link>
          </div>
        ) : (
          <article className="card-elevated p-6 space-y-5">
            <div>
              <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-primary/15 text-primary capitalize">
                {selectedMealRecipe?.mealKey}
              </span>
              <h2 className="text-2xl font-bold mt-3">{recipe?.meal_name ?? meal.food}</h2>
              <p className="text-sm text-muted-foreground mt-1">{meal.portion} · {Math.round(meal.macros.energy_kcal)} cal</p>
            </div>

            {loading && (
              <div className="grid place-items-center py-8 text-sm text-muted-foreground">
                <Loader2 className="h-5 w-5 animate-spin text-primary" />
                <span className="mt-2">Generating recipe…</span>
              </div>
            )}

            {!loading && (
              <>
                <Section title="Ingredients" items={ingredients.map((i) => `- ${i}`)} empty="No ingredients returned yet." />
                <Section title="Steps" items={steps.map((s, i) => `${i + 1}. ${s}`)} empty="No steps returned yet." />
              </>
            )}

            <div className="flex flex-wrap gap-3">
              <button onClick={generate} disabled={loading}
                className="inline-flex items-center gap-2 h-11 px-4 rounded-xl bg-surface border border-border text-sm hover:border-primary/40 transition disabled:opacity-60">
                <RefreshCw className="h-4 w-4" /> Regenerate
              </button>
              <button onClick={save} disabled={!generatedMealPlan}
                className="inline-flex items-center gap-2 h-11 px-4 rounded-xl bg-gradient-primary text-white text-sm font-semibold shadow-[0_10px_30px_-10px_var(--glow)] hover:brightness-110 transition disabled:opacity-60">
                <Bookmark className="h-4 w-4" /> Save
              </button>
            </div>
          </article>
        )}
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
