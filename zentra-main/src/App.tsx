import { useEffect, useState } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase, hasSupabaseConfig } from "@/lib/supabase";
import { MetricPickerModal, TabBar } from "@/components/ui";
import type { AppScreen, BlogPost, MealMeta, MetricPickerState, Profile, SelectedMealRecipe, Tab } from "@/app/types";
import type { RecipeResponse, ShoppingList, WeeklyMealPlan } from "@/lib/api";
import {
  AiScreen,
  AuthScreen,
  BlogDetailScreen,
  BlogsScreen,
  BodyMetricsScreen,
  DailyRecipesScreen,
  FormCorrectionScreen,
  FormExercisesScreen,
  FormLiveScreen,
  HistoryScreen,
  HomeScreen,
  LogsHistoryScreen,
  LogsScreen,
  MealHistoryScreen,
  MealPlanScreen,
  MealRecipeScreen,
  MealShoppingScreen,
  OnboardingScreen,
  ProfileScreen,
  SplashScreen,
  StepsHistoryScreen,
  SessionHistoryScreen,
  StepsScreen,
  WeeklyMealPlanScreen,
} from "@/screens";

const appScreensList = [
  "home",
  "logs",
  "ai",
  "history",
  "profile",
  "steps",
  "blogs",
  "blogDetail",
  "mealPlan",
  "mealWeekly",
  "mealRecipe",
  "mealDailyRecipes",
  "mealShopping",
  "formCorrection",
  "formExercises",
  "formLive",
  "logsHistory",
  "mealHistory",
  "stepsHistory",
  "sessionHistory",
] as const satisfies readonly AppScreen[];

const appScreenSet = new Set<AppScreen>(appScreensList);
const storedScreenKey = "zentra:last-screen";
const storedMuscleGroupKey = "zentra:last-muscle-group";
const storedExerciseKey = "zentra:last-exercise";

const readStoredScreen = () => {
  if (typeof window === "undefined") return null;
  const value = window.sessionStorage.getItem(storedScreenKey) as AppScreen | null;
  return value && appScreenSet.has(value) ? value : null;
};

const readStoredValue = (key: string, fallback: string) => {
  if (typeof window === "undefined") return fallback;
  return window.sessionStorage.getItem(key) || fallback;
};

export default function App() {
  const [screen, setScreen] = useState<AppScreen>(() => readStoredScreen() ?? "splash");
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loadingProfile, setLoadingProfile] = useState(false);
  const [toast, setToast] = useState("");
  const [selectedMuscleGroup, setSelectedMuscleGroup] = useState(() => readStoredValue(storedMuscleGroupKey, "Biceps"));
  const [selectedExercise, setSelectedExercise] = useState(() => readStoredValue(storedExerciseKey, "Bicep Curl"));
  const [metricPicker, setMetricPicker] = useState<MetricPickerState>(null);
  const [logsHistoryBackTo, setLogsHistoryBackTo] = useState<AppScreen>("history");
  const [stepsHistoryBackTo, setStepsHistoryBackTo] = useState<AppScreen>("history");
  const [mealHistoryBackTo, setMealHistoryBackTo] = useState<AppScreen>("history");
  const [sessionHistoryBackTo, setSessionHistoryBackTo] = useState<AppScreen>("history");
  const [selectedBlog, setSelectedBlog] = useState<BlogPost | null>(null);
  const [generatedMealPlan, setGeneratedMealPlan] = useState<WeeklyMealPlan | null>(null);
  const [mealMeta, setMealMeta] = useState<MealMeta>({ culinary: "Any", diet: "None", goal: "", planType: "daily" });
  const [selectedMealRecipe, setSelectedMealRecipe] = useState<SelectedMealRecipe>(null);
  const [generatedRecipes, setGeneratedRecipes] = useState<Record<string, RecipeResponse>>({});
  const [shoppingList, setShoppingList] = useState<ShoppingList | null>(null);

  const showToast = (message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(""), 2400);
  };

  const loadProfile = async (currentUser = user) => {
    if (!currentUser || !hasSupabaseConfig) return null;
    setLoadingProfile(true);
    try {
      const { data, error } = await supabase
        .from("user_profiles")
        .select("*")
        .eq("id", currentUser.id)
        .maybeSingle();
      if (error) throw error;
      setProfile(data as Profile | null);
      return data as Profile | null;
    } finally {
      setLoadingProfile(false);
    }
  };

  const ensureProfile = async (currentUser: User, fallback: Partial<Profile> = {}) => {
    if (!hasSupabaseConfig) return { first_name: fallback.first_name ?? currentUser.email?.split("@")[0] ?? "Zentra", last_name: fallback.last_name ?? null, height_cm: null, weight_kg: null, step_goal: 10000 };
    const { data: existing, error: fetchError } = await supabase
      .from("user_profiles")
      .select("*")
      .eq("id", currentUser.id)
      .maybeSingle();
    if (fetchError) throw new Error(`Signed in, but profile lookup failed: ${fetchError.message}`);

    if (existing) {
      setProfile(existing as Profile);
      return existing as Profile;
    }

    const fallbackName = currentUser.email?.split("@")[0] ?? "Zentra";
    const { data, error } = await supabase
      .from("user_profiles")
      .insert({ id: currentUser.id, first_name: fallback.first_name ?? fallbackName, last_name: fallback.last_name ?? null, step_goal: 10000 })
      .select("*")
      .single();
    if (error) throw new Error(`Signed in, but profile creation failed: ${error.message}`);
    setProfile(data as Profile);
    return data as Profile;
  };

  const routeForSession = async (currentSession: Session | null, preferredScreen: AppScreen | null = readStoredScreen()) => {
    await new Promise((resolve) => setTimeout(resolve, 1500));
    if (!currentSession?.user) {
      setScreen("onboarding");
      return;
    }

    setUser(currentSession.user);
    try {
      const loaded = await ensureProfile(currentSession.user);
      if (loaded?.onboarding_completed && loaded.height_cm && loaded.weight_kg) {
        setScreen(preferredScreen ?? "home");
      } else {
        setScreen("bodyMetrics");
      }
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Could not connect to Supabase profile data.");
      setScreen("auth");
    }
  };

  useEffect(() => {
    let active = true;
    if (!hasSupabaseConfig) {
      window.setTimeout(() => active && setScreen("onboarding"), 700);
      return;
    }

    supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      setSession(data.session);
      routeForSession(data.session);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((event, nextSession) => {
      setSession(nextSession);
      setUser(nextSession?.user ?? null);
      if (nextSession?.user && event === "SIGNED_IN") {
        routeForSession(nextSession);
      } else if (!nextSession?.user && event === "SIGNED_OUT") {
        setProfile(null);
        setScreen("auth");
      }
    });

    return () => {
      active = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (appScreenSet.has(screen)) {
      window.sessionStorage.setItem(storedScreenKey, screen);
    }
  }, [screen]);

  useEffect(() => {
    window.sessionStorage.setItem(storedMuscleGroupKey, selectedMuscleGroup);
  }, [selectedMuscleGroup]);

  useEffect(() => {
    window.sessionStorage.setItem(storedExerciseKey, selectedExercise);
  }, [selectedExercise]);

  const navigate = (next: AppScreen) => setScreen(next);
  const openLogsHistory = (backTo: AppScreen) => {
    setLogsHistoryBackTo(backTo);
    setScreen("logsHistory");
  };
  const openStepsHistory = (backTo: AppScreen) => {
    setStepsHistoryBackTo(backTo);
    setScreen("stepsHistory");
  };
  const openMealHistory = (backTo: AppScreen) => {
    setMealHistoryBackTo(backTo);
    setScreen("mealHistory");
  };
  const openSessionHistory = (backTo: AppScreen) => {
    setSessionHistoryBackTo(backTo);
    setScreen("sessionHistory");
  };

  const activeTab: Tab | null =
    screen === "home" ||
    screen === "steps" ||
    screen === "blogs" ||
    screen === "blogDetail" ||
    screen === "mealPlan" ||
    screen === "mealWeekly" ||
    screen === "mealRecipe" ||
    screen === "mealDailyRecipes" ||
    screen === "mealShopping" ||
    screen === "formCorrection" ||
    screen === "formExercises" ||
    screen === "formLive"
      ? "home"
      : screen === "logs" || screen === "logsHistory" || screen === "mealHistory" || screen === "stepsHistory" || screen === "sessionHistory"
        ? "logs"
        : screen === "ai"
          ? "ai"
          : screen === "history"
            ? "history"
            : screen === "profile"
              ? "profile"
              : null;

  const commonProps = {
    user,
    profile,
    loadingProfile,
    loadProfile,
    navigate,
    showToast,
    ensureProfile,
    setMetricPicker,
    openLogsHistory,
    openStepsHistory,
    openMealHistory,
    openSessionHistory,
    generatedMealPlan,
    setGeneratedMealPlan,
    mealMeta,
    setMealMeta,
    setSelectedMealRecipe,
    generatedRecipes,
    setGeneratedRecipes,
    shoppingList,
    setShoppingList,
  };

  const appScreens = (
    <>
      {screen === "home" && <HomeScreen {...commonProps} />}
      {screen === "logs" && <LogsScreen {...commonProps} />}
      {screen === "ai" && <AiScreen navigate={navigate} profile={profile} />}
      {screen === "history" && <HistoryScreen navigate={navigate} openLogsHistory={openLogsHistory} openStepsHistory={openStepsHistory} openMealHistory={openMealHistory} openSessionHistory={openSessionHistory} />}
      {screen === "profile" && <ProfileScreen {...commonProps} />}
      {screen === "steps" && <StepsScreen {...commonProps} />}
      {screen === "blogs" && <BlogsScreen navigate={navigate} showToast={showToast} selectBlog={(blog) => { setSelectedBlog(blog); navigate("blogDetail"); }} />}
      {screen === "blogDetail" && <BlogDetailScreen blog={selectedBlog} navigate={navigate} />}
      {screen === "mealPlan" && <MealPlanScreen {...commonProps} />}
      {screen === "mealWeekly" && <WeeklyMealPlanScreen {...commonProps} />}
      {screen === "mealRecipe" && <MealRecipeScreen {...commonProps} selectedMealRecipe={selectedMealRecipe} />}
      {screen === "mealDailyRecipes" && <DailyRecipesScreen {...commonProps} />}
      {screen === "mealShopping" && <MealShoppingScreen {...commonProps} />}
      {screen === "formCorrection" && (
        <FormCorrectionScreen
          profile={profile}
          selectGroup={(group) => { setSelectedMuscleGroup(group); navigate("formExercises"); }}
          navigate={navigate}
        />
      )}
      {screen === "formExercises" && (
        <FormExercisesScreen
          group={selectedMuscleGroup}
          selectExercise={(exercise) => { setSelectedExercise(exercise); navigate("formLive"); }}
          navigate={navigate}
        />
      )}
      {screen === "formLive" && (
        <FormLiveScreen
          group={selectedMuscleGroup}
          exercise={selectedExercise}
          user={user}
          navigate={navigate}
          showToast={showToast}
        />
      )}
      {screen === "logsHistory" && <LogsHistoryScreen user={user} navigate={navigate} showToast={showToast} backTo={logsHistoryBackTo} />}
      {screen === "mealHistory" && <MealHistoryScreen user={user} navigate={navigate} showToast={showToast} backTo={mealHistoryBackTo} />}
      {screen === "stepsHistory" && <StepsHistoryScreen user={user} navigate={navigate} showToast={showToast} backTo={stepsHistoryBackTo} />}
      {screen === "sessionHistory" && <SessionHistoryScreen user={user} navigate={navigate} showToast={showToast} backTo={sessionHistoryBackTo} />}
    </>
  );

  return (
    <div className={activeTab ? "phone-shell with-tabs" : "phone-shell"}>
      {toast && <div className="toast">{toast}</div>}
      {screen === "splash" && <SplashScreen />}
      {screen === "onboarding" && <OnboardingScreen navigate={navigate} />}
      {screen === "auth" && (
        <AuthScreen
          navigate={navigate}
          showToast={showToast}
          ensureProfile={ensureProfile}
          routeForSession={routeForSession}
        />
      )}
      {screen === "bodyMetrics" && user && (
        <BodyMetricsScreen
          user={user}
          profile={profile}
          loadProfile={loadProfile}
          navigate={navigate}
          showToast={showToast}
          setMetricPicker={setMetricPicker}
        />
      )}
      {activeTab && <div className="app-content">{appScreens}</div>}
      {activeTab && <TabBar screen={screen} navigate={navigate} />}
      {metricPicker && (
        <MetricPickerModal
          picker={metricPicker}
          onClose={() => setMetricPicker(null)}
          showToast={showToast}
        />
      )}
      {!session && screen !== "auth" && screen !== "onboarding" && screen !== "splash" && (
        <AuthScreen
          navigate={navigate}
          showToast={showToast}
          ensureProfile={ensureProfile}
          routeForSession={routeForSession}
        />
      )}
    </div>
  );
}


