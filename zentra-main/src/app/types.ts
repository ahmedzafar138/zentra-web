export type AppScreen =
  | "splash"
  | "onboarding"
  | "auth"
  | "bodyMetrics"
  | "home"
  | "logs"
  | "ai"
  | "history"
  | "profile"
  | "steps"
  | "blogs"
  | "blogDetail"
  | "mealPlan"
  | "mealWeekly"
  | "mealRecipe"
  | "mealDailyRecipes"
  | "mealShopping"
  | "formCorrection"
  | "formExercises"
  | "formLive"
  | "logsHistory"
  | "mealHistory"
  | "stepsHistory";

export type Tab = "home" | "logs" | "ai" | "history" | "profile";

export type Profile = {
  id?: string;
  first_name: string | null;
  last_name: string | null;
  height_cm: number | null;
  weight_kg: number | null;
  goal_weight_kg?: number | null;
  step_goal: number | null;
  steps_goal?: number | null;
  height_unit?: string | null;
  weight_unit?: string | null;
  avatar_url?: string | null;
  bmi?: number | null;
  onboarding_completed?: boolean | null;
};

export type WorkoutSet = {
  id: string;
  exercise?: string;
  reps: string | number;
  weight: string | number;
  done?: boolean;
  logged?: boolean;
  date?: string;
  timestamp?: string;
  equipment?: string;
};

export type ExerciseLog = {
  id?: string;
  name: string;
  equipment?: string;
  sets: WorkoutSet[];
};

export type Message = {
  id?: string;
  role: "assistant" | "user";
  content: string;
  timestamp: Date;
};

export type BlogPost = {
  id: string;
  title: string;
  snippet: string;
  content: string;
  category: string;
  read_time_min: number;
  published_at: string;
  thumbnail_url?: string | null;
  image_url?: string | null;
};

export type MetricPickerState = {
  metric: "height" | "weight";
  value: number;
  unit: string;
  onSave: (value: number, unit: string) => void | Promise<void>;
} | null;

export type MealMeta = {
  culinary: string;
  diet: string;
  goal: string;
  planType: "daily" | "weekly";
};

export type SelectedMealRecipe = {
  dayKey: string;
  mealKey: "breakfast" | "lunch" | "dinner" | "snacks";
} | null;

