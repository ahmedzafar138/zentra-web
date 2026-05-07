const trimSlash = (value: string) => value.replace(/\/$/, "");

export const MEAL_API_BASE_URL = trimSlash(
  import.meta.env.VITE_MEAL_GENERATOR_API_BASE_URL ??
    import.meta.env.EXPO_PUBLIC_MEAL_GENERATOR_API_BASE_URL ??
    "http://localhost:8000",
);

export const RAG_API_BASE_URL = trimSlash(
  import.meta.env.VITE_RAG_API_BASE_URL ??
    import.meta.env.EXPO_PUBLIC_RAG_API_BASE_URL ??
    "http://localhost:8001",
);

export const MODEL_GATEWAY_API_BASE_URL = trimSlash(
  import.meta.env.VITE_MODEL_GATEWAY_API_BASE_URL ??
    import.meta.env.EXPO_PUBLIC_MODEL_GATEWAY_API_BASE_URL ??
    "http://localhost:8010",
);

export type ApiStatus = "checking" | "online" | "offline";

export type ServiceCheck = {
  name: string;
  baseUrl: string;
  status: ApiStatus;
  message: string;
  checkedAt?: string;
};

export type MealPlanRequest = {
  userProfile: string;
  dietaryPreference?: string;
  additionalRequirements?: string;
};

export type MealPlanResponse = {
  success: boolean;
  meal_plan?: string;
  message: string;
};

export type Meal = {
  food: string;
  portion: string;
  macros: {
    energy_kcal: number;
    protein_g: number;
    carbohydrates_g: number;
    fat_g: number;
  };
};

export type DayMealPlan = {
  breakfast: Meal;
  lunch: Meal;
  dinner: Meal;
  snacks: Meal;
};

export type WeeklyMealPlan = Record<string, DayMealPlan>;

export type RecipeResponse = {
  meal_name?: string;
  ingredients?: {
    heading?: string;
    items?: string[];
  };
  instructions?: {
    heading?: string;
    steps?: string[];
  };
  [key: string]: unknown;
};

export type ShoppingList = Record<string, string[]>;

export type RagResponse = {
  answer: string;
};

export type BicepCurlSession = {
  session_id: string;
  message: string;
};

async function readJson<T>(response: Response): Promise<T> {
  const data = await response.json().catch(() => null);

  if (!response.ok) {
    const message = data?.detail ?? data?.message ?? `Request failed with ${response.status}`;
    throw new Error(message);
  }

  return data as T;
}

async function getJson<T>(baseUrl: string, path: string): Promise<T> {
  const url = `${baseUrl}${path}`;
  try {
    const response = await fetch(url);
    return readJson<T>(response);
  } catch (error) {
    throw new Error(error instanceof Error ? `${error.message} (${url})` : `Unable to reach ${url}`);
  }
}

async function postJson<T>(baseUrl: string, path: string, body?: unknown): Promise<T> {
  const url = `${baseUrl}${path}`;
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: body ? JSON.stringify(body) : undefined,
    });

    return readJson<T>(response);
  } catch (error) {
    throw new Error(error instanceof Error ? `${error.message} (${url})` : `Unable to reach ${url}`);
  }
}

export async function checkService(
  name: string,
  baseUrl: string,
  healthPath = "/health",
): Promise<ServiceCheck> {
  try {
    const data = await getJson<Record<string, unknown>>(baseUrl, healthPath);
    return {
      name,
      baseUrl,
      status: "online",
      message: String(data.status ?? data.message ?? "Ready"),
      checkedAt: new Date().toLocaleTimeString(),
    };
  } catch (error) {
    return {
      name,
      baseUrl,
      status: "offline",
      message: error instanceof Error ? error.message : "Unable to reach service",
      checkedAt: new Date().toLocaleTimeString(),
    };
  }
}

export function checkAllServices() {
  return Promise.all([
    checkService("Meal generator", MEAL_API_BASE_URL),
    checkService("Zentra AI RAG", RAG_API_BASE_URL),
    checkService("Form correction", MODEL_GATEWAY_API_BASE_URL),
  ]);
}

export function generateDailyMealPlan(payload: MealPlanRequest) {
  return postJson<MealPlanResponse>(MEAL_API_BASE_URL, "/api/v1/meal-planning/generate-daily", {
    user_profile: payload.userProfile,
    dietary_preferences: payload.dietaryPreference,
    additional_requirements: payload.additionalRequirements,
  });
}

export function generateWeeklyMealPlan(payload: MealPlanRequest) {
  return postJson<MealPlanResponse>(MEAL_API_BASE_URL, "/api/v1/meal-planning/generate-weekly", {
    user_profile: payload.userProfile,
    dietary_preferences: payload.dietaryPreference,
    additional_requirements: payload.additionalRequirements,
  });
}

export function generateDailyRecipes(meals: Record<string, string>) {
  return postJson<Record<string, RecipeResponse>>(MEAL_API_BASE_URL, "/api/v1/recipe/generate-daily-recipes", {
    meals,
  });
}

export function generateShoppingList(weeklyPlan: WeeklyMealPlan) {
  const shoppingPayload = Object.fromEntries(
    Object.entries(weeklyPlan).map(([dayKey, dayPlan]) => [
      dayKey,
      Object.fromEntries(
        Object.entries(dayPlan).map(([mealKey, meal]) => [
          mealKey,
          {
            food: meal.food,
            portion: meal.portion,
          },
        ]),
      ),
    ]),
  );

  return postJson<{ data: ShoppingList }>(MEAL_API_BASE_URL, "/api/v1/shopping_list/generate", shoppingPayload);
}

export function parseMealPlan(value: unknown): WeeklyMealPlan {
  const raw =
    typeof value === "string"
      ? JSON.parse(
          value
            .replace(/```json\s*/i, "")
            .replace(/```/g, "")
            .trim(),
        )
      : value;
  const candidate = (raw as any)?.meal_plan ?? (raw as any)?.plan ?? raw;
  const firstDay = (candidate as any)?.day1 ? candidate : { day1: candidate };
  return firstDay as WeeklyMealPlan;
}

export function askZentra(question: string) {
  return postJson<RagResponse>(RAG_API_BASE_URL, "/ask", { question });
}

export function loadBicepCurlModel() {
  return postJson<Record<string, unknown>>(
    MODEL_GATEWAY_API_BASE_URL,
    "/api/v1/bicep-curl/load",
  );
}


export function startBicepCurlSession() {
  return postJson<BicepCurlSession>(
    MODEL_GATEWAY_API_BASE_URL,
    "/api/v1/bicep-curl/session/start",
  );
}

