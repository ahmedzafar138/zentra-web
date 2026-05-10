import { FormEvent, useEffect, useMemo, useRef, useState, type Dispatch, type SetStateAction } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { Activity, Award, BarChart3, BicepsFlexed, BotMessageSquare, Camera, Check, CheckCircle, CheckSquare, ChefHat, ChevronRight, Clock, Copy, Dumbbell, Eye, EyeOff, Flame, Footprints, History as HistoryIcon, Home, Loader2, LogOut, MessageCircle, Newspaper, Pause, Play, RefreshCw, RotateCcw, Send, Shirt, Sparkles, Square, TrendingUp, Trash2, User as UserIcon, UtensilsCrossed } from "lucide-react";
import { DayMealPlan, WeeklyMealPlan, askZentra, checkAllServices, generateDailyMealPlan, generateDailyRecipes, generateShoppingList, generateWeeklyMealPlan, loadBicepCurlModel, loadDeadliftModel, loadDumbbellFlyModel, loadPlankModel, loadPushupModel, loadSquatModel, MODEL_GATEWAY_API_BASE_URL, parseMealPlan, type RecipeResponse, type ServiceCheck, type ShoppingList } from "@/lib/api";
import { supabase, hasSupabaseConfig } from "@/lib/supabase";
import { PrimaryButton, ScreenHeader, EmptyState, Stat } from "@/components/ui";
import type { AppScreen, BlogPost, FormSessionSummary, MealMeta, MetricPickerState, Message, Profile, SelectedMealRecipe, ExerciseLog, WorkoutSet } from "@/app/types";
import { bmiCategory, calculateBmi, formatDuration, formatHeightValue, formatWeightValue, monthKey, todayKey } from "@/app/utils";
export function MealPlanScreen({
  user,
  profile,
  navigate,
  showToast,
  openMealHistory,
  generatedMealPlan,
  setGeneratedMealPlan,
  mealMeta,
  setMealMeta,
  setGeneratedRecipes,
  generatedRecipes,
  shoppingList,
  setShoppingList,
}: {
  user: User | null;
  profile: Profile | null;
  navigate: (screen: AppScreen) => void;
  showToast: (message: string) => void;
  openMealHistory: (backTo: AppScreen) => void;
  generatedMealPlan: WeeklyMealPlan | null;
  setGeneratedMealPlan: (plan: WeeklyMealPlan | null) => void;
  mealMeta: MealMeta;
  setMealMeta: (meta: MealMeta) => void;
  setGeneratedRecipes: (recipes: Record<string, RecipeResponse>) => void;
  generatedRecipes: Record<string, RecipeResponse>;
  shoppingList: ShoppingList | null;
  setShoppingList: (list: ShoppingList | null) => void;
}) {
  const [culinary, setCulinary] = useState(mealMeta.culinary);
  const [diet, setDiet] = useState(mealMeta.diet);
  const [goal, setGoal] = useState(mealMeta.goal);
  const [loading, setLoading] = useState<"daily" | "weekly" | "">("");
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

  const prompt = `Height: ${profile?.height_cm ?? "not set"} cm. Weight: ${profile?.weight_kg ?? "not set"} kg. Culinary preference: ${culinary}. Dietary preference: ${diet}. Goal: ${goal || "balanced fitness nutrition"}.`;

  const generate = async (kind: "daily" | "weekly") => {
    setLoading(kind);
    try {
      const response = kind === "daily"
        ? await generateDailyMealPlan({ userProfile: prompt, dietaryPreference: diet, additionalRequirements: goal })
        : await generateWeeklyMealPlan({ userProfile: prompt, dietaryPreference: diet, additionalRequirements: goal });
      if (!response.meal_plan) throw new Error(response.message || "Meal generator returned no plan.");
      const plan = parseMealPlan(response.meal_plan);
      setGeneratedMealPlan(plan);
      setMealMeta({ culinary, diet, goal, planType: kind });
      setGeneratedRecipes({});
      setShoppingList(null);
      if (kind === "weekly") navigate("mealWeekly");
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Meal plan generation failed.");
    } finally {
      setLoading("");
    }
  };

  const save = async () => {
    await saveMealBundle({
      user,
      plan: generatedMealPlan,
      meta: { culinary, diet, goal, planType: mealMeta.planType },
      recipes: generatedRecipes,
      shoppingList,
      showToast,
    });
  };

  return (
    <section className="screen-pad with-tabs">
      <ScreenHeader
        title="Meal Generator"
        subtitle="Meal plan catered to your calorie intake."
        onBack={() => navigate("home")}
        onLogo={() => navigate("home")}
        action={<button className="text-link" onClick={() => openMealHistory("mealPlan")}>History</button>}
      />
      <div className="form-row">
        <label>Culinary Preference<select value={culinary} onChange={(e) => setCulinary(e.target.value)}>{["Any", "Pakistani", "Italian", "Mexican", "Chinese", "American", "Mediterranean", "Thai"].map((item) => <option key={item}>{item}</option>)}</select></label>
        <label>Dietary Preference<select value={diet} onChange={(e) => setDiet(e.target.value)}>{["None", "Vegetarian", "Keto", "Paleo", "High Protein", "Nut Free", "Dairy Free", "Gluten Free"].map((item) => <option key={item}>{item}</option>)}</select></label>
      </div>
      <label className="full-label">Your Goal<textarea value={goal} onChange={(event) => setGoal(event.target.value)} placeholder="I want to lose weight and build muscle" /></label>
      <h3 className="section-title">Preview</h3>
      <div className="meal-preview-grid">
        {["Breakfast", "Lunch", "Dinner", "Snacks"].map((label, index) => {
          const meal = meals[index];
          return <div className="meal-preview" key={label}><strong>{label}</strong><span>{meal?.food ?? "Not generated yet"}</span><em>{Math.round(meal?.macros?.energy_kcal ?? 0)} cal</em></div>;
        })}
      </div>
      <div className="totals-card">
        <strong>Daily Totals</strong>
        <div><Stat icon={ChefHat} value={Math.round(totals.calories)} label="Calories" /><Stat icon={Activity} value={`${Math.round(totals.protein)}g`} label="Protein" /><Stat icon={Activity} value={`${Math.round(totals.carbs)}g`} label="Carbs" /><Stat icon={Activity} value={`${Math.round(totals.fat)}g`} label="Fat" /></div>
      </div>
      <PrimaryButton onClick={() => generate("daily")} disabled={Boolean(loading)}>{loading === "daily" ? "Generating Daily Plan..." : "Generate Daily Plan"}</PrimaryButton>
      <button className="secondary-button" onClick={() => navigate("mealDailyRecipes")} disabled={!generatedMealPlan}>Show Recipes</button>
      <button className="text-link centered" onClick={() => generate("weekly")} disabled={Boolean(loading)}>{loading === "weekly" ? "Generating 7-Day Plan..." : "Generate 7-Day Weekly Plan"}</button>
      <div className="meal-action-grid">
        <button className="secondary-button" onClick={save} disabled={!generatedMealPlan}>Save Current Meal Plan</button>
        <button className="secondary-button" onClick={() => navigate("mealShopping")} disabled={!generatedMealPlan}>Generate Shopping List</button>
      </div>
    </section>
  );
}

function sortedMealDays(plan: WeeklyMealPlan | null) {
  return plan ? Object.keys(plan).sort((a, b) => Number(a.replace("day", "")) - Number(b.replace("day", ""))) : [];
}

async function saveMealBundle({
  user,
  plan,
  meta,
  recipes,
  shoppingList,
  showToast,
}: {
  user: User | null;
  plan: WeeklyMealPlan | null;
  meta: MealMeta;
  recipes: Record<string, RecipeResponse>;
  shoppingList: ShoppingList | null;
  showToast: (message: string) => void;
}) {
  if (!user || !plan) {
    showToast("Generate a meal plan first.");
    return;
  }

  const { error } = await supabase.from("user_meal_history").upsert(
    {
      user_id: user.id,
      week_start_date: todayKey(),
      meal_plan_data: {
        plan_type: meta.planType,
        culinary_preference: meta.culinary,
        dietary_preference: meta.diet,
        goal: meta.goal,
        plan,
        recipes,
        shopping_list: shoppingList,
        saved_at: new Date().toISOString(),
      },
    },
    { onConflict: "user_id,week_start_date" },
  );
  showToast(error ? error.message : "Meal plan saved with recipes and shopping list.");
}

export function WeeklyMealPlanScreen({
  user,
  navigate,
  showToast,
  generatedMealPlan,
  mealMeta,
  setSelectedMealRecipe,
  generatedRecipes,
  shoppingList,
}: {
  user: User | null;
  navigate: (screen: AppScreen) => void;
  showToast: (message: string) => void;
  generatedMealPlan: WeeklyMealPlan | null;
  mealMeta: MealMeta;
  setSelectedMealRecipe: (selection: SelectedMealRecipe) => void;
  generatedRecipes: Record<string, RecipeResponse>;
  shoppingList: ShoppingList | null;
}) {
  const days = sortedMealDays(generatedMealPlan);
  const openMeal = (dayKey: string, mealKey: keyof DayMealPlan) => {
    setSelectedMealRecipe({ dayKey, mealKey });
    navigate("mealRecipe");
  };

  return (
    <section className="screen-pad with-tabs">
      <ScreenHeader title={mealMeta.planType === "weekly" ? "7-Day Meal Plan" : "Meal Plan"} subtitle="Tap any meal to generate its recipe." onBack={() => navigate("mealPlan")} onLogo={() => navigate("home")} />
      {!generatedMealPlan ? <EmptyState title="No generated meal plan yet" body="Generate a daily or weekly plan first." /> : null}
      <div className="weekly-page-grid">
        {days.map((dayKey) => {
          const day = generatedMealPlan?.[dayKey];
          if (!day) return null;
          const meals = Object.entries(day) as [keyof DayMealPlan, DayMealPlan[keyof DayMealPlan]][];
          return (
            <article className="weekly-day-card" key={dayKey}>
              <h3>Day {dayKey.replace("day", "")}</h3>
              {meals.map(([mealKey, meal]) => (
                <button className="weekly-meal-row" key={mealKey} onClick={() => openMeal(dayKey, mealKey)}>
                  <span>{mealKey}</span>
                  <strong>{meal.food}</strong>
                  <small>{Math.round(meal.macros.energy_kcal)} cal</small>
                </button>
              ))}
            </article>
          );
        })}
      </div>
      <PrimaryButton onClick={() => saveMealBundle({ user, plan: generatedMealPlan, meta: mealMeta, recipes: generatedRecipes, shoppingList, showToast })} disabled={!generatedMealPlan}>Save Meal Plan</PrimaryButton>
    </section>
  );
}

export function MealRecipeScreen({
  user,
  navigate,
  showToast,
  generatedMealPlan,
  mealMeta,
  selectedMealRecipe,
  generatedRecipes,
  setGeneratedRecipes,
  shoppingList,
}: {
  user: User | null;
  navigate: (screen: AppScreen) => void;
  showToast: (message: string) => void;
  generatedMealPlan: WeeklyMealPlan | null;
  mealMeta: MealMeta;
  selectedMealRecipe: SelectedMealRecipe;
  generatedRecipes: Record<string, RecipeResponse>;
  setGeneratedRecipes: Dispatch<SetStateAction<Record<string, RecipeResponse>>>;
  shoppingList: ShoppingList | null;
}) {
  const [loading, setLoading] = useState(false);
  const recipeKey = selectedMealRecipe ? `${selectedMealRecipe.dayKey}:${selectedMealRecipe.mealKey}` : "";
  const meal = selectedMealRecipe ? generatedMealPlan?.[selectedMealRecipe.dayKey]?.[selectedMealRecipe.mealKey] : null;
  const recipe = recipeKey ? generatedRecipes[recipeKey] : null;

  const generate = async () => {
    if (!selectedMealRecipe || !meal) return showToast("Open a meal from the weekly plan first.");
    setLoading(true);
    try {
      const data = await generateDailyRecipes({ [selectedMealRecipe.mealKey]: meal.food });
      const nextRecipe = data[selectedMealRecipe.mealKey] ?? Object.values(data)[0];
      setGeneratedRecipes((previous) => ({ ...previous, [recipeKey]: nextRecipe }));
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Recipe generation failed.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (meal && recipeKey && !generatedRecipes[recipeKey]) void generate();
  }, [recipeKey]);

  const ingredients = recipe?.ingredients?.items ?? [];
  const steps = recipe?.instructions?.steps ?? [];

  return (
    <section className="screen-pad with-tabs">
      <ScreenHeader title="Recipe" subtitle={selectedMealRecipe ? `Day ${selectedMealRecipe.dayKey.replace("day", "")} Â· ${selectedMealRecipe.mealKey}` : undefined} onBack={() => navigate("mealWeekly")} onLogo={() => navigate("home")} />
      {!meal ? <EmptyState title="No meal selected" body="Open a meal from the meal plan first." /> : (
        <article className="recipe-card recipe-detail-card">
          <span className="category-pill">{selectedMealRecipe?.mealKey}</span>
          <h3>{recipe?.meal_name ?? meal.food}</h3>
          <small>{meal.portion} Â· {Math.round(meal.macros.energy_kcal)} cal</small>
          {loading ? <p>Generating recipe...</p> : null}
          <div><strong>Ingredients</strong>{ingredients.length ? ingredients.map((item, index) => <p key={index}>- {item}</p>) : <p>No ingredients returned yet.</p>}</div>
          <div><strong>Steps</strong>{steps.length ? steps.map((step, index) => <p key={index}>{index + 1}. {step}</p>) : <p>No steps returned yet.</p>}</div>
          <button className="secondary-button" onClick={generate} disabled={loading}>{loading ? "Generating..." : "Regenerate Recipe"}</button>
        </article>
      )}
      <PrimaryButton onClick={() => saveMealBundle({ user, plan: generatedMealPlan, meta: mealMeta, recipes: generatedRecipes, shoppingList, showToast })} disabled={!generatedMealPlan}>Save Recipe</PrimaryButton>
    </section>
  );
}

export function DailyRecipesScreen({
  user,
  navigate,
  showToast,
  generatedMealPlan,
  mealMeta,
  generatedRecipes,
  setGeneratedRecipes,
  shoppingList,
}: {
  user: User | null;
  navigate: (screen: AppScreen) => void;
  showToast: (message: string) => void;
  generatedMealPlan: WeeklyMealPlan | null;
  mealMeta: MealMeta;
  generatedRecipes: Record<string, RecipeResponse>;
  setGeneratedRecipes: Dispatch<SetStateAction<Record<string, RecipeResponse>>>;
  shoppingList: ShoppingList | null;
}) {
  const [loading, setLoading] = useState(false);
  const day = generatedMealPlan?.day1;
  const mealKeys = ["breakfast", "lunch", "dinner", "snacks"] as const;

  const generateAll = async () => {
    if (!day) return showToast("Generate a daily meal plan first.");
    setLoading(true);
    try {
      const data = await generateDailyRecipes({
        breakfast: day.breakfast.food,
        lunch: day.lunch.food,
        dinner: day.dinner.food,
        snacks: day.snacks.food,
      });
      setGeneratedRecipes((previous) => ({
        ...previous,
        ...Object.fromEntries(Object.entries(data).map(([mealKey, recipe]) => [`day1:${mealKey}`, recipe])),
      }));
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Recipe generation failed.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (day && !mealKeys.every((mealKey) => generatedRecipes[`day1:${mealKey}`])) void generateAll();
  }, [Boolean(day)]);

  return (
    <section className="screen-pad with-tabs">
      <ScreenHeader title="Daily Recipes" subtitle="Your daily meals with time-wise recipes." onBack={() => navigate("mealPlan")} onLogo={() => navigate("home")} />
      {!day ? <EmptyState title="No daily meal plan yet" body="Generate a daily meal plan first." /> : null}
      {loading ? <p className="empty-text">Generating recipes for the full day...</p> : null}
      {day && (
        <div className="recipe-stack">
          {mealKeys.map((mealKey) => {
            const meal = day[mealKey];
            const recipe = generatedRecipes[`day1:${mealKey}`];
            const ingredients = recipe?.ingredients?.items ?? [];
            const steps = recipe?.instructions?.steps ?? [];
            const time = mealKey === "breakfast" ? "07:30" : mealKey === "lunch" ? "12:30" : mealKey === "dinner" ? "19:30" : "16:00";
            return (
              <article className="recipe-card" key={mealKey}>
                <span className="category-pill">{time} Â· {mealKey}</span>
                <h3>{recipe?.meal_name ?? meal.food}</h3>
                <small>{meal.portion} Â· {Math.round(meal.macros.energy_kcal)} cal</small>
                <div><strong>Ingredients</strong>{ingredients.length ? ingredients.map((item, index) => <p key={index}>- {item}</p>) : <p>{loading ? "Asking the chef..." : "No ingredients returned yet."}</p>}</div>
                <div><strong>Steps</strong>{steps.length ? steps.map((step, index) => <p key={index}>{index + 1}. {step}</p>) : <p>{loading ? "Preparing steps..." : "No steps returned yet."}</p>}</div>
              </article>
            );
          })}
        </div>
      )}
      <PrimaryButton onClick={() => saveMealBundle({ user, plan: generatedMealPlan, meta: mealMeta, recipes: generatedRecipes, shoppingList, showToast })} disabled={!generatedMealPlan}>Save Recipes</PrimaryButton>
    </section>
  );
}

export function MealShoppingScreen({
  user,
  navigate,
  showToast,
  generatedMealPlan,
  mealMeta,
  generatedRecipes,
  shoppingList,
  setShoppingList,
}: {
  user: User | null;
  navigate: (screen: AppScreen) => void;
  showToast: (message: string) => void;
  generatedMealPlan: WeeklyMealPlan | null;
  mealMeta: MealMeta;
  generatedRecipes: Record<string, RecipeResponse>;
  shoppingList: ShoppingList | null;
  setShoppingList: (list: ShoppingList | null) => void;
}) {
  const [loading, setLoading] = useState(false);

  const generate = async () => {
    if (!generatedMealPlan) return showToast("Generate a meal plan first.");
    setLoading(true);
    try {
      const data = await generateShoppingList(generatedMealPlan);
      setShoppingList(data.data);
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Shopping list generation failed.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (generatedMealPlan && !shoppingList) void generate();
  }, []);

  const copy = async () => {
    if (!shoppingList) return;
    const text = Object.entries(shoppingList)
      .map(([category, items]) => `${category}:\n${items.map((item) => `- ${item}`).join("\n")}`)
      .join("\n\n");
    await navigator.clipboard.writeText(text);
    showToast("Shopping list copied to clipboard.");
  };

  return (
    <section className="screen-pad with-tabs">
      <ScreenHeader title="Shopping List" subtitle="Generated from your meal plan." onBack={() => navigate("mealPlan")} onLogo={() => navigate("home")} action={shoppingList ? <button className="text-link" onClick={copy}>Copy</button> : undefined} />
      {!generatedMealPlan ? <EmptyState title="No meal plan yet" body="Generate a meal plan first." /> : null}
      {loading ? <p className="empty-text">Generating your shopping list...</p> : null}
      {shoppingList && (
        <div className="shopping-card">
          {Object.entries(shoppingList).map(([category, items]) => (
            <div className="shopping-section" key={category}>
              <strong>{category}</strong>
              {items.map((item, index) => <label key={`${category}-${index}`}><input type="checkbox" /> {item}</label>)}
            </div>
          ))}
        </div>
      )}
      <button className="secondary-button" onClick={generate} disabled={!generatedMealPlan || loading}>{loading ? "Generating..." : "Regenerate Shopping List"}</button>
      <PrimaryButton onClick={() => saveMealBundle({ user, plan: generatedMealPlan, meta: mealMeta, recipes: generatedRecipes, shoppingList, showToast })} disabled={!generatedMealPlan}>Save Shopping List</PrimaryButton>
    </section>
  );
}

const muscleGroups = [
  { name: "Biceps", exercises: 4, icon: BicepsFlexed },
  { name: "Triceps", exercises: 4, icon: Dumbbell },
  { name: "Chest", exercises: 5, icon: Shirt },
  { name: "Back", exercises: 5, icon: Activity },
  { name: "Core", exercises: 1, icon: Activity },
  { name: "Shoulders", exercises: 5, icon: Dumbbell },
  { name: "Legs", exercises: 5, icon: Footprints },
];

const exercisesByGroup: Record<string, string[]> = {
  Chest: ["Bench Press", "Push-ups", "Dumbbell Flyes", "Cable Crossover", "Incline Press"],
  Back: ["Pull-ups", "Bent Over Rows", "Lat Pulldown", "Deadlift", "Cable Rows"],
  Core: ["Plank"],
  Shoulders: ["Overhead Press", "Lateral Raises", "Front Raises", "Arnold Press", "Shrugs"],
  Legs: ["Squats", "Lunges", "Leg Press", "Leg Curls", "Calf Raises"],
  Triceps: ["Tricep Dips", "Skull Crushers", "Overhead Extension", "Cable Pushdown"],
  Biceps: ["Bicep Curl", "Hammer Curl", "Preacher Curl", "Concentration Curl"],
};

type PoseLandmark = {
  name: string;
  x: number;
  y: number;
  z?: number;
  visibility?: number;
};

const bicepLandmarkNames = [
  "right_hip",
  "left_hip",
  "right_shoulder",
  "left_shoulder",
  "right_elbow",
  "left_elbow",
  "right_wrist",
  "left_wrist",
] as const;

const squatLandmarkNames = [
  "right_hip",
  "left_hip",
  "right_knee",
  "left_knee",
  "right_ankle",
  "left_ankle",
  "right_shoulder",
  "left_shoulder",
] as const;

const deadliftLandmarkNames = [
  "left_shoulder",
  "left_elbow",
  "left_wrist",
  "left_hip",
  "left_knee",
  "left_ankle",
  "left_heel",
  "left_foot",
  "right_shoulder",
  "right_elbow",
  "right_wrist",
  "right_hip",
  "right_knee",
  "right_ankle",
  "right_heel",
  "right_foot",
] as const;

const plankLandmarkNames = [
  "left_ear",
  "left_shoulder",
  "left_elbow",
  "left_wrist",
  "left_hip",
  "left_knee",
  "left_ankle",
  "right_ear",
  "right_shoulder",
  "right_elbow",
  "right_wrist",
  "right_hip",
  "right_knee",
  "right_ankle",
] as const;

const pushupLandmarkNames = [
  "nose",
  "left_shoulder",
  "right_shoulder",
  "left_elbow",
  "right_elbow",
  "left_wrist",
  "right_wrist",
  "left_hip",
  "right_hip",
  "left_knee",
  "right_knee",
  "left_ankle",
  "right_ankle",
] as const;

const dumbbellFlyLandmarkNames = [
  "right_shoulder",
  "left_shoulder",
  "right_elbow",
  "left_elbow",
  "right_wrist",
  "left_wrist",
] as const;

const skeletonConnections = [
  ["left_shoulder", "right_shoulder"],
  ["left_shoulder", "left_elbow"],
  ["left_elbow", "left_wrist"],
  ["right_shoulder", "right_elbow"],
  ["right_elbow", "right_wrist"],
  ["left_shoulder", "left_hip"],
  ["right_shoulder", "right_hip"],
  ["left_hip", "right_hip"],
  ["left_hip", "left_knee"],
  ["left_knee", "left_ankle"],
  ["right_hip", "right_knee"],
  ["right_knee", "right_ankle"],
  ["left_ankle", "left_heel"],
  ["left_heel", "left_foot"],
  ["right_ankle", "right_heel"],
  ["right_heel", "right_foot"],
] as const;

const minSkeletonVisibility = 0.05;
const sessionHistoryLimit = 80;

const sessionHistoryKey = (userId?: string | null) => `zentra:form-session-history:${userId ?? "guest"}`;

function readSessionHistory(userId?: string | null): FormSessionSummary[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(sessionHistoryKey(userId));
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeSessionHistory(userId: string | null | undefined, rows: FormSessionSummary[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(sessionHistoryKey(userId), JSON.stringify(rows.slice(0, sessionHistoryLimit)));
}

function mapFormSessionRow(row: any): FormSessionSummary {
  return {
    id: String(row.id),
    user_id: row.user_id,
    group: row.group_name ?? row.group,
    exercise: row.exercise_name ?? row.exercise,
    started_at: row.started_at,
    ended_at: row.ended_at,
    duration_seconds: Number(row.duration_seconds ?? 0),
    total_reps: Number(row.total_reps ?? 0),
    correct_reps: Number(row.correct_reps ?? 0),
    incorrect_reps: Number(row.incorrect_reps ?? 0),
    feedback: row.feedback ?? undefined,
  };
}

async function saveSessionSummary(summary: FormSessionSummary) {
  const rows = readSessionHistory(summary.user_id);
  writeSessionHistory(summary.user_id, [summary, ...rows]);

  if (!summary.user_id || !hasSupabaseConfig) return;
  await supabase.from("user_form_sessions").insert({
    user_id: summary.user_id,
    group_name: summary.group,
    exercise_name: summary.exercise,
    started_at: summary.started_at,
    ended_at: summary.ended_at,
    duration_seconds: summary.duration_seconds,
    total_reps: summary.total_reps,
    correct_reps: summary.correct_reps,
    incorrect_reps: summary.incorrect_reps,
    feedback: summary.feedback,
  });
}

type LiveExerciseSlug = "bicep-curl" | "squats" | "deadlifts" | "planks" | "pushups" | "dumbbell-fly";

const normalizePoseLandmarks = (rawLandmarks: unknown, exerciseSlug: LiveExerciseSlug): PoseLandmark[] => {
  if (!Array.isArray(rawLandmarks)) return [];
  const fallbackNames =
    exerciseSlug === "squats"
      ? squatLandmarkNames
      : exerciseSlug === "deadlifts"
        ? deadliftLandmarkNames
        : exerciseSlug === "planks"
          ? plankLandmarkNames
          : exerciseSlug === "pushups"
            ? pushupLandmarkNames
            : exerciseSlug === "dumbbell-fly"
              ? dumbbellFlyLandmarkNames
        : bicepLandmarkNames;

  return rawLandmarks
    .map((landmark, index): PoseLandmark | null => {
      if (Array.isArray(landmark)) {
        const [x, y, z, visibility] = landmark;
        return {
          name: fallbackNames[index] ?? `point_${index}`,
          x: Number(x),
          y: Number(y),
          z: Number(z),
          visibility: visibility == null ? 1 : Number(visibility),
        };
      }

      if (landmark && typeof landmark === "object") {
        const point = landmark as Partial<PoseLandmark>;
        return {
          name: String(point.name ?? fallbackNames[index] ?? `point_${index}`),
          x: Number(point.x),
          y: Number(point.y),
          z: point.z == null ? undefined : Number(point.z),
          visibility: point.visibility == null ? 1 : Number(point.visibility),
        };
      }

      return null;
    })
    .filter((landmark): landmark is PoseLandmark => {
      if (!landmark) return false;
      return Number.isFinite(landmark.x) && Number.isFinite(landmark.y);
    });
};

export function FormCorrectionScreen({
  profile,
  navigate,
  selectGroup,
}: {
  profile: Profile | null;
  navigate: (screen: AppScreen) => void;
  selectGroup: (group: string) => void;
}) {
  return (
    <section className="screen-pad with-tabs">
      <ScreenHeader title="Form Correction" subtitle="What are you training today?" onBack={() => navigate("home")} onLogo={() => navigate("home")} />
      <div className="dashboard-header compact-header">
        <div>
          <h1>Welcome Back!</h1>
          {profile?.first_name && <h2>{profile.first_name}</h2>}
        </div>
        <span className="form-badge"><CheckCircle size={18} /> AI</span>
      </div>
      <div className="muscle-grid">
        {muscleGroups.map((group) => {
          const Icon = group.icon;
          return (
            <button className="muscle-card" key={group.name} onClick={() => selectGroup(group.name)}>
              <span><Icon size={34} /></span>
              <strong>{group.name}</strong>
              <small>{group.exercises} exercises</small>
            </button>
          );
        })}
      </div>
    </section>
  );
}

export function FormExercisesScreen({
  group,
  navigate,
  selectExercise,
}: {
  group: string;
  navigate: (screen: AppScreen) => void;
  selectExercise: (exercise: string) => void;
}) {
  const exercises = exercisesByGroup[group] ?? [];
  return (
    <section className="screen-pad with-tabs">
      <ScreenHeader title={group} subtitle="Choose an exercise to open live correction" onBack={() => navigate("formCorrection")} onLogo={() => navigate("home")} />
      <div className="exercise-pick-list">
        {exercises.map((exercise, index) => (
          <button className="exercise-pick-card" key={exercise} onClick={() => selectExercise(exercise)}>
            <span>{String(index + 1).padStart(2, "0")}</span>
            <strong>{exercise}</strong>
            <ChevronRight size={20} />
          </button>
        ))}
      </div>
    </section>
  );
}

export function FormLiveScreen({
  group,
  exercise,
  user,
  navigate,
  showToast,
}: {
  group: string;
  exercise: string;
  user: User | null;
  navigate: (screen: AppScreen) => void;
  showToast: (message: string) => void;
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const socketRef = useRef<WebSocket | null>(null);
  const frameTimerRef = useRef<number | null>(null);
  const recordingTimerRef = useRef<number | null>(null);
  const liveRunRef = useRef(0);
  const sessionStartedAtRef = useRef<number | null>(null);
  const sessionSavedRef = useRef(true);
  const sessionMetaRef = useRef<{ group: string; exercise: string; userId?: string }>({ group, exercise, userId: user?.id });
  const statsRef = useRef({
    correct: 0,
    incorrect: 0,
    angle: 0,
    feedback: "Stand fully visible in the webcam frame.",
  });
  const [cameraActive, setCameraActive] = useState(false);
  const [streaming, setStreaming] = useState(false);
  const [status, setStatus] = useState("Webcam idle");
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [stats, setStats] = useState({
    correct: 0,
    incorrect: 0,
    angle: 0,
    feedback: "Stand fully visible in the webcam frame.",
  });
  const [poseLandmarks, setPoseLandmarks] = useState<PoseLandmark[]>([]);
  const modelConfig: { slug: LiveExerciseSlug; label: string; load: () => Promise<unknown> } | null =
    group === "Biceps" && exercise === "Bicep Curl"
      ? { slug: "bicep-curl", label: "bicep curl", load: loadBicepCurlModel }
      : group === "Chest" && exercise === "Push-ups"
        ? { slug: "pushups", label: "push-up", load: loadPushupModel }
      : group === "Chest" && exercise === "Dumbbell Flyes"
        ? { slug: "dumbbell-fly", label: "dumbbell fly", load: loadDumbbellFlyModel }
      : group === "Back" && exercise === "Deadlift"
        ? { slug: "deadlifts", label: "deadlift", load: loadDeadliftModel }
      : group === "Core" && exercise === "Plank"
        ? { slug: "planks", label: "plank", load: loadPlankModel }
      : group === "Legs" && exercise === "Squats"
        ? { slug: "squats", label: "squat", load: loadSquatModel }
        : null;
  const supportsInference = Boolean(modelConfig);

  const updateStats = (nextStats: typeof stats) => {
    statsRef.current = nextStats;
    setStats(nextStats);
  };

  const saveCurrentSession = () => {
    const startedAt = sessionStartedAtRef.current;
    if (!startedAt || sessionSavedRef.current) return;

    const endedAt = Date.now();
    const durationSeconds = Math.max(1, Math.round((endedAt - startedAt) / 1000));
    const currentStats = statsRef.current;
    const sessionMeta = sessionMetaRef.current;
    const totalReps = currentStats.correct + currentStats.incorrect;
    if (durationSeconds < 3 && totalReps === 0) {
      sessionSavedRef.current = true;
      return;
    }

    void saveSessionSummary({
      id: `${startedAt}-${sessionMeta.exercise.replace(/\s+/g, "-").toLowerCase()}`,
      user_id: sessionMeta.userId,
      group: sessionMeta.group,
      exercise: sessionMeta.exercise,
      started_at: new Date(startedAt).toISOString(),
      ended_at: new Date(endedAt).toISOString(),
      duration_seconds: durationSeconds,
      total_reps: totalReps,
      correct_reps: currentStats.correct,
      incorrect_reps: currentStats.incorrect,
      feedback: currentStats.feedback,
    });
    sessionSavedRef.current = true;
  };

  const stopLive = () => {
    saveCurrentSession();
    liveRunRef.current += 1;
    if (frameTimerRef.current) window.clearInterval(frameTimerRef.current);
    if (recordingTimerRef.current) window.clearInterval(recordingTimerRef.current);
    const socket = socketRef.current;
    if (socket) {
      socket.onopen = null;
      socket.onmessage = null;
      socket.onerror = null;
      socket.onclose = null;
      if (socket.readyState === WebSocket.CONNECTING || socket.readyState === WebSocket.OPEN) {
        socket.close(1000, "Exercise changed");
      }
    }
    streamRef.current?.getTracks().forEach((track) => track.stop());
    frameTimerRef.current = null;
    recordingTimerRef.current = null;
    socketRef.current = null;
    streamRef.current = null;
    setStreaming(false);
    setCameraActive(false);
    setPoseLandmarks([]);
    setStatus("Webcam stopped");
    sessionStartedAtRef.current = null;
  };

  useEffect(() => stopLive, []);

  useEffect(() => {
    stopLive();
    setElapsedSeconds(0);
    updateStats({ correct: 0, incorrect: 0, angle: 0, feedback: "Stand fully visible in the webcam frame." });
    setPoseLandmarks([]);
    setStatus("Webcam idle");
  }, [group, exercise]);

  const leaveLiveScreen = (next: AppScreen) => {
    stopLive();
    navigate(next);
  };

  const startCamera = async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      showToast("Webcam access needs localhost, HTTPS, or a browser that supports media devices.");
      return false;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: { ideal: 720 }, height: { ideal: 960 } },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.muted = true;
        videoRef.current.playsInline = true;
        await videoRef.current.play().catch(() => undefined);
      }
      setCameraActive(true);
      setStatus(supportsInference ? "Webcam ready. Start recording when ready." : "Webcam ready. AI model is not wired for this exercise yet.");
      return true;
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Webcam permission failed.");
      return false;
    }
  };

  const captureFrame = () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    const socket = socketRef.current;
    if (!video || !canvas || socket?.readyState !== WebSocket.OPEN || video.readyState < 2) return;
    const width = video.videoWidth || 480;
    const height = video.videoHeight || 640;
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");
    if (!context) return;
    context.drawImage(video, 0, 0, width, height);
    const image_base64 = canvas.toDataURL("image/jpeg", 0.38);
    socket.send(JSON.stringify({ type: "image_frame", image_base64, timestamp_ms: Date.now() }));
  };

  const startInference = async () => {
    if (!supportsInference || !modelConfig) {
      showToast("Live AI correction is currently wired for Bicep Curl, Deadlift, Dumbbell Flyes, Plank, Push-ups, and Squats. This exercise opens webcam preview only.");
      return;
    }

    const runId = liveRunRef.current + 1;
    liveRunRef.current = runId;

    if (!cameraActive) {
      const started = await startCamera();
      if (!started) return;
      if (liveRunRef.current !== runId) return;
    }

    try {
      setElapsedSeconds(0);
      updateStats({ correct: 0, incorrect: 0, angle: 0, feedback: "Stand fully visible in the webcam frame." });
      setPoseLandmarks([]);
      setStatus(`Loading ${modelConfig.label} model...`);
      await modelConfig.load();
      if (liveRunRef.current !== runId) return;
      sessionStartedAtRef.current = Date.now();
      sessionSavedRef.current = false;
      sessionMetaRef.current = { group, exercise, userId: user?.id };
      const url = `${MODEL_GATEWAY_API_BASE_URL.replace(/^http/, "ws")}/api/v1/${modelConfig.slug}/ws`;
      const socket = new WebSocket(url);
      socketRef.current = socket;
      socket.onopen = () => {
        if (liveRunRef.current !== runId || socketRef.current !== socket) return;
        setStreaming(true);
        setStatus("AI correction streaming");
        if (recordingTimerRef.current) window.clearInterval(recordingTimerRef.current);
        recordingTimerRef.current = window.setInterval(() => setElapsedSeconds((current) => current + 1), 1000);
        frameTimerRef.current = window.setInterval(captureFrame, 220);
      };
      socket.onmessage = (event) => {
        if (liveRunRef.current !== runId || socketRef.current !== socket) return;
        const payload = JSON.parse(event.data);
        if (payload.type === "session_started") {
          setStatus(`${modelConfig.label} session ready`);
          return;
        }
        if (payload.type === "error") {
          setStatus("AI correction paused");
          setPoseLandmarks([]);
          updateStats({ ...statsRef.current, feedback: String(payload.message ?? "Inference error") });
          return;
        }
        if (payload.type === "frame_result") {
          setPoseLandmarks(normalizePoseLandmarks(payload.landmarks, modelConfig.slug));
          updateStats({
            correct: Number(payload.correct_reps ?? payload.correct ?? 0),
            incorrect: Number(payload.incorrect_reps ?? payload.incorrect ?? 0),
            angle: Math.round(Number(payload.angle ?? 0)),
            feedback: String(payload.feedback ?? payload.prediction?.reason ?? payload.prediction?.label ?? payload.status ?? "Keep moving."),
          });
        }
      };
      socket.onerror = () => {
        if (liveRunRef.current !== runId || socketRef.current !== socket) return;
        showToast(`Model gateway WebSocket is offline: ${url}`);
        setStatus("AI correction offline");
      };
      socket.onclose = () => {
        if (liveRunRef.current !== runId || socketRef.current !== socket) return;
        if (frameTimerRef.current) window.clearInterval(frameTimerRef.current);
        if (recordingTimerRef.current) window.clearInterval(recordingTimerRef.current);
        frameTimerRef.current = null;
        recordingTimerRef.current = null;
        socketRef.current = null;
        setStreaming(false);
      };
    } catch (error) {
      if (liveRunRef.current !== runId) return;
      showToast(error instanceof Error ? error.message : "Unable to start live correction.");
      setStatus("AI correction offline");
    }
  };

  const visibleLandmarks = poseLandmarks.filter(
    (landmark) =>
      Number.isFinite(landmark.x) &&
      Number.isFinite(landmark.y) &&
      (landmark.visibility ?? 1) >= minSkeletonVisibility,
  );
  const landmarkByName = new Map(visibleLandmarks.map((landmark) => [landmark.name, landmark]));
  const hasSkeleton = visibleLandmarks.length >= 2;
  const isPlank = modelConfig?.slug === "planks";
  const plankFormStatus = stats.correct > 0 && stats.correct >= stats.incorrect ? "Correct" : stats.incorrect > 0 ? "Needs Fix" : "Waiting";
  const plankFormTone = plankFormStatus === "Correct" ? "Good" : plankFormStatus === "Needs Fix" ? "Adjust" : "Ready";

  const feedbackItems = supportsInference
    ? [
        stats.feedback,
        stats.angle ? `Current angle: ${stats.angle} degrees` : "Keep your full body visible in frame.",
        exercise === "Squats"
          ? "Drive from the bottom back to a full standing position."
          : exercise === "Deadlift"
            ? "Use a side view and hinge at the hips."
            : exercise === "Plank"
              ? "Hold a straight side-view body line."
              : exercise === "Push-ups"
                ? "Use a side view and complete the full push-up range."
                : exercise === "Dumbbell Flyes"
                  ? "Open wide, close under control, then return to open."
            : "Control tempo through the full curl.",
      ]
    : ["This exercise opens webcam preview only."];

  return (
    <section className="screen-pad with-tabs live-screen">
      <ScreenHeader title={exercise} subtitle={`${group} form correction`} onBack={() => leaveLiveScreen("formExercises")} onLogo={() => leaveLiveScreen("home")} />
      <div className="live-camera">
        <div className="rec-row">
          <span>{streaming ? "REC" : "READY"}</span>
          <small>{formatDuration(elapsedSeconds)}</small>
          <b>{isPlank ? plankFormTone : `REPS ${stats.correct + stats.incorrect}`}</b>
        </div>
        <video ref={videoRef} autoPlay muted playsInline />
        {hasSkeleton && (
          <svg className="pose-skeleton" viewBox="0 0 1 1" preserveAspectRatio="none" aria-hidden="true">
            {skeletonConnections.map(([fromName, toName]) => {
              const from = landmarkByName.get(fromName);
              const to = landmarkByName.get(toName);
              if (!from || !to) return null;
              return (
                <line
                  key={`${fromName}-${toName}`}
                  x1={1 - from.x}
                  y1={from.y}
                  x2={1 - to.x}
                  y2={to.y}
                />
              );
            })}
            {visibleLandmarks.map((landmark) => (
              <circle key={landmark.name} cx={1 - landmark.x} cy={landmark.y} r="0.017" />
            ))}
          </svg>
        )}
        {streaming && (
          <div className={hasSkeleton ? "tracking-badge tracking-on" : "tracking-badge"}>
            {hasSkeleton ? "Skeleton tracking" : "Searching for pose"}
          </div>
        )}
        {!cameraActive && <div className="camera-placeholder"><Camera size={52} /><span>Webcam preview</span><small>{exercise} - Live correction</small></div>}
        <canvas ref={canvasRef} hidden />
      </div>
      <div className="live-stats">
        {isPlank ? (
          <>
            <Stat icon={CheckSquare} value={plankFormStatus} label="Form" />
            <Stat icon={Activity} value={stats.angle ? `${stats.angle}deg` : "--"} label="Body Angle" />
          </>
        ) : (
          <>
            <Stat icon={CheckSquare} value={stats.correct} label="Correct" />
            <Stat icon={Trash2} value={stats.incorrect} label="Incorrect" />
          </>
        )}
        <Stat icon={Activity} value={streaming ? "Live" : "Idle"} label="Status" />
      </div>
      <div className="feedback-card">
        <strong>Live feedback</strong>
        {feedbackItems.map((item, index) => (
          <p className={index === 0 ? "good-feedback" : "warn-feedback"} key={`${item}-${index}`}>{index === 0 ? "OK" : "!"} {item}</p>
        ))}
        <small>{status}</small>
      </div>
      <div className="live-actions">
        <button className="secondary-button" onClick={cameraActive ? stopLive : startCamera}>
          {cameraActive ? <Square size={18} /> : <Camera size={18} />}
          {cameraActive ? "Stop Webcam" : "Open Webcam"}
        </button>
        <PrimaryButton onClick={streaming ? stopLive : startInference}>
          {streaming ? <Pause size={18} /> : <Play size={18} />}
          {streaming ? "Pause Recording" : "Start Recording"}
        </PrimaryButton>
        <button className="secondary-button span-all" onClick={() => leaveLiveScreen("formExercises")}>Switch Exercise</button>
      </div>
    </section>
  );
}

export function LogsHistoryScreen({ user, navigate, showToast, backTo }: { user: User | null; navigate: (screen: AppScreen) => void; showToast: (message: string) => void; backTo: AppScreen }) {
  const [rows, setRows] = useState<any[]>([]);
  const [tab, setTab] = useState<"summary" | "byExercise" | "calendar">("summary");
  const [selectedExercise, setSelectedExercise] = useState("");
  const [selectedDate, setSelectedDate] = useState(todayKey());

  useEffect(() => {
    if (!user) return;
    supabase.from("user_logs_history").select("*").eq("user_id", user.id).eq("month", monthKey()).then(({ data, error }) => {
      if (error) showToast(error.message);
      setRows(data ?? []);
    });
  }, [user?.id]);

  const loggedSets = rows.flatMap((row) =>
    (Array.isArray(row.sets) ? row.sets : [])
      .filter((set: WorkoutSet) => set.logged)
      .map((set: WorkoutSet) => ({
        ...set,
        exerciseName: row.exercise_name,
        muscleGroup: row.muscle_group,
        dateKey: set.date ?? set.timestamp?.slice(0, 10) ?? todayKey(),
      })),
  );
  const totalVolume = loggedSets.reduce((sum, set) => sum + Number(set.weight ?? 0) * Number(set.reps ?? 0), 0);
  const maxWeight = loggedSets.reduce((max, set) => Math.max(max, Number(set.weight ?? 0)), 0);
  const exerciseNames = Array.from(new Set(loggedSets.map((set) => set.exerciseName)));
  const activeExercise = selectedExercise || exerciseNames[0] || "";
  const exerciseRows = loggedSets.filter((set) => set.exerciseName === activeExercise);
  const chartDays = Array.from({ length: 7 }, (_, index) => {
    const date = new Date();
    date.setDate(date.getDate() - (6 - index));
    const key = date.toISOString().split("T")[0];
    const volume = loggedSets
      .filter((set) => set.dateKey === key)
      .reduce((sum, set) => sum + Number(set.weight ?? 0) * Number(set.reps ?? 0), 0);
    return { key, label: date.toLocaleDateString("en-US", { weekday: "short" }), volume };
  });
  const maxChartVolume = Math.max(1, ...chartDays.map((day) => day.volume));
  const monthStart = new Date(`${monthKey()}-01T00:00:00`);
  const monthDays = new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 0).getDate();
  const calendarDays = Array.from({ length: monthDays }, (_, index) => {
    const date = new Date(monthStart);
    date.setDate(index + 1);
    const key = date.toISOString().split("T")[0];
    const count = loggedSets.filter((set) => set.dateKey === key).length;
    return { key, day: index + 1, count };
  });
  const selectedLogs = loggedSets.filter((set) => set.dateKey === selectedDate);

  return (
    <section className="screen-pad with-tabs">
      <ScreenHeader title="Logs History" subtitle="Track your strength progress" onBack={() => navigate(backTo)} onLogo={() => navigate("home")} />
      <div className="history-tabs">
        {(["summary", "byExercise", "calendar"] as const).map((item) => (
          <button className={tab === item ? "active" : ""} key={item} onClick={() => setTab(item)}>
            {item === "byExercise" ? "By Exercise" : item[0].toUpperCase() + item.slice(1)}
          </button>
        ))}
      </div>
      {loggedSets.length === 0 ? <EmptyState title="No workout logs yet" body="Logged sets will appear here with summaries and calendar intensity." /> : null}
      {tab === "summary" && loggedSets.length > 0 && (
        <>
          <div className="history-metrics">
            <Stat icon={TrendingUp} value={totalVolume.toLocaleString()} label="Volume kg" />
            <Stat icon={Award} value={maxWeight} label="Max kg" />
            <Stat icon={CheckSquare} value={loggedSets.length} label="Sets" />
          </div>
          <div className="volume-chart">
            {chartDays.map((day) => (
              <div className="bar-wrap" key={day.key}>
                <div className="bar" style={{ height: `${Math.max(8, (day.volume / maxChartVolume) * 110)}px` }} />
                <small>{day.label}</small>
              </div>
            ))}
          </div>
        </>
      )}
      {tab === "byExercise" && loggedSets.length > 0 && (
        <>
          <select className="history-select" value={activeExercise} onChange={(event) => setSelectedExercise(event.target.value)}>
            {exerciseNames.map((name) => <option key={name}>{name}</option>)}
          </select>
          <div className="history-table">
            <b>Date</b><b>Weight</b><b>Reps</b>
            {exerciseRows.map((set) => (
              <div className="history-table-row" key={set.id}>
                <span>{set.dateKey}</span>
                <span>{set.weight} kg</span>
                <span>{set.reps}</span>
              </div>
            ))}
          </div>
        </>
      )}
      {tab === "calendar" && loggedSets.length > 0 && (
        <>
          <div className="calendar-grid">
            {calendarDays.map((day) => (
              <button
                className={`calendar-day intensity-${Math.min(3, day.count)} ${selectedDate === day.key ? "selected" : ""}`}
                key={day.key}
                onClick={() => setSelectedDate(day.key)}
              >
                {day.day}
              </button>
            ))}
          </div>
          <div className="list-stack compact-list">
            {selectedLogs.length === 0 ? <EmptyState title="No sets logged on this day" /> : selectedLogs.map((set) => (
              <article className="list-card" key={set.id}>
                <strong>{set.exerciseName}</strong>
                <small>{set.muscleGroup}</small>
                <p>{set.weight} kg x {set.reps} reps</p>
              </article>
            ))}
          </div>
        </>
      )}
    </section>
  );
}

export function MealHistoryScreen({ user, navigate, showToast, backTo = "history" }: { user: User | null; navigate: (screen: AppScreen) => void; showToast: (message: string) => void; backTo?: AppScreen }) {
  const [rows, setRows] = useState<any[]>([]);
  const loadRows = () => {
    if (!user) return;
    supabase.from("user_meal_history").select("*").eq("user_id", user.id).order("week_start_date", { ascending: false }).then(({ data, error }) => {
      if (error) showToast(error.message);
      setRows(data ?? []);
    });
  };

  useEffect(() => {
    loadRows();
  }, [user?.id]);

  const deleteRow = async (row: any) => {
    if (!user) return;
    const query = supabase.from("user_meal_history").delete();
    const { error } = row.id
      ? await query.eq("id", row.id)
      : await query.eq("user_id", user.id).eq("week_start_date", row.week_start_date);
    if (error) showToast(error.message);
    else {
      setRows((current) => current.filter((item) => (row.id ? item.id !== row.id : item.week_start_date !== row.week_start_date)));
      showToast("Saved meal plan deleted.");
    }
  };

  return (
    <HistoryList title="Meal History" navigate={navigate} empty="No saved meal plans yet" backTo={backTo}>
      {rows.map((row) => {
        const data = row.meal_plan_data ?? {};
        const plan = data.plan as WeeklyMealPlan | undefined;
        const recipes = (data.recipes ?? {}) as Record<string, RecipeResponse>;
        const shopping = data.shopping_list as ShoppingList | null | undefined;
        const days = sortedMealDays(plan ?? null);
        return (
          <article className="meal-history-card" key={row.id ?? row.week_start_date}>
            <div className="meal-history-head">
              <div>
                <strong>{data.plan_type === "daily" ? "Saved Daily Plan" : `Week of ${row.week_start_date}`}</strong>
                <small>{data.culinary_preference ?? "Any"} Â· {data.dietary_preference ?? "None"}</small>
                {data.goal ? <p>{data.goal}</p> : null}
              </div>
              <button className="icon-button danger-icon" onClick={() => deleteRow(row)} aria-label="Delete saved meal plan"><Trash2 size={18} /></button>
            </div>
            {days.length ? (
              <div className="saved-days">
                {days.map((dayKey) => {
                  const day = plan?.[dayKey];
                  if (!day) return null;
                  return (
                    <div className="saved-day" key={dayKey}>
                      <strong>Day {dayKey.replace("day", "")}</strong>
                      {(["breakfast", "lunch", "dinner", "snacks"] as const).map((mealKey) => (
                        <small key={mealKey}>{mealKey}: {day[mealKey].food}</small>
                      ))}
                    </div>
                  );
                })}
              </div>
            ) : <p>No meal details saved in this record.</p>}
            {Object.keys(recipes).length ? (
              <details className="saved-detail">
                <summary>Saved Recipes ({Object.keys(recipes).length})</summary>
                {Object.entries(recipes).map(([key, recipe]) => (
                  <div className="saved-recipe" key={key}>
                    <strong>{recipe.meal_name ?? key}</strong>
                    {(recipe.ingredients?.items ?? []).slice(0, 4).map((item, index) => <small key={index}>- {item}</small>)}
                  </div>
                ))}
              </details>
            ) : null}
            {shopping && Object.keys(shopping).length ? (
              <details className="saved-detail">
                <summary>Saved Shopping List</summary>
                {Object.entries(shopping).map(([category, items]) => (
                  <div className="saved-recipe" key={category}>
                    <strong>{category}</strong>
                    {items.slice(0, 6).map((item, index) => <small key={index}>- {item}</small>)}
                  </div>
                ))}
              </details>
            ) : null}
          </article>
        );
      })}
    </HistoryList>
  );
}

export function StepsHistoryScreen({ user, navigate, showToast, backTo }: { user: User | null; navigate: (screen: AppScreen) => void; showToast: (message: string) => void; backTo: AppScreen }) {
  const [rows, setRows] = useState<any[]>([]);
  useEffect(() => {
    if (!user) return;
    supabase.from("step_tracking").select("*").eq("user_id", user.id).gte("date", `${monthKey()}-01`).order("date").then(({ data, error }) => {
      if (error) showToast(error.message);
      setRows(data ?? []);
    });
  }, [user?.id]);
  const totals = rows.reduce((sum, row) => ({ steps: sum.steps + Number(row.steps ?? 0), km: sum.km + Number(row.distance_km ?? 0), kcal: sum.kcal + Number(row.kcal ?? 0) }), { steps: 0, km: 0, kcal: 0 });
  return <HistoryList title="Steps History" navigate={navigate} empty="No step history yet" backTo={backTo}><div className="summary-card"><Stat icon={Footprints} value={totals.steps.toLocaleString()} label="Total Steps" /><Stat icon={Activity} value={totals.km.toFixed(1)} label="Kilometers" /><Stat icon={Flame} value={Math.round(totals.kcal)} label="Calories" /></div>{rows.map((row) => <article className="list-card" key={row.id}><strong>{row.date}</strong><p>{Number(row.steps).toLocaleString()} / {Number(row.goal).toLocaleString()} steps</p></article>)}</HistoryList>;
}

export function SessionHistoryScreen({ user, navigate, showToast, backTo = "history" }: { user: User | null; navigate: (screen: AppScreen) => void; showToast: (message: string) => void; backTo?: AppScreen }) {
  const [rows, setRows] = useState<FormSessionSummary[]>([]);

  const loadRows = async () => {
    const localRows = readSessionHistory(user?.id);
    if (!user || !hasSupabaseConfig) {
      setRows(localRows);
      return;
    }

    const { data, error } = await supabase
      .from("user_form_sessions")
      .select("*")
      .eq("user_id", user.id)
      .order("started_at", { ascending: false });

    if (error) {
      setRows(localRows);
      showToast(error.message);
      return;
    }

    const remoteRows = (data ?? []).map(mapFormSessionRow);
    setRows(remoteRows.length ? remoteRows : localRows);
  };

  useEffect(() => {
    void loadRows();
  }, [user?.id]);

  const clearHistory = async () => {
    if (user && hasSupabaseConfig) {
      const { error } = await supabase.from("user_form_sessions").delete().eq("user_id", user.id);
      if (error) {
        showToast(error.message);
        return;
      }
    }
    writeSessionHistory(user?.id, []);
    setRows([]);
  };

  const totals = rows.reduce(
    (sum, row) => ({
      sessions: sum.sessions + 1,
      reps: sum.reps + row.total_reps,
      correct: sum.correct + row.correct_reps,
      incorrect: sum.incorrect + row.incorrect_reps,
      seconds: sum.seconds + row.duration_seconds,
    }),
    { sessions: 0, reps: 0, correct: 0, incorrect: 0, seconds: 0 },
  );
  const accuracy = totals.reps ? Math.round((totals.correct / totals.reps) * 100) : 0;

  return (
    <section className="screen-pad with-tabs">
      <ScreenHeader
        title="Session History"
        subtitle="Live correction summaries"
        onBack={() => navigate(backTo)}
        onLogo={() => navigate("home")}
        action={rows.length ? <button className="text-link" onClick={clearHistory}>Clear</button> : undefined}
      />
      {rows.length === 0 ? (
        <EmptyState title="No live sessions yet" body="Start a form correction recording and stop it to save a summary here." />
      ) : (
        <div className="list-stack">
          <div className="summary-card session-summary-strip">
            <Stat icon={HistoryIcon} value={totals.sessions} label="Sessions" />
            <Stat icon={CheckSquare} value={totals.reps} label="Total Reps" />
            <Stat icon={Award} value={`${accuracy}%`} label="Accuracy" />
          </div>
          {rows.map((row) => {
            const started = new Date(row.started_at);
            const isRepSession = row.total_reps > 0 || row.exercise !== "Plank";
            return (
              <article className="session-history-card" key={row.id}>
                <div className="session-history-head">
                  <div>
                    <strong>{row.exercise}</strong>
                    <small>{row.group} - {started.toLocaleString()}</small>
                  </div>
                  <span>{formatDuration(row.duration_seconds)}</span>
                </div>
                <div className="session-history-metrics">
                  <Stat icon={Dumbbell} value={isRepSession ? row.total_reps : "--"} label={isRepSession ? "Reps" : "Reps"} />
                  <Stat icon={CheckSquare} value={row.correct_reps} label="Correct" />
                  <Stat icon={Trash2} value={row.incorrect_reps} label="Incorrect" />
                </div>
                {row.feedback ? <p>{row.feedback}</p> : null}
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}

function HistoryList({ title, navigate, empty, children, backTo = "history" }: { title: string; navigate: (screen: AppScreen) => void; empty: string; children: React.ReactNode; backTo?: AppScreen }) {
  const hasItems = Array.isArray(children) ? children.length > 0 : Boolean(children);
  return <section className="screen-pad with-tabs"><ScreenHeader title={title} onBack={() => navigate(backTo)} onLogo={() => navigate("home")} />{hasItems ? <div className="list-stack">{children}</div> : <EmptyState title={empty} />}</section>;
}

function stripBlogHtml(value = "") {
  const parser = new DOMParser();
  const document = parser.parseFromString(value, "text/html");
  return document.body.textContent?.replace(/\s+/g, " ").trim() ?? "";
}

export function BlogsScreen({ navigate, showToast, selectBlog }: { navigate: (screen: AppScreen) => void; showToast: (message: string) => void; selectBlog: (blog: BlogPost) => void }) {
  const [blogs, setBlogs] = useState<BlogPost[]>([]);
  const [loading, setLoading] = useState(true);

  const loadBlogs = async () => {
    setLoading(true);
    try {
      const response = await fetch("https://www.nerdfitness.com/wp-json/wp/v2/posts?per_page=12&_embed=1");
      if (!response.ok) throw new Error(`Blog API failed with ${response.status}`);
      const data = await response.json();
      setBlogs(
        data.map((post: any) => ({
          id: String(post.id),
          title: stripBlogHtml(post.title?.rendered) || "Untitled",
          snippet: stripBlogHtml(post.excerpt?.rendered),
          content: stripBlogHtml(post.content?.rendered),
          category: "Fitness",
          read_time_min: Math.max(3, Math.round((post.content?.rendered?.length ?? 2500) / 1200)),
          published_at: post.date,
          thumbnail_url: post._embedded?.["wp:featuredmedia"]?.[0]?.source_url ?? null,
        })),
      );
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Could not load blogs.");
      setBlogs([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadBlogs();
  }, []);

  const formatDate = (value: string) =>
    new Date(value).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

  return (
    <section className="screen-pad with-tabs">
      <ScreenHeader
        title="Blogs"
        subtitle="Fitness, nutrition, and recovery articles curated for you."
        onBack={() => navigate("home")}
        onLogo={() => navigate("home")}
        action={<button className="icon-button" onClick={loadBlogs} aria-label="Refresh blogs"><RefreshCw size={18} /></button>}
      />
      {loading ? <p className="empty-text">Loading latest fitness articles...</p> : null}
      {!loading && blogs.length === 0 ? <EmptyState title="No blog posts found" body="The blog API did not return articles right now." /> : null}
      <div className="blog-grid">
        {blogs.map((post) => {
          const image = post.thumbnail_url ?? post.image_url;
          return (
            <button className="blog-card blog-card-button" key={post.id} onClick={() => selectBlog(post)}>
              {image ? <img src={image} alt="" /> : <div className="blog-image-fallback"><Newspaper size={34} /></div>}
              <div>
                <span className="category-pill">{post.category}</span>
                <h3>{post.title}</h3>
                <p>{post.snippet}</p>
                <small>{post.read_time_min} min read Â· {formatDate(post.published_at)}</small>
              </div>
            </button>
          );
        })}
      </div>
    </section>
  );
}

export function BlogDetailScreen({ blog, navigate }: { blog: BlogPost | null; navigate: (screen: AppScreen) => void }) {
  if (!blog) {
    return (
      <section className="screen-pad with-tabs">
        <ScreenHeader title="Blog" onBack={() => navigate("blogs")} onLogo={() => navigate("home")} />
        <EmptyState title="No blog selected" body="Go back to Blogs and open an article." />
      </section>
    );
  }

  const image = blog.thumbnail_url ?? blog.image_url;
  const published = new Date(blog.published_at).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
  const paragraphs = (blog.content || blog.snippet)
    .split(/(?<=[.!?])\s+/)
    .filter(Boolean);

  return (
    <section className="screen-pad with-tabs">
      <ScreenHeader title="Blog Detail" onBack={() => navigate("blogs")} onLogo={() => navigate("home")} />
      <article className="blog-detail">
        {image ? <img src={image} alt="" /> : <div className="blog-detail-fallback"><Newspaper size={44} /></div>}
        <div className="blog-detail-body">
          <span className="category-pill">{blog.category}</span>
          <h1>{blog.title}</h1>
          <small>{blog.read_time_min} min read Ã‚Â· {published}</small>
          <p className="blog-lead">{blog.snippet}</p>
          <div className="blog-content">
            {paragraphs.map((paragraph, index) => <p key={index}>{paragraph}</p>)}
          </div>
        </div>
      </article>
    </section>
  );
}





