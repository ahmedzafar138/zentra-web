import type { User } from "@supabase/supabase-js";
import { supabase, hasSupabaseConfig } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";
import type { RecipeResponse, ShoppingList, WeeklyMealPlan } from "./api";
import type { MealMeta } from "./types";
import { todayKey } from "./format";

export async function saveMealBundle({
  user,
  plan,
  meta,
  recipes,
  shoppingList,
}: {
  user: User | null;
  plan: WeeklyMealPlan | null;
  meta: MealMeta;
  recipes: Record<string, RecipeResponse>;
  shoppingList: ShoppingList | null;
}): Promise<{ error?: string }> {
  if (!user || !plan) return { error: "Generate a meal plan first." };
  if (!hasSupabaseConfig) return { error: "Supabase is not configured." };
  const meal_plan_data: Json = {
    plan_type: meta.planType,
    culinary_preference: meta.culinary,
    dietary_preference: meta.diet,
    goal: meta.goal,
    plan: plan as unknown as Json,
    recipes: recipes as unknown as Json,
    shopping_list: (shoppingList ?? null) as unknown as Json,
    saved_at: new Date().toISOString(),
  };
  const { error } = await supabase.from("user_meal_history").upsert(
    {
      user_id: user.id,
      week_start_date: todayKey(),
      meal_plan_data,
    },
    { onConflict: "user_id,week_start_date" },
  );
  return error ? { error: error.message } : {};
}

export function sortedMealDays(plan: WeeklyMealPlan | null) {
  return plan
    ? Object.keys(plan).sort((a, b) => Number(a.replace("day", "")) - Number(b.replace("day", "")))
    : [];
}
