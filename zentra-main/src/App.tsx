import { FormEvent, useEffect, useMemo, useRef, useState, type Dispatch, type SetStateAction } from "react";
import type { Session, User } from "@supabase/supabase-js";
import {
  Activity,
  Award,
  BarChart3,
  Bell,
  BicepsFlexed,
  BotMessageSquare,
  Camera,
  Check,
  CheckSquare,
  CheckCircle,
  ChefHat,
  ChevronRight,
  Dumbbell,
  Eye,
  EyeOff,
  Flame,
  Footprints,
  History,
  Home,
  Loader2,
  LogOut,
  MessageCircle,
  Newspaper,
  Pause,
  Play,
  RefreshCw,
  RotateCcw,
  Search,
  Send,
  Shirt,
  Sparkles,
  Square,
  TrendingUp,
  Trash2,
  User as UserIcon,
  UtensilsCrossed,
} from "lucide-react";
import zentraLogo from "../assets/images/icon.jpg";
import {
  DayMealPlan,
  WeeklyMealPlan,
  askZentra,
  checkAllServices,
  generateDailyMealPlan,
  generateDailyRecipes,
  generateShoppingList,
  generateWeeklyMealPlan,
  loadBicepCurlModel,
  MODEL_GATEWAY_API_BASE_URL,
  parseMealPlan,
  type RecipeResponse,
  type ServiceCheck,
  type ShoppingList,
} from "@/lib/api";
import { supabase } from "@/lib/supabase";
import { hasSupabaseConfig } from "@/lib/supabase";

type AppScreen =
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

type Tab = "home" | "logs" | "ai" | "history" | "profile";

type Profile = {
  id: string;
  first_name?: string;
  last_name?: string;
  avatar_url?: string | null;
  height_cm?: number | null;
  weight_kg?: number | null;
  height_unit?: string | null;
  weight_unit?: string | null;
  steps_goal?: number | null;
  bmi?: number | null;
  onboarding_completed?: boolean | null;
};

type WorkoutSet = {
  id: string;
  weight: number;
  reps: number;
  logged: boolean;
  date: string;
  timestamp: string;
  equipment?: string;
};

type ExerciseLog = {
  id?: string;
  name: string;
  equipment: string;
  sets: WorkoutSet[];
};

type Message = {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
};

type BlogPost = {
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

type MetricPickerState = {
  metric: "height" | "weight";
  value: number;
  unit: string;
  onSave: (value: number, unit: string) => void | Promise<void>;
} | null;

type MealMeta = {
  culinary: string;
  diet: string;
  goal: string;
  planType: "daily" | "weekly";
};

type SelectedMealRecipe = {
  dayKey: string;
  mealKey: keyof DayMealPlan;
} | null;

function formatHeightValue(value: number, unit: string) {
  if (unit === "cm") return `${value} cm`;
  const totalInches = Math.round(value / 2.54);
  return `${Math.floor(totalInches / 12)} ft ${totalInches % 12} in`;
}

function formatWeightValue(value: number, unit: string) {
  return unit === "kg" ? `${value} kg` : `${Math.round(value * 2.20462)} lb`;
}

function formatDuration(seconds: number) {
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(remainingSeconds).padStart(2, "0")}`;
}

const todayKey = () => new Date().toISOString().split("T")[0];
const monthKey = (date = new Date()) => date.toISOString().slice(0, 7);
const calculateBmi = (height?: number | null, weight?: number | null) => {
  if (!height || !weight) return null;
  return Number((weight / (height / 100) ** 2).toFixed(1));
};
const bmiCategory = (bmi?: number | null) => {
  if (!bmi) return "";
  if (bmi < 18.5) return "Underweight";
  if (bmi < 25) return "Normal";
  if (bmi < 30) return "Overweight";
  return "Obese";
};

function PrimaryButton({
  children,
  onClick,
  disabled,
  type = "button",
}: {
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  type?: "button" | "submit";
}) {
  return (
    <button className="primary-button" type={type} onClick={onClick} disabled={disabled}>
      {children}
    </button>
  );
}

function ScreenHeader({
  title,
  subtitle,
  onBack,
  action,
  onLogo,
}: {
  title: string;
  subtitle?: string;
  onBack?: () => void;
  action?: React.ReactNode;
  onLogo?: () => void;
}) {
  return (
    <header className="screen-header">
      {onBack ? (
        <button className="icon-button" onClick={onBack} aria-label="Back">
          <ChevronRight className="rotate-180" size={22} />
        </button>
      ) : (
        <span className="header-spacer" />
      )}
      <div>
        <h1>{onLogo ? <button className="title-logo-button" onClick={onLogo}><img src={zentraLogo} alt="" />{title}</button> : title}</h1>
        {subtitle && <p>{subtitle}</p>}
      </div>
      {action ?? <span className="header-spacer" />}
    </header>
  );
}

function TabBar({ screen, navigate }: { screen: AppScreen; navigate: (screen: AppScreen) => void }) {
  const items: { id: Tab; label: string; screen: AppScreen; icon: typeof Home; mobile?: boolean }[] = [
    { id: "home", label: "Home", screen: "home", icon: Home, mobile: true },
    { id: "home", label: "Form", screen: "formCorrection", icon: Camera, mobile: true },
    { id: "ai", label: "Zentra AI", screen: "ai", icon: BotMessageSquare, mobile: true },
    { id: "logs", label: "Logs", screen: "logs", icon: BarChart3, mobile: true },
    { id: "profile", label: "Profile", screen: "profile", icon: UserIcon, mobile: true },
  ];

  return (
    <nav className="bottom-tabs" aria-label="Main tabs">
      {items.map((item) => {
        const Icon = item.icon;
        const isAi = item.id === "ai";
        const isActive =
          screen === item.screen ||
          (item.screen === "formCorrection" && (screen === "formExercises" || screen === "formLive"));
        return (
          <button
            className={`tab-button ${isActive ? "tab-active" : ""} ${isAi ? "ai-tab" : ""} ${item.mobile ? "mobile-tab" : "desktop-only-tab"}`}
            key={item.id}
            onClick={() => navigate(item.screen)}
            type="button"
          >
            <span className={isAi ? "ai-tab-icon" : ""}>
              <Icon size={isAi ? 28 : 22} />
            </span>
            {item.label && <small>{item.label}</small>}
          </button>
        );
      })}
    </nav>
  );
}

function MetricPickerModal({
  picker,
  onClose,
  showToast,
}: {
  picker: NonNullable<MetricPickerState>;
  onClose: () => void;
  showToast: (message: string) => void;
}) {
  const [value, setValue] = useState(picker.value);
  const [unit, setUnit] = useState(picker.unit);
  const options = useMemo(
    () => Array.from({ length: picker.metric === "height" ? 101 : 186 }, (_, index) => (picker.metric === "height" ? 120 : 35) + index),
    [picker.metric],
  );
  const format = picker.metric === "height" ? formatHeightValue : formatWeightValue;
  const wheelRef = useRef<HTMLDivElement | null>(null);
  const rowHeight = 72;

  useEffect(() => {
    const index = Math.max(0, options.indexOf(value));
    wheelRef.current?.scrollTo({ top: index * rowHeight, behavior: "auto" });
  }, [options, value]);

  const handleWheelScroll = () => {
    const wheel = wheelRef.current;
    if (!wheel) return;
    const nextIndex = Math.min(options.length - 1, Math.max(0, Math.round(wheel.scrollTop / rowHeight)));
    const nextValue = options[nextIndex];
    if (nextValue !== value) setValue(nextValue);
  };

  const selectWheelValue = (item: number) => {
    setValue(item);
    const index = Math.max(0, options.indexOf(item));
    wheelRef.current?.scrollTo({ top: index * rowHeight, behavior: "smooth" });
  };

  const complete = async () => {
    try {
      await picker.onSave(value, unit);
      onClose();
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Could not update metric.");
    }
  };

  return (
    <div className="metric-modal-backdrop">
      <section className="metric-modal">
        <button className="icon-button metric-modal-back" onClick={onClose} aria-label="Back">
          <ChevronRight className="rotate-180" size={26} />
        </button>
        <h1>{picker.metric === "height" ? "What's your height?" : "Almost there!"}</h1>
        <div className="metric-modal-card">
          <h2>{picker.metric === "height" ? "Your Height" : "Your Weight"}</h2>
          <div className="segmented compact metric-unit-tabs">
            {(picker.metric === "height" ? ["cm", "ft-in"] : ["kg", "lb"]).map((item) => (
              <button className={unit === item ? "segment-active" : ""} onClick={() => setUnit(item)} key={item}>
                {item}
              </button>
            ))}
          </div>
          <div className="metric-wheel" ref={wheelRef} onScroll={handleWheelScroll}>
            <div className="metric-wheel-spacer" />
            {options.map((item) => (
              <button className={item === value ? "metric-wheel-row selected" : "metric-wheel-row"} key={item} onClick={() => selectWheelValue(item)} type="button">
                {format(item, unit)}
              </button>
            ))}
            <div className="metric-wheel-spacer" />
          </div>
        </div>
        <PrimaryButton onClick={complete}>Done</PrimaryButton>
      </section>
    </div>
  );
}

function AppTopBar({ profile, navigate }: { profile: Profile | null; navigate: (screen: AppScreen) => void }) {
  const initials = `${profile?.first_name?.[0] ?? "A"}${profile?.last_name?.[0] ?? "Z"}`;
  return (
    <header className="top-bar">
      <label className="search-box">
        <Search size={18} />
        <input placeholder="Search workouts, meals, articles..." />
      </label>
      <div className="top-actions">
        <button className="icon-button" aria-label="Notifications"><Bell size={20} /></button>
        <button className="top-avatar" onClick={() => navigate("profile")}>
          {profile?.avatar_url ? <img src={profile.avatar_url} alt="" /> : initials}
        </button>
      </div>
    </header>
  );
}

export default function App() {
  const [screen, setScreen] = useState<AppScreen>("splash");
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [toast, setToast] = useState("");
  const [selectedMuscleGroup, setSelectedMuscleGroup] = useState("Biceps");
  const [selectedExercise, setSelectedExercise] = useState("Bicep Curl");
  const [metricPicker, setMetricPicker] = useState<MetricPickerState>(null);
  const [logsHistoryBackTo, setLogsHistoryBackTo] = useState<AppScreen>("history");
  const [stepsHistoryBackTo, setStepsHistoryBackTo] = useState<AppScreen>("history");
  const [mealHistoryBackTo, setMealHistoryBackTo] = useState<AppScreen>("history");
  const [selectedBlog, setSelectedBlog] = useState<BlogPost | null>(null);
  const [generatedMealPlan, setGeneratedMealPlan] = useState<WeeklyMealPlan | null>(null);
  const [mealMeta, setMealMeta] = useState<MealMeta>({ culinary: "Any", diet: "None", goal: "", planType: "daily" });
  const [selectedMealRecipe, setSelectedMealRecipe] = useState<SelectedMealRecipe>(null);
  const [generatedRecipes, setGeneratedRecipes] = useState<Record<string, RecipeResponse>>({});
  const [shoppingList, setShoppingList] = useState<ShoppingList | null>(null);

  const showToast = (message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(""), 3200);
  };

  const loadProfile = async (currentUser = user) => {
    if (!currentUser) return null;
    const { data, error } = await supabase
      .from("user_profiles")
      .select("*")
      .eq("id", currentUser.id)
      .maybeSingle();
    if (error) throw error;
    setProfile(data as Profile | null);
    return data as Profile | null;
  };

  const ensureProfile = async (currentUser: User, fallback?: Partial<Profile>) => {
    const existing = await loadProfile(currentUser);
    if (existing) return existing;

    const { data, error } = await supabase
      .from("user_profiles")
      .upsert(
        {
          id: currentUser.id,
          first_name: currentUser.user_metadata?.first_name ?? fallback?.first_name ?? "Zentra",
          last_name: currentUser.user_metadata?.last_name ?? fallback?.last_name ?? "User",
          onboarding_completed: false,
        },
        { onConflict: "id" },
      )
      .select("*")
      .single();
    if (error) throw error;
    setProfile(data as Profile);
    return data as Profile;
  };

  const routeForSession = async (currentSession: Session | null) => {
    await new Promise((resolve) => setTimeout(resolve, 1500));
    if (!currentSession?.user) {
      setScreen("onboarding");
      return;
    }

    setUser(currentSession.user);
    try {
      const loaded = await ensureProfile(currentSession.user);
      if (loaded?.onboarding_completed && loaded.height_cm && loaded.weight_kg) {
        setScreen("home");
      } else {
        setScreen("bodyMetrics");
      }
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Could not connect to Supabase profile data.");
      setScreen("auth");
    }
  };

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      routeForSession(data.session).catch((error) => {
        console.error(error);
        setScreen("onboarding");
      });
    });

    const { data } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      setUser(nextSession?.user ?? null);
      if (!nextSession) {
        setProfile(null);
        setScreen("auth");
      }
    });

    return () => data.subscription.unsubscribe();
  }, []);

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
      : screen === "logs" || screen === "logsHistory"
        ? "logs"
        : screen === "ai"
          ? "ai"
          : screen === "history" || screen === "mealHistory" || screen === "stepsHistory"
            ? "history"
            : screen === "profile"
              ? "profile"
              : null;

  const commonProps = {
    user,
    profile,
    loadProfile,
    navigate,
    showToast,
    ensureProfile,
    setMetricPicker,
    openLogsHistory,
    openStepsHistory,
    openMealHistory,
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
      {screen === "history" && <HistoryScreen navigate={navigate} openLogsHistory={openLogsHistory} openStepsHistory={openStepsHistory} openMealHistory={openMealHistory} />}
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
          navigate={navigate}
          selectGroup={(group) => {
            setSelectedMuscleGroup(group);
            navigate("formExercises");
          }}
        />
      )}
      {screen === "formExercises" && (
        <FormExercisesScreen
          group={selectedMuscleGroup}
          navigate={navigate}
          selectExercise={(exercise) => {
            setSelectedExercise(exercise);
            navigate("formLive");
          }}
        />
      )}
      {screen === "formLive" && (
        <FormLiveScreen
          group={selectedMuscleGroup}
          exercise={selectedExercise}
          navigate={navigate}
          showToast={showToast}
        />
      )}
      {screen === "logsHistory" && <LogsHistoryScreen user={user} navigate={navigate} showToast={showToast} backTo={logsHistoryBackTo} />}
      {screen === "mealHistory" && <MealHistoryScreen user={user} navigate={navigate} showToast={showToast} backTo={mealHistoryBackTo} />}
      {screen === "stepsHistory" && <StepsHistoryScreen user={user} navigate={navigate} showToast={showToast} backTo={stepsHistoryBackTo} />}
    </>
  );

  return (
    <main className="phone-shell">
      {toast && <div className="toast">{toast}</div>}
      {!hasSupabaseConfig && (
        <div className="toast">Missing Supabase config. Check zentra-main/.env.</div>
      )}
      {screen === "splash" && <SplashScreen />}
      {screen === "onboarding" && <OnboardingScreen navigate={navigate} />}
      {screen === "auth" && (
        <AuthScreen
          navigate={navigate}
          ensureProfile={ensureProfile}
          routeForSession={routeForSession}
          showToast={showToast}
        />
      )}
      {screen === "bodyMetrics" && (
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
          ensureProfile={ensureProfile}
          routeForSession={routeForSession}
          showToast={showToast}
        />
      )}
    </main>
  );
}

function SplashScreen() {
  return (
    <section className="splash">
      <div className="splash-content">
        <h1>Zentra</h1>
        <p>AI Fitness Trainer</p>
      </div>
    </section>
  );
}

function OnboardingScreen({ navigate }: { navigate: (screen: AppScreen) => void }) {
  const data = [
    { icon: Dumbbell, title: "Zentra", description: "Ready to transform your body?", button: "Get Started" },
    { icon: CheckCircle, title: "Form correction", description: "So accurate you'll NEVER need a trainer.", button: "Next" },
    { icon: ChefHat, title: "Smart meal plans", description: "Generate recipes at a tap-personalized by AI.", button: "Next" },
    { icon: MessageCircle, title: "Ask anything", description: "An AI-assisted coach for all your fitness questions.", button: "Next" },
    { icon: Newspaper, title: "Stay updated", description: "Expert blogs to keep up with the latest fitness trends.", button: "Next" },
    { icon: TrendingUp, title: "Track progress", description: "Visualize your workouts and celebrate wins.", button: "Next" },
    { icon: Footprints, title: "Walk it off", description: "Built-in step counter to burn that stubborn belly fat.", button: "Let's start!" },
  ];
  const [index, setIndex] = useState(0);
  const current = data[index];
  const Icon = current.icon;

  return (
    <section className="onboarding">
      <div className="onboarding-safe">
        {index < data.length - 1 && (
          <button className="skip-button" onClick={() => navigate("auth")}>
            Skip
          </button>
        )}
        <div className="onboarding-body">
          <div className="onboarding-icon">
            <Icon size={80} strokeWidth={1.5} />
          </div>
          <h1>{current.title}</h1>
          <p>{current.description}</p>
          <div className="dots">
            {data.map((_, dotIndex) => (
              <span className={dotIndex === index ? "dot active-dot" : "dot"} key={dotIndex} />
            ))}
          </div>
        </div>
        <div className="onboarding-footer">
          <PrimaryButton onClick={() => (index < data.length - 1 ? setIndex(index + 1) : navigate("auth"))}>
            {current.button}
          </PrimaryButton>
        </div>
      </div>
    </section>
  );
}

function AuthScreen({
  navigate,
  ensureProfile,
  routeForSession,
  showToast,
}: {
  navigate: (screen: AppScreen) => void;
  ensureProfile: (user: User, fallback?: Partial<Profile>) => Promise<Profile>;
  routeForSession: (session: Session | null) => Promise<void>;
  showToast: (message: string) => void;
}) {
  const [mode, setMode] = useState<"login" | "signup" | "forgot">("login");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    email: "",
    password: "",
    confirmPassword: "",
  });
  const [error, setError] = useState("");

  const update = (key: keyof typeof form, value: string) => setForm((prev) => ({ ...prev, [key]: value }));

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError("");
    setLoading(true);
    try {
      if (mode === "forgot") {
        const { error: resetError } = await supabase.auth.resetPasswordForEmail(form.email);
        if (resetError) throw resetError;
        showToast("Password reset email sent.");
        setMode("login");
        return;
      }

      if (mode === "signup") {
        if (!form.firstName || !form.lastName) throw new Error("Please enter your first and last name.");
        if (form.password !== form.confirmPassword) throw new Error("Passwords do not match.");
        const { data, error: signUpError } = await supabase.auth.signUp({
          email: form.email,
          password: form.password,
          options: { data: { first_name: form.firstName, last_name: form.lastName } },
        });
        if (signUpError) throw signUpError;
        if (data.user) await ensureProfile(data.user, { first_name: form.firstName, last_name: form.lastName });
        navigate("bodyMetrics");
        return;
      }

      const { data, error: signInError } = await supabase.auth.signInWithPassword({
        email: form.email,
        password: form.password,
      });
      if (signInError) throw signInError;
      if (data.user) await ensureProfile(data.user);
      await routeForSession(data.session);
    } catch (authError) {
      setError(authError instanceof Error ? authError.message : "Authentication failed.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="screen-pad auth-screen">
      <div className="auth-logo">Zentra</div>
      <div className="segmented">
        <button className={mode === "login" ? "segment-active" : ""} onClick={() => setMode("login")}>
          Log In
        </button>
        <button className={mode === "signup" ? "segment-active" : ""} onClick={() => setMode("signup")}>
          Sign up
        </button>
      </div>
      <form className="form-stack" onSubmit={submit}>
        {error && <div className="error-box">{error}</div>}
        {mode === "forgot" && <p className="muted">Enter your email and Zentra will send a reset link.</p>}
        {mode === "signup" && (
          <div className="form-row">
            <label>
              First Name
              <input value={form.firstName} onChange={(event) => update("firstName", event.target.value)} />
            </label>
            <label>
              Last Name
              <input value={form.lastName} onChange={(event) => update("lastName", event.target.value)} />
            </label>
          </div>
        )}
        <label>
          Your Email
          <input type="email" value={form.email} onChange={(event) => update("email", event.target.value)} required />
        </label>
        {mode !== "forgot" && (
          <label>
            Password
            <span className="password-field">
              <input
                type={showPassword ? "text" : "password"}
                value={form.password}
                onChange={(event) => update("password", event.target.value)}
                required
                minLength={8}
              />
              <button type="button" onClick={() => setShowPassword(!showPassword)} aria-label="Toggle password">
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </span>
          </label>
        )}
        {mode === "signup" && (
          <label>
            Re-enter Password
            <input
              type="password"
              value={form.confirmPassword}
              onChange={(event) => update("confirmPassword", event.target.value)}
              required
            />
          </label>
        )}
        <PrimaryButton type="submit" disabled={loading}>
          {loading ? <Loader2 className="spin" size={18} /> : mode === "forgot" ? "Send Reset Link" : mode === "login" ? "Login" : "Sign up"}
        </PrimaryButton>
      </form>
      <button className="text-link" onClick={() => setMode(mode === "forgot" ? "login" : "forgot")}>
        {mode === "forgot" ? "Remembered your password?" : "Forgot password?"}
      </button>
    </section>
  );
}

function BodyMetricsScreen({
  user,
  loadProfile,
  navigate,
  showToast,
  setMetricPicker,
}: {
  user: User | null;
  profile: Profile | null;
  loadProfile: (user?: User | null) => Promise<Profile | null>;
  navigate: (screen: AppScreen) => void;
  showToast: (message: string) => void;
  setMetricPicker: (picker: MetricPickerState) => void;
}) {
  const [height, setHeight] = useState(173);
  const [weight, setWeight] = useState(70);
  const [heightUnit, setHeightUnit] = useState("cm");
  const [weightUnit, setWeightUnit] = useState("kg");
  const [metricStep, setMetricStep] = useState<"height" | "weight" | "goal" | "activity" | "done">("height");
  const [fitnessGoal, setFitnessGoal] = useState("Build muscle");
  const [activityLevel, setActivityLevel] = useState("Active");
  const [saving, setSaving] = useState(false);
  const displayHeight = (value: number) => {
    if (heightUnit === "cm") return `${value} cm`;
    const totalInches = Math.round(value / 2.54);
    return `${Math.floor(totalInches / 12)} ft ${totalInches % 12} in`;
  };

  const openMetricPicker = (metric: "height" | "weight") => {
    setMetricPicker({
      metric,
      value: metric === "height" ? height : weight,
      unit: metric === "height" ? heightUnit : weightUnit,
      onSave: (value, unit) => {
        if (metric === "height") {
          setHeight(value);
          setHeightUnit(unit);
          setMetricStep("weight");
        } else {
          setWeight(value);
          setWeightUnit(unit);
          setMetricStep("goal");
        }
      },
    });
  };
  const displayWeight = (value: number) =>
    weightUnit === "kg" ? `${value} kg` : `${Math.round(value * 2.20462)} lb`;

  const save = async () => {
    if (!user) return;
    setSaving(true);
    try {
      const bmi = calculateBmi(height, weight);
      const { error } = await supabase
        .from("user_profiles")
        .update({
          height_cm: height,
          weight_kg: weight,
          height_unit: heightUnit,
          weight_unit: weightUnit,
          bmi,
          onboarding_completed: true,
        })
        .eq("id", user.id);
      if (error) throw error;
      await loadProfile(user);
      navigate("home");
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Could not save body metrics.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="screen-pad metric-flow">
      <div className="brand-center"><span className="brand-mark"><Flame size={22} /></span><strong>ZENTRA</strong></div>
      <div>
        <h1 className="page-title">Let's build your plan</h1>
        <p className="center-subtitle">A few quick answers. One step at a time.</p>
      </div>
      <div className="metric-progress">
        {(["height", "weight", "goal", "activity", "done"] as const).map((step) => (
          <span className={metricStep === step ? "active" : ["height", "weight", "goal", "activity", "done"].indexOf(metricStep) > ["height", "weight", "goal", "activity", "done"].indexOf(step) ? "done" : ""} key={step}>
            {step[0].toUpperCase() + step.slice(1)}
          </span>
        ))}
      </div>
      {metricStep === "height" ? (
        <div className="metric-card metric-picker-card">
          <h2>What's your height?</h2>
          <p>We use this to calculate your daily targets.</p>
          <strong className="picker-value">{displayHeight(height)}</strong>
          <PrimaryButton onClick={() => openMetricPicker("height")}>Select Height</PrimaryButton>
        </div>
      ) : metricStep === "weight" ? (
        <div className="metric-card metric-picker-card">
          <h2>Almost there!</h2>
          <p>Updated weekly to keep your plan accurate.</p>
          <strong className="picker-value">{displayWeight(weight)}</strong>
          <div className="form-row">
            <button className="secondary-button" onClick={() => setMetricStep("height")}>Back</button>
            <PrimaryButton onClick={() => openMetricPicker("weight")}>Select Weight</PrimaryButton>
          </div>
        </div>
      ) : metricStep === "goal" ? (
        <div className="metric-card metric-picker-card">
          <h2>Your fitness goal</h2>
          <p>Pick the one that matters most right now.</p>
          <div className="option-grid">
            {["Lose fat", "Build muscle", "Improve endurance", "Maintain"].map((option) => (
              <button className={fitnessGoal === option ? "option-card selected" : "option-card"} key={option} onClick={() => setFitnessGoal(option)}>
                {option}
              </button>
            ))}
          </div>
          <div className="form-row">
            <button className="secondary-button" onClick={() => setMetricStep("weight")}>Back</button>
            <PrimaryButton onClick={() => setMetricStep("activity")}>Continue</PrimaryButton>
          </div>
        </div>
      ) : metricStep === "activity" ? (
        <div className="metric-card metric-picker-card">
          <h2>Activity level</h2>
          <p>How active is your typical week?</p>
          <div className="option-list">
            {["Sedentary", "Lightly active", "Active", "Very active"].map((option) => (
              <button className={activityLevel === option ? "option-card selected" : "option-card"} key={option} onClick={() => setActivityLevel(option)}>
                {option}
              </button>
            ))}
          </div>
          <div className="form-row">
            <button className="secondary-button" onClick={() => setMetricStep("goal")}>Back</button>
            <PrimaryButton onClick={() => setMetricStep("done")}>Continue</PrimaryButton>
          </div>
        </div>
      ) : (
        <div className="metric-card metric-picker-card done-card">
          <span className="done-icon"><Check size={42} /></span>
          <h2>You're all set</h2>
          <p>Your personalized plan is ready. Let's go.</p>
          <PrimaryButton onClick={save} disabled={saving}>{saving ? "Saving..." : "Enter Zentra"}</PrimaryButton>
        </div>
      )}
    </section>
  );
}

function HomeScreen({
  profile,
  navigate,
}: {
  user: User | null;
  profile: Profile | null;
  navigate: (screen: AppScreen) => void;
}) {
  const actions = [
    { icon: CheckCircle, title: "Form Correction", screen: "formCorrection" as AppScreen },
    { icon: ChefHat, title: "Meal Plan", screen: "mealPlan" as AppScreen },
    { icon: MessageCircle, title: "Zentra AI", screen: "ai" as AppScreen },
    { icon: BarChart3, title: "Workout Log", screen: "logs" as AppScreen },
  ];

  return (
    <section className="screen-pad with-tabs">
      <button className="home-logo" onClick={() => navigate("home")}>
        <span className="home-logo-circle"><img src={zentraLogo} alt="" /></span>
        <span>ZENTRA</span>
      </button>
      <div className="dashboard-header">
        <div>
          <h1>Welcome Back!</h1>
          {profile?.first_name && <h2>{profile.first_name}</h2>}
          {(profile?.bmi || calculateBmi(profile?.height_cm, profile?.weight_kg)) && (
            <small>BMI {profile?.bmi ?? calculateBmi(profile?.height_cm, profile?.weight_kg)} · {bmiCategory(profile?.bmi ?? calculateBmi(profile?.height_cm, profile?.weight_kg))}</small>
          )}
          <p>
            {new Date().toLocaleDateString("en-US", {
              weekday: "long",
              month: "long",
              day: "numeric",
            })}
          </p>
        </div>
        <button className="avatar-button" onClick={() => navigate("profile")}>
          {profile?.avatar_url ? <img src={profile.avatar_url} alt="" /> : (profile?.first_name?.[0] ?? "U")}
        </button>
      </div>

      <h3 className="section-title">Quick Actions</h3>
      <div className="quick-grid">
        {actions.map((action) => {
          const Icon = action.icon;
          return (
            <button className="quick-card" key={action.title} onClick={() => navigate(action.screen)}>
              <Icon size={32} />
              <span>{action.title}</span>
            </button>
          );
        })}
      </div>

      <div className="utility-list">
        <button className="utility-card" onClick={() => navigate("history")}>
          <History size={28} />
          <span>
            <strong>Histories</strong>
            <small>Logs, meals, and steps history</small>
          </span>
        </button>
        <button className="utility-card" onClick={() => navigate("steps")}>
          <Footprints size={28} />
          <span>
            <strong>Step Counter</strong>
            <small>Track your daily steps</small>
          </span>
        </button>
        <button className="utility-card" onClick={() => navigate("blogs")}>
          <Newspaper size={28} />
          <span>
            <strong>Blogs</strong>
            <small>Stay updated with trends</small>
          </span>
        </button>
      </div>
    </section>
  );
}

function LogsScreen({
  user,
  navigate,
  showToast,
  openLogsHistory,
}: {
  user: User | null;
  navigate: (screen: AppScreen) => void;
  showToast: (message: string) => void;
  openLogsHistory: (backTo: AppScreen) => void;
}) {
  const [selectedDate, setSelectedDate] = useState(todayKey());
  const [exercises, setExercises] = useState<ExerciseLog[]>([]);
  const [draft, setDraft] = useState({ name: "", weight: "", reps: "", sets: "1", equipment: "Dumbbell" });
  const [loading, setLoading] = useState(false);
  const plannedSets = exercises.reduce((sum, exercise) => sum + exercise.sets.length, 0);
  const completedSets = exercises.reduce((sum, exercise) => sum + exercise.sets.filter((set) => set.logged).length, 0);
  const volume = exercises.reduce(
    (sum, exercise) =>
      sum + exercise.sets.filter((set) => set.logged).reduce((setSum, set) => setSum + Number(set.weight) * Number(set.reps), 0),
    0,
  );

  const load = async () => {
    if (!user) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("user_logs_history")
      .select("*")
      .eq("user_id", user.id)
      .eq("month", selectedDate.slice(0, 7));
    if (error) showToast(error.message);
    const next = (data ?? [])
      .map((row: any) => {
        const sets = Array.isArray(row.sets)
          ? row.sets.filter((set: WorkoutSet) => (set.date ?? set.timestamp?.slice(0, 10)) === selectedDate)
          : [];
        return { id: row.id, name: row.exercise_name, equipment: row.muscle_group, sets };
      })
      .filter((item) => item.sets.length);
    setExercises(next);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, [selectedDate, user?.id]);

  const persist = async (exercise: ExerciseLog) => {
    if (!user) return;
    const { data: existing } = await supabase
      .from("user_logs_history")
      .select("sets")
      .eq("user_id", user.id)
      .eq("month", selectedDate.slice(0, 7))
      .eq("exercise_name", exercise.name)
      .maybeSingle();
    const oldSets = Array.isArray(existing?.sets) ? existing.sets : [];
    const otherSets = oldSets.filter((set: WorkoutSet) => (set.date ?? set.timestamp?.slice(0, 10)) !== selectedDate);
    const { error } = await supabase.from("user_logs_history").upsert(
      {
        user_id: user.id,
        month: selectedDate.slice(0, 7),
        exercise_name: exercise.name,
        muscle_group: exercise.equipment,
        sets: [...otherSets, ...exercise.sets],
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id,month,exercise_name" },
    );
    if (error) throw error;
  };

  const addWorkout = async () => {
    if (!draft.name || !draft.weight || !draft.reps) return showToast("Please fill in all workout fields.");
    const count = Math.max(1, Number(draft.sets) || 1);
    const newSets = Array.from({ length: count }).map(() => ({
      id: crypto.randomUUID(),
      weight: Number(draft.weight),
      reps: Number(draft.reps),
      logged: false,
      date: selectedDate,
      timestamp: new Date().toISOString(),
      equipment: draft.equipment,
    }));
    const existing = exercises.find((item) => item.name.toLowerCase() === draft.name.toLowerCase());
    const updated = existing
      ? { ...existing, sets: [...existing.sets, ...newSets] }
      : { name: draft.name, equipment: draft.equipment, sets: newSets };
    setExercises((prev) => (existing ? prev.map((item) => (item.name === existing.name ? updated : item)) : [...prev, updated]));
    await persist(updated);
    setDraft({ name: "", weight: "", reps: "", sets: "", equipment: "Dumbbell" });
  };

  const toggleSet = async (exercise: ExerciseLog, setId: string) => {
    const updated = {
      ...exercise,
      sets: exercise.sets.map((set) => (set.id === setId ? { ...set, logged: !set.logged } : set)),
    };
    setExercises((prev) => prev.map((item) => (item.name === exercise.name ? updated : item)));
    await persist(updated);
  };

  const deleteExercise = async (exercise: ExerciseLog) => {
    if (!user) return;
    const { data: existing } = await supabase
      .from("user_logs_history")
      .select("sets")
      .eq("user_id", user.id)
      .eq("month", selectedDate.slice(0, 7))
      .eq("exercise_name", exercise.name)
      .maybeSingle();
    const oldSets = Array.isArray(existing?.sets) ? existing.sets : [];
    const remainingSets = oldSets.filter((set: WorkoutSet) => (set.date ?? set.timestamp?.slice(0, 10)) !== selectedDate);
    const request = remainingSets.length
      ? supabase.from("user_logs_history").update({ sets: remainingSets, updated_at: new Date().toISOString() }).eq("user_id", user.id).eq("month", selectedDate.slice(0, 7)).eq("exercise_name", exercise.name)
      : supabase.from("user_logs_history").delete().eq("user_id", user.id).eq("month", selectedDate.slice(0, 7)).eq("exercise_name", exercise.name);
    const { error } = await request;
    if (error) return showToast(error.message);
    setExercises((prev) => prev.filter((item) => item.name !== exercise.name));
    showToast("Saved workout log deleted.");
  };

  return (
    <section className="screen-pad with-tabs">
      <ScreenHeader title="Workout Log" subtitle="Log your weights to keep progressing!" onLogo={() => navigate("home")} action={<button className="text-link" onClick={() => openLogsHistory("logs")}>History</button>} />
      <div className="date-selector-web">
        <input className="date-input" type="date" value={selectedDate} onChange={(event) => setSelectedDate(event.target.value)} />
      </div>
      <div className="log-summary-strip">
        <Stat icon={CheckSquare} value={`${completedSets}/${plannedSets}`} label="Sets" />
        <Stat icon={TrendingUp} value={volume.toLocaleString()} label="Volume" />
        <Stat icon={Dumbbell} value={exercises.length} label="Exercises" />
      </div>
      <div className="workout-add-card">
        <h3>Add Workout</h3>
        <input placeholder="Exercise Name" value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} />
        <div className="form-row">
          <input placeholder="Weight (kg)" type="number" value={draft.weight} onChange={(event) => setDraft({ ...draft, weight: event.target.value })} />
          <input placeholder="Reps" type="number" value={draft.reps} onChange={(event) => setDraft({ ...draft, reps: event.target.value })} />
        </div>
        <div className="form-row">
          <input placeholder="Sets" type="number" value={draft.sets} onChange={(event) => setDraft({ ...draft, sets: event.target.value })} />
          <select value={draft.equipment} onChange={(event) => setDraft({ ...draft, equipment: event.target.value })}>
            {["Dumbbell", "Barbell", "Cable", "Machine", "Bodyweight"].map((item) => <option key={item}>{item}</option>)}
          </select>
        </div>
        <PrimaryButton onClick={addWorkout}>Add a workout +</PrimaryButton>
      </div>
      {loading ? <p className="empty-text">Loading workout logs...</p> : exercises.length === 0 ? <EmptyState title="No workout logs for this day" body="Add a workout to log your first set." /> : null}
      <div className="exercise-list">
        {exercises.map((exercise) => (
          <article className="exercise-card" key={exercise.name}>
            <div className="exercise-header">
              <span>
                <h3>{exercise.name}</h3>
                <p>{exercise.equipment}</p>
              </span>
              <span className="exercise-actions">
                <strong>{exercise.sets.filter((set) => set.logged).length}/{exercise.sets.length} sets</strong>
                <button className="icon-button danger-icon" onClick={() => deleteExercise(exercise)} aria-label="Delete saved log"><Trash2 size={18} /></button>
              </span>
            </div>
            <div className="set-table">
              <b>WEIGHT</b><b>REPS</b><b>LOG</b>
              {exercise.sets.map((set) => (
                <div className="set-row" key={set.id}>
                  <span>{set.weight} kg</span>
                  <span>{set.reps}</span>
                  <button className={set.logged ? "check-button checked" : "check-button"} onClick={() => toggleSet(exercise, set.id)}>
                    {set.logged && <Check size={18} />}
                  </button>
                </div>
              ))}
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

function AiScreen({ navigate, profile }: { navigate: (screen: AppScreen) => void; profile: Profile | null }) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [typing, setTyping] = useState(false);

  const send = async () => {
    if (!input.trim()) return;
    const text = input.trim();
    setInput("");
    setMessages((prev) => [...prev, { id: crypto.randomUUID(), role: "user", content: text, timestamp: new Date() }]);
    setTyping(true);
    try {
      const answer = await askZentra(text);
      setMessages((prev) => [...prev, { id: crypto.randomUUID(), role: "assistant", content: answer.answer, timestamp: new Date() }]);
    } catch (error) {
      setMessages((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          role: "assistant",
          content: error instanceof Error ? error.message : "Unable to reach Zentra AI right now.",
          timestamp: new Date(),
        },
      ]);
    } finally {
      setTyping(false);
    }
  };

  return (
    <section className="chat-screen with-tabs">
      <ScreenHeader title="Zentra AI" subtitle="Your personal fitness & nutrition coach" onBack={() => navigate("home")} onLogo={() => navigate("home")} action={<span className="ai-head-icon"><Sparkles size={20} /></span>} />
      <div className="messages">
        {messages.length === 0 && (
          <div className="ai-empty">
            <div className="message assistant"><p>Hi {profile?.first_name ?? "there"}, I'm Zentra AI. Ask me anything about training, nutrition, or recovery.</p></div>
            <div className="suggestion-chips">
              {["Create a fat loss plan", "Explain protein intake", "Improve my workout routine", "Give me nutrition advice"].map((chip) => (
                <button key={chip} onClick={() => setInput(chip)}>{chip}</button>
              ))}
            </div>
          </div>
        )}
        {messages.map((message) => (
          <div className={`message ${message.role}`} key={message.id}>
            <p>{message.content}</p>
            <small>{message.timestamp.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}</small>
          </div>
        ))}
        {typing && <div className="message assistant">...</div>}
      </div>
      <div className="chat-input">
        <input value={input} onChange={(event) => setInput(event.target.value)} placeholder="Ask Zentra anything..." onKeyDown={(event) => event.key === "Enter" && send()} />
        <button onClick={send} disabled={!input.trim()} aria-label="Send">
          <Send size={20} />
        </button>
      </div>
    </section>
  );
}

function HistoryScreen({
  navigate,
  openLogsHistory,
  openStepsHistory,
  openMealHistory,
}: {
  navigate: (screen: AppScreen) => void;
  openLogsHistory: (backTo: AppScreen) => void;
  openStepsHistory: (backTo: AppScreen) => void;
  openMealHistory: (backTo: AppScreen) => void;
}) {
  const options = [
    { icon: BarChart3, title: "Logs History", subtitle: "View your workout history", screen: "logsHistory" as AppScreen },
    { icon: UtensilsCrossed, title: "Meal History", subtitle: "View your saved meal plans", screen: "mealHistory" as AppScreen },
    { icon: Footprints, title: "Steps History", subtitle: "View your step tracking history", screen: "stepsHistory" as AppScreen },
  ];
  return (
    <section className="screen-pad with-tabs">
      <h1 className="center-title">History</h1>
      <p className="center-subtitle">Track your fitness journey</p>
      <div className="history-options">
        {options.map((option) => {
          const Icon = option.icon;
          return (
            <button
              className="history-card"
              onClick={() =>
                option.screen === "logsHistory"
                  ? openLogsHistory("history")
                  : option.screen === "stepsHistory"
                    ? openStepsHistory("history")
                    : openMealHistory("history")
              }
              key={option.title}
            >
              <span><Icon size={32} /></span>
              <strong>{option.title}</strong>
              <small>{option.subtitle}</small>
            </button>
          );
        })}
      </div>
    </section>
  );
}

function ProfileScreen({
  user,
  profile,
  loadProfile,
  navigate,
  showToast,
  setMetricPicker,
}: {
  user: User | null;
  profile: Profile | null;
  loadProfile: (user?: User | null) => Promise<Profile | null>;
  navigate: (screen: AppScreen) => void;
  showToast: (message: string) => void;
  setMetricPicker: (picker: MetricPickerState) => void;
}) {
  const bmi = profile?.bmi ?? calculateBmi(profile?.height_cm, profile?.weight_kg);
  const updateProfile = async (patch: Partial<Profile>) => {
    if (!user) return;
    const nextHeight = patch.height_cm ?? profile?.height_cm;
    const nextWeight = patch.weight_kg ?? profile?.weight_kg;
    const nextPatch = { ...patch, bmi: calculateBmi(nextHeight, nextWeight), onboarding_completed: true };
    const { error } = await supabase.from("user_profiles").update(nextPatch).eq("id", user.id);
    if (error) return showToast(error.message);
    await loadProfile(user);
  };

  const uploadAvatar = async (file?: File) => {
    if (!file || !user) return;
    const path = `${user.id}/avatar-${Date.now()}-${file.name}`;
    const { error } = await supabase.storage.from("avatars").upload(path, file, {
      upsert: true,
      cacheControl: "3600",
      contentType: file.type || "image/jpeg",
    });
    if (error) return showToast(error.message);
    const { data } = supabase.storage.from("avatars").getPublicUrl(path);
    await updateProfile({ avatar_url: data.publicUrl });
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    navigate("auth");
  };

  const openProfileMetricPicker = (metric: "height" | "weight") => {
    setMetricPicker({
      metric,
      value: metric === "height" ? profile?.height_cm ?? 170 : profile?.weight_kg ?? 70,
      unit: metric === "height" ? profile?.height_unit ?? "cm" : profile?.weight_unit ?? "kg",
      onSave: async (value, unit) => {
        if (metric === "height") await updateProfile({ height_cm: value, height_unit: unit });
        else await updateProfile({ weight_kg: value, weight_unit: unit });
      },
    });
  };

  return (
    <section className="screen-pad with-tabs">
      <div className="profile-head">
        <label className="profile-avatar">
          {profile?.avatar_url ? <img src={profile.avatar_url} alt="" /> : <UserIcon size={48} />}
          <span><Camera size={16} /></span>
          <input type="file" accept="image/*" onChange={(event) => uploadAvatar(event.target.files?.[0])} />
        </label>
        <small>Tap to update photo</small>
        <h1>{profile?.first_name} {profile?.last_name}</h1>
        {bmi && <p><strong>BMI: {bmi}</strong> {bmiCategory(bmi)}</p>}
      </div>
      <div className="settings-list">
        <button className="setting-item metric-setting-button" onClick={() => openProfileMetricPicker("height")}>
          <span><strong>Height</strong><small>{formatHeightValue(profile?.height_cm ?? 170, profile?.height_unit ?? "cm")}</small></span>
          <ChevronRight size={20} />
        </button>
        <button className="setting-item metric-setting-button" onClick={() => openProfileMetricPicker("weight")}>
          <span><strong>Weight</strong><small>{formatWeightValue(profile?.weight_kg ?? 70, profile?.weight_unit ?? "kg")}</small></span>
          <ChevronRight size={20} />
        </button>
        <EditableSetting label="Daily Steps Goal" value={profile?.steps_goal ?? 8000} suffix="steps" onSave={(value) => updateProfile({ steps_goal: value })} />
      </div>
      <button className="signout-button" onClick={signOut}><LogOut size={20} /> Sign Out</button>
    </section>
  );
}

function EditableSetting({
  label,
  value,
  suffix,
  onSave,
}: {
  label: string;
  value: number;
  suffix: string;
  onSave: (value: number) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  return (
    <div className="setting-item">
      <span>
        <strong>{label}</strong>
        {editing ? (
          <input type="number" value={draft} onChange={(event) => setDraft(Number(event.target.value))} />
        ) : (
          <small>{value?.toLocaleString()} {suffix}</small>
        )}
      </span>
      <button onClick={() => {
        if (editing) onSave(draft);
        setEditing(!editing);
      }}>{editing ? "Save" : <ChevronRight size={20} />}</button>
    </div>
  );
}

function StepsScreen({
  user,
  profile,
  navigate,
  showToast,
  openStepsHistory,
}: {
  user: User | null;
  profile: Profile | null;
  navigate: (screen: AppScreen) => void;
  showToast: (message: string) => void;
  openStepsHistory: (backTo: AppScreen) => void;
}) {
  const [steps, setSteps] = useState(0);
  const [tracking, setTracking] = useState(false);
  const [motionStatus, setMotionStatus] = useState("Browser motion tracking is idle.");
  const lastPeakRef = useRef(0);
  const filteredMagnitudeRef = useRef(9.8);
  const belowThresholdRef = useRef(true);
  const goal = profile?.steps_goal ?? 8000;
  const kcal = steps * 0.04;
  const distance = Number((steps * 0.0008).toFixed(3));
  const minutes = Math.floor(steps / 120);
  const progress = Math.min((steps / goal) * 100, 100);

  const save = async (nextSteps: number) => {
    if (!user) return;
    const payload = {
      user_id: user.id,
      date: todayKey(),
      steps: nextSteps,
      goal,
      kcal: nextSteps * 0.04,
      distance_km: Number((nextSteps * 0.0008).toFixed(3)),
      active_minutes: Math.floor(nextSteps / 120),
    };
    const { error } = await supabase.from("step_tracking").upsert(payload, { onConflict: "user_id,date" });
    if (error) showToast(error.message);
  };

  useEffect(() => {
    if (!user) return;
    supabase
      .from("step_tracking")
      .select("steps")
      .eq("user_id", user.id)
      .eq("date", todayKey())
      .maybeSingle()
      .then(({ data }) => setSteps(Number(data?.steps ?? 0)));
  }, [user?.id]);

  const addSteps = (amount: number) => {
    const next = Math.max(0, steps + amount);
    setSteps(next);
    void save(next);
  };

  const handleMotion = (event: DeviceMotionEvent) => {
    const source = event.accelerationIncludingGravity ?? event.acceleration;
    if (!source) return;
    const x = source.x ?? 0;
    const y = source.y ?? 0;
    const z = source.z ?? 0;
    const magnitude = Math.sqrt(x * x + y * y + z * z);
    filteredMagnitudeRef.current = filteredMagnitudeRef.current * 0.72 + magnitude * 0.28;
    const value = filteredMagnitudeRef.current;
    const now = Date.now();
    if (value < 10.8) belowThresholdRef.current = true;
    if (belowThresholdRef.current && value > 12.4 && now - lastPeakRef.current > 380) {
      lastPeakRef.current = now;
      belowThresholdRef.current = false;
      setSteps((current) => {
        const next = current + 1;
        void save(next);
        return next;
      });
    }
  };

  const startMotionTracking = async () => {
    if (!("DeviceMotionEvent" in window)) {
      showToast("This browser does not expose motion sensors.");
      return;
    }
    try {
      const motionEvent = DeviceMotionEvent as typeof DeviceMotionEvent & {
        requestPermission?: () => Promise<"granted" | "denied">;
      };
      if (typeof motionEvent.requestPermission === "function") {
        const permission = await motionEvent.requestPermission();
        if (permission !== "granted") {
          showToast("Motion permission was not granted.");
          return;
        }
      }
      window.addEventListener("devicemotion", handleMotion);
      setTracking(true);
      setMotionStatus("Listening to phone motion. Keep this page open while walking.");
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Could not start motion tracking.");
    }
  };

  const stopMotionTracking = () => {
    window.removeEventListener("devicemotion", handleMotion);
    setTracking(false);
    setMotionStatus("Motion tracking paused.");
  };

  useEffect(() => () => window.removeEventListener("devicemotion", handleMotion), []);

  return (
    <section className="screen-pad with-tabs">
      <ScreenHeader title="Step Counter" onBack={() => navigate("home")} onLogo={() => navigate("home")} />
      <div className="date-row"><strong>Today</strong><small>{new Date().toLocaleDateString()}</small></div>
      <div className="progress-ring" style={{ "--progress": `${progress * 3.6}deg` } as React.CSSProperties}>
        <div><strong>{steps}</strong><span>of {goal}</span><em>{Math.round(progress)}%</em></div>
      </div>
      <div className="stats-grid">
        <Stat icon={Flame} value={kcal.toFixed(1)} label="Kcal" />
        <Stat icon={Footprints} value={distance} label="Kilometers" />
        <Stat icon={Activity} value={minutes} label="Minutes" />
      </div>
      <div className="motion-card">
        <div>
          <strong>{tracking ? "Motion tracking active" : "Browser step detection"}</strong>
          <small>{motionStatus}</small>
        </div>
        <button className={tracking ? "secondary-button compact-button" : "primary-inline"} onClick={tracking ? stopMotionTracking : startMotionTracking}>
          {tracking ? <Pause size={18} /> : <Play size={18} />}
          {tracking ? "Pause" : "Start"}
        </button>
      </div>
      <div className="step-actions">
        <button onClick={() => addSteps(100)}>+100</button>
        <button onClick={() => addSteps(1000)}>+1,000</button>
        <button onClick={() => addSteps(-100)}>−100</button>
      </div>
      <PrimaryButton onClick={() => openStepsHistory("steps")}>Steps History</PrimaryButton>
    </section>
  );
}

function Stat({ icon: Icon, value, label }: { icon: typeof Flame; value: React.ReactNode; label: string }) {
  return <div className="stat-card"><Icon size={24} /><strong>{value}</strong><small>{label}</small></div>;
}

function MealPlanScreen({
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

function WeeklyMealPlanScreen({
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

function MealRecipeScreen({
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
      <ScreenHeader title="Recipe" subtitle={selectedMealRecipe ? `Day ${selectedMealRecipe.dayKey.replace("day", "")} · ${selectedMealRecipe.mealKey}` : undefined} onBack={() => navigate("mealWeekly")} onLogo={() => navigate("home")} />
      {!meal ? <EmptyState title="No meal selected" body="Open a meal from the meal plan first." /> : (
        <article className="recipe-card recipe-detail-card">
          <span className="category-pill">{selectedMealRecipe?.mealKey}</span>
          <h3>{recipe?.meal_name ?? meal.food}</h3>
          <small>{meal.portion} · {Math.round(meal.macros.energy_kcal)} cal</small>
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

function DailyRecipesScreen({
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
                <span className="category-pill">{time} · {mealKey}</span>
                <h3>{recipe?.meal_name ?? meal.food}</h3>
                <small>{meal.portion} · {Math.round(meal.macros.energy_kcal)} cal</small>
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

function MealShoppingScreen({
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
  { name: "Chest", exercises: 8, icon: Shirt },
  { name: "Back", exercises: 10, icon: Activity },
  { name: "Shoulders", exercises: 7, icon: Dumbbell },
  { name: "Legs", exercises: 12, icon: Footprints },
  { name: "Triceps", exercises: 6, icon: Dumbbell },
  { name: "Biceps", exercises: 6, icon: BicepsFlexed },
];

const exercisesByGroup: Record<string, string[]> = {
  Chest: ["Bench Press", "Push-ups", "Dumbbell Flyes", "Cable Crossover", "Incline Press"],
  Back: ["Pull-ups", "Bent Over Rows", "Lat Pulldown", "Deadlift", "Cable Rows"],
  Shoulders: ["Overhead Press", "Lateral Raises", "Front Raises", "Arnold Press", "Shrugs"],
  Legs: ["Squats", "Lunges", "Leg Press", "Leg Curls", "Calf Raises"],
  Triceps: ["Tricep Dips", "Skull Crushers", "Overhead Extension", "Cable Pushdown"],
  Biceps: ["Bicep Curl", "Hammer Curl", "Preacher Curl", "Concentration Curl"],
};

function FormCorrectionScreen({
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

function FormExercisesScreen({
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

function FormLiveScreen({
  group,
  exercise,
  navigate,
  showToast,
}: {
  group: string;
  exercise: string;
  navigate: (screen: AppScreen) => void;
  showToast: (message: string) => void;
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const socketRef = useRef<WebSocket | null>(null);
  const frameTimerRef = useRef<number | null>(null);
  const recordingTimerRef = useRef<number | null>(null);
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
  const modelConfig =
    group === "Biceps" && exercise === "Bicep Curl"
      ? { slug: "bicep-curl", label: "bicep curl", load: loadBicepCurlModel }
        : null;
  const supportsInference = Boolean(modelConfig);

  const stopLive = () => {
    if (frameTimerRef.current) window.clearInterval(frameTimerRef.current);
    if (recordingTimerRef.current) window.clearInterval(recordingTimerRef.current);
    socketRef.current?.close();
    streamRef.current?.getTracks().forEach((track) => track.stop());
    frameTimerRef.current = null;
    recordingTimerRef.current = null;
    socketRef.current = null;
    streamRef.current = null;
    setStreaming(false);
    setCameraActive(false);
    setStatus("Webcam stopped");
  };

  useEffect(() => stopLive, []);

  useEffect(() => {
    setElapsedSeconds(0);
    setStats({ correct: 0, incorrect: 0, angle: 0, feedback: "Stand fully visible in the webcam frame." });
    setStatus("Webcam idle");
  }, [group, exercise]);

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
      showToast("Live AI correction is currently wired for Bicep Curl. This exercise opens webcam preview only.");
      return;
    }

    if (!cameraActive) {
      const started = await startCamera();
      if (!started) return;
    }

    try {
      setElapsedSeconds(0);
      setStats({ correct: 0, incorrect: 0, angle: 0, feedback: "Stand fully visible in the webcam frame." });
      setStatus(`Loading ${modelConfig.label} model...`);
      await modelConfig.load();
      const url = `${MODEL_GATEWAY_API_BASE_URL.replace(/^http/, "ws")}/api/v1/${modelConfig.slug}/ws`;
      const socket = new WebSocket(url);
      socketRef.current = socket;
      socket.onopen = () => {
        setStreaming(true);
        setStatus("AI correction streaming");
        if (recordingTimerRef.current) window.clearInterval(recordingTimerRef.current);
        recordingTimerRef.current = window.setInterval(() => setElapsedSeconds((current) => current + 1), 1000);
        frameTimerRef.current = window.setInterval(captureFrame, 220);
      };
      socket.onmessage = (event) => {
        const payload = JSON.parse(event.data);
        if (payload.type === "session_started") {
          setStatus(`${modelConfig.label} session ready`);
          return;
        }
        if (payload.type === "error") {
          setStatus("AI correction paused");
          setStats((current) => ({ ...current, feedback: String(payload.message ?? "Inference error") }));
          return;
        }
        if (payload.type === "frame_result") {
          setStats({
            correct: Number(payload.correct_reps ?? payload.correct ?? 0),
            incorrect: Number(payload.incorrect_reps ?? payload.incorrect ?? 0),
            angle: Math.round(Number(payload.angle ?? 0)),
            feedback: String(payload.feedback ?? payload.prediction?.reason ?? payload.prediction?.label ?? payload.status ?? "Keep moving."),
          });
        }
      };
      socket.onerror = () => showToast("Model gateway WebSocket is offline.");
      socket.onclose = () => {
        if (frameTimerRef.current) window.clearInterval(frameTimerRef.current);
        if (recordingTimerRef.current) window.clearInterval(recordingTimerRef.current);
        frameTimerRef.current = null;
        recordingTimerRef.current = null;
        setStreaming(false);
      };
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Unable to start live correction.");
      setStatus("AI correction offline");
    }
  };

  const feedbackItems = supportsInference
    ? [
        stats.feedback,
        stats.angle ? `Current angle: ${stats.angle} degrees` : "Keep your full body visible in frame.",
        "Control tempo through the full curl.",
      ]
    : ["This exercise opens webcam preview only."];

  return (
    <section className="screen-pad with-tabs live-screen">
      <ScreenHeader title={exercise} subtitle={`${group} form correction`} onBack={() => navigate("formExercises")} onLogo={() => navigate("home")} />
      <div className="live-camera">
        <div className="rec-row"><span>{streaming ? "REC" : "READY"}</span><small>{formatDuration(elapsedSeconds)}</small><b>REPS {stats.correct + stats.incorrect}</b></div>
        <video ref={videoRef} autoPlay muted playsInline />
        {!cameraActive && <div className="camera-placeholder"><Camera size={52} /><span>Webcam preview</span><small>{exercise} - Live correction</small></div>}
        <canvas ref={canvasRef} hidden />
      </div>
      <div className="live-stats">
        <Stat icon={CheckSquare} value={stats.correct} label="Correct" />
        <Stat icon={Trash2} value={stats.incorrect} label="Incorrect" />
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
        <button className="secondary-button span-all" onClick={() => navigate("formExercises")}>Switch Exercise</button>
      </div>
    </section>
  );
}

function LogsHistoryScreen({ user, navigate, showToast, backTo }: { user: User | null; navigate: (screen: AppScreen) => void; showToast: (message: string) => void; backTo: AppScreen }) {
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

function MealHistoryScreen({ user, navigate, showToast, backTo = "history" }: { user: User | null; navigate: (screen: AppScreen) => void; showToast: (message: string) => void; backTo?: AppScreen }) {
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
                <small>{data.culinary_preference ?? "Any"} · {data.dietary_preference ?? "None"}</small>
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

function StepsHistoryScreen({ user, navigate, showToast, backTo }: { user: User | null; navigate: (screen: AppScreen) => void; showToast: (message: string) => void; backTo: AppScreen }) {
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

function HistoryList({ title, navigate, empty, children, backTo = "history" }: { title: string; navigate: (screen: AppScreen) => void; empty: string; children: React.ReactNode; backTo?: AppScreen }) {
  const hasItems = Array.isArray(children) ? children.length > 0 : Boolean(children);
  return <section className="screen-pad with-tabs"><ScreenHeader title={title} onBack={() => navigate(backTo)} onLogo={() => navigate("home")} />{hasItems ? <div className="list-stack">{children}</div> : <EmptyState title={empty} />}</section>;
}

function stripBlogHtml(value = "") {
  const parser = new DOMParser();
  const document = parser.parseFromString(value, "text/html");
  return document.body.textContent?.replace(/\s+/g, " ").trim() ?? "";
}

function BlogsScreen({ navigate, showToast, selectBlog }: { navigate: (screen: AppScreen) => void; showToast: (message: string) => void; selectBlog: (blog: BlogPost) => void }) {
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
                <small>{post.read_time_min} min read · {formatDate(post.published_at)}</small>
              </div>
            </button>
          );
        })}
      </div>
    </section>
  );
}

function BlogDetailScreen({ blog, navigate }: { blog: BlogPost | null; navigate: (screen: AppScreen) => void }) {
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
          <small>{blog.read_time_min} min read Â· {published}</small>
          <p className="blog-lead">{blog.snippet}</p>
          <div className="blog-content">
            {paragraphs.map((paragraph, index) => <p key={index}>{paragraph}</p>)}
          </div>
        </div>
      </article>
    </section>
  );
}

function EmptyState({ title, body }: { title: string; body?: string }) {
  return <div className="empty-state"><strong>{title}</strong>{body && <p>{body}</p>}</div>;
}







