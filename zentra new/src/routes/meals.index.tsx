import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { ArrowRight, Bookmark, ChefHat, ChevronDown, Loader2, Sparkles, ShoppingBag } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { Protected } from "@/components/Protected";
import { useAuth } from "@/hooks/useAuth";
import { useMealPlan } from "@/state/MealPlanContext";
import { generateDailyMealPlan, generateWeeklyMealPlan, parseMealPlan } from "@/lib/api";
import { saveMealBundle } from "@/lib/mealStorage";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/meals/")({
  head: () => ({ meta: [{ title: "Meal Plans — Zentra" }] }),
  component: () => (
    <Protected>
      <MealsPage />
    </Protected>
  ),
});

const culinaryOptions = ["Any", "Pakistani", "Italian", "Mexican", "Chinese", "American", "Mediterranean", "Thai"];
const dietaryOptions = ["None", "Vegetarian", "Keto", "Paleo", "High Protein", "Nut Free", "Dairy Free", "Gluten Free"];

function MealsPage() {
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const {
    generatedMealPlan, setGeneratedMealPlan,
    mealMeta, setMealMeta,
    generatedRecipes, setGeneratedRecipes,
    shoppingList, setShoppingList,
  } = useMealPlan();

  const [culinary, setCulinary] = useState(mealMeta.culinary);
  const [diet, setDiet] = useState(mealMeta.diet);
  const [goal, setGoal] = useState(mealMeta.goal);
  const [loading, setLoading] = useState<"daily" | "weekly" | "">("");
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");

  const day = generatedMealPlan?.day1;
  const meals = day ? [day.breakfast, day.lunch, day.dinner, day.snacks] : [];
  const totals = meals.reduce(
    (sum, meal) => ({
      calories: sum.calories + Number(meal?.macros?.energy_kcal ?? 0),
      protein: sum.protein + Number(meal?.macros?.protein_g ?? 0),
      carbs: sum.carbs + Number(meal?.macros?.carbohydrates_g ?? 0),
      fat: sum.fat + Number(meal?.macros?.fat_g ?? 0),
    }),
    { calories: 0, protein: 0, carbs: 0, fat: 0 },
  );

  const promptText = `Height: ${profile?.height_cm ?? "not set"} cm. Weight: ${profile?.weight_kg ?? "not set"} kg. Culinary preference: ${culinary}. Dietary preference: ${diet}. Goal: ${goal || "balanced fitness nutrition"}.`;

  const generate = async (kind: "daily" | "weekly") => {
    setLoading(kind);
    setError("");
    setInfo("");
    try {
      const response = kind === "daily"
        ? await generateDailyMealPlan({ userProfile: promptText, dietaryPreference: diet, additionalRequirements: goal })
        : await generateWeeklyMealPlan({ userProfile: promptText, dietaryPreference: diet, additionalRequirements: goal });
      if (!response.meal_plan) throw new Error(response.message || "Meal generator returned no plan.");
      const plan = parseMealPlan(response.meal_plan);
      setGeneratedMealPlan(plan);
      setMealMeta({ culinary, diet, goal, planType: kind, generatedAt: new Date().toISOString() });
      setGeneratedRecipes({});
      setShoppingList(null);
      if (kind === "weekly") navigate({ to: "/meals/weekly" });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Meal plan generation failed.");
    } finally {
      setLoading("");
    }
  };

  const save = async () => {
    setError("");
    setInfo("");
    const result = await saveMealBundle({
      user,
      plan: generatedMealPlan,
      meta: { culinary, diet, goal, planType: mealMeta.planType },
      recipes: generatedRecipes,
      shoppingList,
    });
    if (result.error) setError(result.error);
    else setInfo("Meal plan saved to history.");
  };

  return (
    <AppShell>
      <div className="space-y-8 max-w-5xl">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-3xl md:text-4xl font-bold">Meal Generator</h1>
            <p className="text-sm text-muted-foreground mt-1.5">Meal plan catered to your calorie intake.</p>
          </div>
          <Link to="/meals/history" search={{ from: "meals" }}
            className="inline-flex items-center gap-2 h-11 px-4 rounded-xl bg-surface border border-border text-sm hover:border-primary/40 transition">
            History <ArrowRight className="h-4 w-4" />
          </Link>
        </div>

        {error && (
          <div className="rounded-xl border border-destructive/40 bg-destructive/10 px-4 py-2.5 text-sm text-destructive">{error}</div>
        )}
        {info && !error && (
          <div className="rounded-xl border border-primary/30 bg-primary/10 px-4 py-2.5 text-sm text-primary">{info}</div>
        )}

        <div className="card-elevated p-6 space-y-5">
          <div className="grid sm:grid-cols-2 gap-4">
            <Dropdown label="Culinary Preference" value={culinary} onChange={setCulinary} options={culinaryOptions} />
            <Dropdown label="Dietary Preference" value={diet} onChange={setDiet} options={dietaryOptions} />
          </div>
          <div className="rounded-2xl bg-surface-elevated border border-border p-4">
            <textarea
              value={goal}
              onChange={(e) => setGoal(e.target.value)}
              placeholder="Describe your goals — e.g. 'Lean bulk, 2,400 kcal, 180g protein, no dairy, quick weekday meals.'"
              className="w-full min-h-[120px] bg-transparent resize-none outline-none text-sm placeholder:text-muted-foreground"
            />
            <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-border">
              <p className="text-xs text-muted-foreground">Zentra AI · personalized to your profile</p>
              <div className="flex flex-wrap gap-2">
                <button onClick={() => generate("daily")} disabled={Boolean(loading)}
                  className="inline-flex items-center gap-2 h-10 px-5 rounded-xl bg-gradient-primary text-white text-sm font-semibold shadow-[0_10px_30px_-10px_var(--glow)] hover:brightness-110 transition disabled:opacity-60">
                  {loading === "daily" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                  Generate Daily Plan
                </button>
                <button onClick={() => generate("weekly")} disabled={Boolean(loading)}
                  className="inline-flex items-center gap-2 h-10 px-5 rounded-xl bg-surface border border-border text-sm hover:border-primary/40 transition disabled:opacity-60">
                  {loading === "weekly" ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  Generate 7-Day Plan
                </button>
              </div>
            </div>
          </div>
        </div>

        {generatedMealPlan && (
          <>
            <div>
              <h2 className="text-xl font-semibold mb-4">Preview · {mealMeta.planType === "weekly" ? "Weekly plan" : "Daily plan"}</h2>
              <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
                {(["Breakfast", "Lunch", "Dinner", "Snacks"] as const).map((label, index) => {
                  const meal = meals[index];
                  return (
                    <div key={label} className="card-elevated p-5">
                      <p className="text-xs uppercase tracking-wider text-muted-foreground">{label}</p>
                      <p className="font-semibold mt-2">{meal?.food ?? "Not generated yet"}</p>
                      <p className="text-xs text-primary mt-2">{Math.round(meal?.macros?.energy_kcal ?? 0)} cal</p>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="card-elevated p-6">
              <p className="text-xs uppercase tracking-wider text-muted-foreground">Daily totals</p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4">
                <Stat label="Calories" value={Math.round(totals.calories)} suffix="" />
                <Stat label="Protein" value={Math.round(totals.protein)} suffix="g" />
                <Stat label="Carbs" value={Math.round(totals.carbs)} suffix="g" />
                <Stat label="Fat" value={Math.round(totals.fat)} suffix="g" />
              </div>
            </div>

            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <ActionButton to="/meals/daily-recipes" label="Show Recipes" icon={ChefHat} disabled={!generatedMealPlan} />
              {mealMeta.planType === "weekly" && (
                <ActionButton to="/meals/weekly" label="View Weekly Plan" icon={ChefHat} />
              )}
              <ActionButton to="/meals/shopping" label="Shopping List" icon={ShoppingBag} disabled={!generatedMealPlan} />
              <button onClick={save} disabled={!generatedMealPlan}
                className="inline-flex items-center justify-center gap-2 h-12 rounded-xl bg-gradient-primary text-white text-sm font-semibold shadow-[0_10px_30px_-10px_var(--glow)] hover:brightness-110 transition disabled:opacity-60">
                <Bookmark className="h-4 w-4" /> Save plan
              </button>
            </div>
          </>
        )}
      </div>
    </AppShell>
  );
}

function ActionButton({ to, label, icon: Icon, disabled }: { to: "/meals/daily-recipes" | "/meals/weekly" | "/meals/shopping"; label: string; icon: typeof ChefHat; disabled?: boolean }) {
  if (disabled) {
    return (
      <button disabled
        className="inline-flex items-center justify-center gap-2 h-12 rounded-xl bg-surface border border-border text-sm opacity-50 cursor-not-allowed">
        <Icon className="h-4 w-4" /> {label}
      </button>
    );
  }
  return (
    <Link to={to}
      className="inline-flex items-center justify-center gap-2 h-12 rounded-xl bg-surface border border-border text-sm hover:border-primary/40 transition">
      <Icon className="h-4 w-4" /> {label}
    </Link>
  );
}

function Stat({ label, value, suffix }: { label: string; value: number; suffix: string }) {
  return (
    <div className="rounded-xl bg-surface-elevated border border-border p-3">
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="text-2xl font-bold mt-1">{value.toLocaleString()}<span className="text-sm font-medium text-muted-foreground">{suffix}</span></p>
    </div>
  );
}

function Dropdown({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: string[] }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <label className="text-xs text-muted-foreground">{label}</label>
      <button type="button" onClick={() => setOpen(!open)}
        className="mt-1.5 w-full h-11 px-4 rounded-xl bg-surface-elevated border border-border flex items-center justify-between text-sm hover:border-primary/40 transition">
        <span>{value}</span>
        <ChevronDown className={cn("h-4 w-4 text-muted-foreground transition-transform", open && "rotate-180")} />
      </button>
      {open && (
        <div className="absolute z-20 mt-1.5 w-full rounded-xl bg-surface-elevated border border-border shadow-xl overflow-hidden max-h-64 overflow-y-auto">
          {options.map((o) => (
            <button key={o} type="button" onClick={() => { onChange(o); setOpen(false); }}
              className={cn("w-full text-left px-4 py-2.5 text-sm hover:bg-primary/10 transition", o === value && "text-primary bg-primary/5")}>
              {o}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
