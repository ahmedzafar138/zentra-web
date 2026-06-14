import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode, type Dispatch, type SetStateAction } from "react";
import type { RecipeResponse, ShoppingList, WeeklyMealPlan } from "@/lib/api";
import type { MealMeta, SelectedMealRecipe } from "@/lib/types";
import { useAuth } from "@/hooks/useAuth";

type MealPlanCtx = {
  generatedMealPlan: WeeklyMealPlan | null;
  setGeneratedMealPlan: (plan: WeeklyMealPlan | null) => void;
  mealMeta: MealMeta;
  setMealMeta: (meta: MealMeta) => void;
  generatedRecipes: Record<string, RecipeResponse>;
  setGeneratedRecipes: Dispatch<SetStateAction<Record<string, RecipeResponse>>>;
  shoppingList: ShoppingList | null;
  setShoppingList: (list: ShoppingList | null) => void;
  selectedMealRecipe: SelectedMealRecipe;
  setSelectedMealRecipe: (selection: SelectedMealRecipe) => void;
};

const Ctx = createContext<MealPlanCtx | undefined>(undefined);

const defaultMeta: MealMeta = { culinary: "Any", diet: "None", goal: "", planType: "daily" };

const todayDateKey = () => new Date().toISOString().slice(0, 10);
const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * True if a plan generated at `generatedAt` is past its usefulness window:
 *   - daily plan: valid only for the local calendar day it was generated on
 *   - weekly plan: valid for 7 days from generation
 */
function isPlanExpired(generatedAt: string | undefined, planType: "daily" | "weekly"): boolean {
  if (!generatedAt) return false;
  const gen = new Date(generatedAt);
  if (Number.isNaN(gen.getTime())) return true;
  if (planType === "daily") {
    return gen.toISOString().slice(0, 10) !== todayDateKey();
  }
  return Date.now() - gen.getTime() > SEVEN_DAYS_MS;
}

/**
 * State that mirrors to localStorage AND re-hydrates whenever `key` changes
 * (so logging in as a different user pulls from that user's namespace).
 *
 * `lastHydratedKey` guards the write effect — without it, the write would
 * fire on key change and persist the previous user's state to the new key.
 */
function usePersistedState<T>(key: string, initial: T) {
  const initialRef = useRef(initial);
  const [state, setState] = useState<T>(initial);
  const lastHydratedKey = useRef<string | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    let next: T = initialRef.current;
    try {
      const raw = window.localStorage.getItem(key);
      if (raw !== null) next = JSON.parse(raw) as T;
    } catch {
      // fall through to initial
    }
    setState(next);
    lastHydratedKey.current = key;
  }, [key]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (lastHydratedKey.current !== key) return;
    try {
      if (state === null || state === undefined) {
        window.localStorage.removeItem(key);
      } else {
        window.localStorage.setItem(key, JSON.stringify(state));
      }
    } catch {
      // ignore (quota, private mode)
    }
  }, [key, state]);

  return [state, setState] as const;
}

/**
 * One-time cleanup of the pre-scoped global keys we used in an earlier
 * version. Anyone who already has those in localStorage from another
 * account would otherwise keep seeing them as the new "guest" namespace.
 */
function purgeLegacyKeys() {
  if (typeof window === "undefined") return;
  ["zentra:meal:plan", "zentra:meal:meta", "zentra:meal:recipes", "zentra:meal:shopping"].forEach((k) => {
    try {
      window.localStorage.removeItem(k);
    } catch {
      // ignore
    }
  });
}

export function MealPlanProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const scope = user?.id ?? "guest";

  useEffect(() => {
    purgeLegacyKeys();
  }, []);

  const [generatedMealPlan, setGeneratedMealPlan] = usePersistedState<WeeklyMealPlan | null>(`zentra:meal:${scope}:plan`, null);
  const [mealMeta, setMealMeta] = usePersistedState<MealMeta>(`zentra:meal:${scope}:meta`, defaultMeta);
  const [generatedRecipes, setGeneratedRecipes] = usePersistedState<Record<string, RecipeResponse>>(`zentra:meal:${scope}:recipes`, {});
  const [shoppingList, setShoppingList] = usePersistedState<ShoppingList | null>(`zentra:meal:${scope}:shopping`, null);
  const [selectedMealRecipe, setSelectedMealRecipe] = useState<SelectedMealRecipe>(null);

  // Clear nav-only state when the user changes (login/logout); the persisted
  // slices re-hydrate themselves via their scoped keys.
  useEffect(() => {
    setSelectedMealRecipe(null);
  }, [scope]);

  // Auto-expire stale plans. Runs after each hydration and on a 60s interval
  // so a daily plan disappears at midnight without needing a manual refresh.
  useEffect(() => {
    const check = () => {
      if (!generatedMealPlan) return;
      if (isPlanExpired(mealMeta.generatedAt, mealMeta.planType)) {
        setGeneratedMealPlan(null);
        setGeneratedRecipes({});
        setShoppingList(null);
      }
    };
    check();
    const id = window.setInterval(check, 60_000);
    return () => window.clearInterval(id);
  }, [generatedMealPlan, mealMeta.generatedAt, mealMeta.planType, setGeneratedMealPlan, setGeneratedRecipes, setShoppingList]);

  const value = useMemo<MealPlanCtx>(
    () => ({
      generatedMealPlan,
      setGeneratedMealPlan,
      mealMeta,
      setMealMeta,
      generatedRecipes,
      setGeneratedRecipes,
      shoppingList,
      setShoppingList,
      selectedMealRecipe,
      setSelectedMealRecipe,
    }),
    [generatedMealPlan, mealMeta, generatedRecipes, shoppingList, selectedMealRecipe, setGeneratedMealPlan, setMealMeta, setGeneratedRecipes, setShoppingList],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useMealPlan() {
  const c = useContext(Ctx);
  if (!c) throw new Error("useMealPlan must be inside MealPlanProvider");
  return c;
}
