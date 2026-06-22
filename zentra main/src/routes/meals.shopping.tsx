import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Bookmark, ChevronLeft, Copy, Loader2, RefreshCw } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { Protected } from "@/components/Protected";
import { useAuth } from "@/hooks/useAuth";
import { useMealPlan } from "@/state/MealPlanContext";
import { generateShoppingList } from "@/lib/api";
import { saveMealBundle } from "@/lib/mealStorage";

export const Route = createFileRoute("/meals/shopping")({
  head: () => ({ meta: [{ title: "Shopping List — Zentra" }] }),
  component: () => (
    <Protected>
      <ShoppingPage />
    </Protected>
  ),
});

function ShoppingPage() {
  const { user } = useAuth();
  const { generatedMealPlan, mealMeta, generatedRecipes, shoppingList, setShoppingList } = useMealPlan();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");

  const generate = async () => {
    if (!generatedMealPlan) {
      setError("Generate a meal plan first.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const data = await generateShoppingList(generatedMealPlan);
      setShoppingList(data.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Shopping list generation failed.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (generatedMealPlan && !shoppingList) void generate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const copy = async () => {
    if (!shoppingList) return;
    const text = Object.entries(shoppingList)
      .map(([category, items]) => `${category}:\n${items.map((item) => `- ${item}`).join("\n")}`)
      .join("\n\n");
    await navigator.clipboard.writeText(text);
    setInfo("Shopping list copied to clipboard.");
  };

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
    else setInfo("Shopping list saved with your meal plan.");
  };

  return (
    <AppShell>
      <div className="space-y-6 max-w-3xl">
        <div className="flex items-center gap-3">
          <Link to="/meals"
            className="h-10 w-10 grid place-items-center rounded-xl bg-surface border border-border hover:border-primary/40 transition">
            <ChevronLeft className="h-4 w-4" />
          </Link>
          <div className="flex-1">
            <p className="text-sm text-muted-foreground">Generated from your meal plan.</p>
            <h1 className="text-3xl font-bold">Shopping List</h1>
          </div>
          {shoppingList && (
            <button onClick={copy}
              className="inline-flex items-center gap-2 h-11 px-4 rounded-xl bg-surface border border-border text-sm hover:border-primary/40 transition">
              <Copy className="h-4 w-4" /> Copy
            </button>
          )}
        </div>

        {error && (
          <div className="rounded-xl border border-destructive/40 bg-destructive/10 px-4 py-2.5 text-sm text-destructive">{error}</div>
        )}
        {info && !error && (
          <div className="rounded-xl border border-primary/30 bg-primary/10 px-4 py-2.5 text-sm text-primary">{info}</div>
        )}

        {!generatedMealPlan ? (
          <div className="card-elevated p-8 text-center">
            <p className="font-semibold">No meal plan yet</p>
            <p className="text-sm text-muted-foreground mt-1">Generate a meal plan first.</p>
            <Link to="/meals" className="mt-4 inline-flex items-center gap-2 h-11 px-5 rounded-xl bg-gradient-primary text-white text-sm font-semibold">
              Go to meal generator
            </Link>
          </div>
        ) : loading ? (
          <div className="card-elevated p-8 grid place-items-center text-sm text-muted-foreground">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
            <span className="mt-2">Generating your shopping list…</span>
          </div>
        ) : shoppingList ? (
          <div className="card-elevated p-6 space-y-6">
            {Object.entries(shoppingList).map(([category, items]) => (
              <div key={category}>
                <strong className="block text-sm uppercase tracking-wider text-primary">{category}</strong>
                <div className="mt-3 space-y-2">
                  {items.map((item, index) => (
                    <label key={`${category}-${index}`} className="flex items-center gap-3 text-sm">
                      <input type="checkbox" className="h-4 w-4 rounded border-border accent-primary" />
                      <span>{item}</span>
                    </label>
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">No shopping list generated yet.</p>
        )}

        <div className="flex flex-wrap gap-3">
          <button onClick={generate} disabled={!generatedMealPlan || loading}
            className="inline-flex items-center gap-2 h-11 px-4 rounded-xl bg-surface border border-border text-sm hover:border-primary/40 transition disabled:opacity-60">
            <RefreshCw className="h-4 w-4" /> Regenerate
          </button>
          <button onClick={save} disabled={!generatedMealPlan}
            className="inline-flex items-center gap-2 h-12 px-5 rounded-xl bg-gradient-primary text-white font-semibold shadow-[0_10px_30px_-10px_var(--glow)] hover:brightness-110 transition disabled:opacity-60">
            <Bookmark className="h-4 w-4" /> Save shopping list
          </button>
        </div>
      </div>
    </AppShell>
  );
}
