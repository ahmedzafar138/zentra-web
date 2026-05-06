import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import type { Session, User } from "@supabase/supabase-js";
import {
  Activity,
  Award,
  BarChart3,
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
  Send,
  Shirt,
  Square,
  TrendingUp,
  Trash2,
  User as UserIcon,
  UtensilsCrossed,
} from "lucide-react";
import {
  DayMealPlan,
  WeeklyMealPlan,
  askZentra,
  checkAllServices,
  generateDailyMealPlan,
  generateWeeklyMealPlan,
  loadBicepCurlModel,
  MODEL_GATEWAY_API_BASE_URL,
  parseMealPlan,
  type ServiceCheck,
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
  | "mealPlan"
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
}: {
  title: string;
  subtitle?: string;
  onBack?: () => void;
  action?: React.ReactNode;
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
        <h1>{title}</h1>
        {subtitle && <p>{subtitle}</p>}
      </div>
      {action ?? <span className="header-spacer" />}
    </header>
  );
}

function TabBar({ active, navigate }: { active: Tab; navigate: (screen: AppScreen) => void }) {
  const items: { id: Tab; label: string; screen: AppScreen; icon: typeof Home }[] = [
    { id: "home", label: "Home", screen: "home", icon: Home },
    { id: "logs", label: "Logs", screen: "logs", icon: BarChart3 },
    { id: "ai", label: "", screen: "ai", icon: BotMessageSquare },
    { id: "history", label: "History", screen: "history", icon: History },
    { id: "profile", label: "Profile", screen: "profile", icon: UserIcon },
  ];

  return (
    <nav className="bottom-tabs" aria-label="Main tabs">
      {items.map((item) => {
        const Icon = item.icon;
        const isAi = item.id === "ai";
        return (
          <button
            className={`tab-button ${active === item.id ? "tab-active" : ""} ${isAi ? "ai-tab" : ""}`}
            key={item.id}
            onClick={() => navigate(item.screen)}
            type="button"
          >
            <span className={isAi ? "ai-tab-icon" : ""}>
              <Icon size={isAi ? 30 : 22} />
            </span>
            {item.label && <small>{item.label}</small>}
          </button>
        );
      })}
    </nav>
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
    await new Promise((resolve) => setTimeout(resolve, 550));
    if (!currentSession?.user) {
      setScreen("onboarding");
      return;
    }

    setUser(currentSession.user);
    const loaded = await ensureProfile(currentSession.user);
    if (loaded?.onboarding_completed && loaded.height_cm && loaded.weight_kg) {
      setScreen("home");
    } else {
      setScreen("bodyMetrics");
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
  const activeTab: Tab | null =
    screen === "home" ||
    screen === "steps" ||
    screen === "blogs" ||
    screen === "mealPlan" ||
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
  };

  const appScreens = (
    <>
      {screen === "home" && <HomeScreen {...commonProps} />}
      {screen === "logs" && <LogsScreen {...commonProps} />}
      {screen === "ai" && <AiScreen navigate={navigate} />}
      {screen === "history" && <HistoryScreen navigate={navigate} />}
      {screen === "profile" && <ProfileScreen {...commonProps} />}
      {screen === "steps" && <StepsScreen {...commonProps} />}
      {screen === "blogs" && <BlogsScreen navigate={navigate} />}
      {screen === "mealPlan" && <MealPlanScreen {...commonProps} />}
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
      {screen === "logsHistory" && <LogsHistoryScreen user={user} navigate={navigate} showToast={showToast} />}
      {screen === "mealHistory" && <MealHistoryScreen user={user} navigate={navigate} showToast={showToast} />}
      {screen === "stepsHistory" && <StepsHistoryScreen user={user} navigate={navigate} showToast={showToast} />}
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
        />
      )}
      {activeTab && <div className="app-content">{appScreens}</div>}
      {activeTab && <TabBar active={activeTab} navigate={navigate} />}
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
      <h1>Zentra</h1>
      <p>AI Fitness Trainer</p>
    </section>
  );
}

function OnboardingScreen({ navigate }: { navigate: (screen: AppScreen) => void }) {
  const data = [
    { icon: Dumbbell, title: "Zentra", description: "Ready to transform your body?", button: "Get Started" },
    { icon: CheckCircle, title: "Form correction", description: "So accurate you'll never need a trainer.", button: "Next" },
    { icon: ChefHat, title: "Smart meal plans", description: "Generate recipes at a tap, personalized by AI.", button: "Next" },
    { icon: MessageCircle, title: "Ask anything", description: "An AI-assisted coach for all your fitness questions.", button: "Next" },
    { icon: Newspaper, title: "Stay updated", description: "Expert blogs to keep up with the latest fitness trends.", button: "Next" },
    { icon: Activity, title: "Track progress", description: "Visualize your workouts and celebrate wins.", button: "Next" },
    { icon: Footprints, title: "Walk it off", description: "Built-in step counter to burn that stubborn belly fat.", button: "Let's start!" },
  ];
  const [index, setIndex] = useState(0);
  const current = data[index];
  const Icon = current.icon;

  return (
    <section className="onboarding screen-pad">
      {index < data.length - 1 && (
        <button className="skip-button" onClick={() => navigate("auth")}>
          Skip
        </button>
      )}
      <div className="onboarding-body">
        <div className="onboarding-icon">
          <Icon size={76} />
        </div>
        <h1>{current.title}</h1>
        <p>{current.description}</p>
        <div className="dots">
          {data.map((_, dotIndex) => (
            <span className={dotIndex === index ? "dot active-dot" : "dot"} key={dotIndex} />
          ))}
        </div>
      </div>
      <PrimaryButton onClick={() => (index < data.length - 1 ? setIndex(index + 1) : navigate("auth"))}>
        {current.button}
      </PrimaryButton>
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
}: {
  user: User | null;
  profile: Profile | null;
  loadProfile: (user?: User | null) => Promise<Profile | null>;
  navigate: (screen: AppScreen) => void;
  showToast: (message: string) => void;
}) {
  const [height, setHeight] = useState(173);
  const [weight, setWeight] = useState(70);
  const [heightUnit, setHeightUnit] = useState("cm");
  const [weightUnit, setWeightUnit] = useState("kg");
  const [metricStep, setMetricStep] = useState<"height" | "weight">("height");
  const [saving, setSaving] = useState(false);
  const heightOptions = useMemo(() => Array.from({ length: 101 }, (_, index) => 120 + index), []);
  const weightOptions = useMemo(() => Array.from({ length: 186 }, (_, index) => 35 + index), []);
  const displayHeight = (value: number) => {
    if (heightUnit === "cm") return `${value} cm`;
    const totalInches = Math.round(value / 2.54);
    return `${Math.floor(totalInches / 12)} ft ${totalInches % 12} in`;
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
      <div>
        <h1 className="page-title">Let's get to know you better!</h1>
        <p className="center-subtitle">Set one body metric at a time.</p>
      </div>
      <div className="metric-progress">
        <span className={metricStep === "height" ? "active" : "done"}>Height</span>
        <span className={metricStep === "weight" ? "active" : ""}>Weight</span>
      </div>
      {metricStep === "height" ? (
        <div className="metric-card metric-picker-card">
          <h2>Your Height</h2>
          <div className="segmented compact">
            <button className={heightUnit === "cm" ? "segment-active" : ""} onClick={() => setHeightUnit("cm")}>
              cm
            </button>
            <button className={heightUnit === "ft-in" ? "segment-active" : ""} onClick={() => setHeightUnit("ft-in")}>
              ft-in
            </button>
          </div>
          <strong className="picker-value">{displayHeight(height)}</strong>
          <div className="scroll-picker-web" aria-label="Height picker">
            {heightOptions.map((value) => (
              <button
                className={value === height ? "picker-option selected" : "picker-option"}
                key={value}
                onClick={() => setHeight(value)}
              >
                {displayHeight(value)}
              </button>
            ))}
          </div>
          <PrimaryButton onClick={() => setMetricStep("weight")}>Next</PrimaryButton>
        </div>
      ) : (
        <div className="metric-card metric-picker-card">
          <h2>Your Weight</h2>
          <div className="segmented compact">
            <button className={weightUnit === "kg" ? "segment-active" : ""} onClick={() => setWeightUnit("kg")}>
              kg
            </button>
            <button className={weightUnit === "lb" ? "segment-active" : ""} onClick={() => setWeightUnit("lb")}>
              lb
            </button>
          </div>
          <strong className="picker-value">{displayWeight(weight)}</strong>
          <div className="scroll-picker-web" aria-label="Weight picker">
            {weightOptions.map((value) => (
              <button
                className={value === weight ? "picker-option selected" : "picker-option"}
                key={value}
                onClick={() => setWeight(value)}
              >
                {displayWeight(value)}
              </button>
            ))}
          </div>
          <div className="form-row">
            <button className="secondary-button" onClick={() => setMetricStep("height")}>Back</button>
            <PrimaryButton onClick={save} disabled={saving}>
              {saving ? "Saving..." : "Start Zentra"}
            </PrimaryButton>
          </div>
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
      <div className="dashboard-header">
        <div>
          <h1>Welcome Back!</h1>
          {profile?.first_name && <h2>{profile.first_name}</h2>}
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
}: {
  user: User | null;
  navigate: (screen: AppScreen) => void;
  showToast: (message: string) => void;
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
    setDraft({ name: "", weight: "", reps: "", sets: "1", equipment: "Dumbbell" });
  };

  const toggleSet = async (exercise: ExerciseLog, setId: string) => {
    const updated = {
      ...exercise,
      sets: exercise.sets.map((set) => (set.id === setId ? { ...set, logged: !set.logged } : set)),
    };
    setExercises((prev) => prev.map((item) => (item.name === exercise.name ? updated : item)));
    await persist(updated);
  };

  return (
    <section className="screen-pad with-tabs">
      <ScreenHeader title="Workout Log" subtitle="Log your weights to keep progressing!" action={<button className="text-link" onClick={() => navigate("logsHistory")}>History</button>} />
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
              <strong>{exercise.sets.filter((set) => set.logged).length}/{exercise.sets.length} sets</strong>
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

function AiScreen({ navigate }: { navigate: (screen: AppScreen) => void }) {
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
      <ScreenHeader title="Zentra AI" subtitle="Got any questions? Ask away" onBack={() => navigate("home")} />
      <div className="messages">
        {messages.length === 0 && <EmptyState title="Start a conversation with Zentra AI" />}
        {messages.map((message) => (
          <div className={`message ${message.role}`} key={message.id}>
            <p>{message.content}</p>
            <small>{message.timestamp.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}</small>
          </div>
        ))}
        {typing && <div className="message assistant">...</div>}
      </div>
      <div className="chat-input">
        <textarea value={input} onChange={(event) => setInput(event.target.value)} placeholder="Type your message..." />
        <button onClick={send} disabled={!input.trim()} aria-label="Send">
          <Send size={20} />
        </button>
      </div>
    </section>
  );
}

function HistoryScreen({ navigate }: { navigate: (screen: AppScreen) => void }) {
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
            <button className="history-card" onClick={() => navigate(option.screen)} key={option.title}>
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
}: {
  user: User | null;
  profile: Profile | null;
  loadProfile: (user?: User | null) => Promise<Profile | null>;
  navigate: (screen: AppScreen) => void;
  showToast: (message: string) => void;
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
    const { error } = await supabase.storage.from("avatars").upload(path, file, { upsert: true });
    if (error) return showToast(error.message);
    const { data } = supabase.storage.from("avatars").getPublicUrl(path);
    await updateProfile({ avatar_url: data.publicUrl });
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    navigate("auth");
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
        <EditableSetting label="Height" value={profile?.height_cm ?? 170} suffix="cm" onSave={(value) => updateProfile({ height_cm: value })} />
        <EditableSetting label="Weight" value={profile?.weight_kg ?? 70} suffix="kg" onSave={(value) => updateProfile({ weight_kg: value })} />
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
}: {
  user: User | null;
  profile: Profile | null;
  navigate: (screen: AppScreen) => void;
  showToast: (message: string) => void;
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
      <ScreenHeader title="Step Counter" onBack={() => navigate("home")} />
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
      <PrimaryButton onClick={() => navigate("stepsHistory")}>Steps History</PrimaryButton>
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
}: {
  user: User | null;
  profile: Profile | null;
  navigate: (screen: AppScreen) => void;
  showToast: (message: string) => void;
}) {
  const [culinary, setCulinary] = useState("Any");
  const [diet, setDiet] = useState("None");
  const [goal, setGoal] = useState("");
  const [weekly, setWeekly] = useState<WeeklyMealPlan | null>(null);
  const [loading, setLoading] = useState<"daily" | "weekly" | "">("");
  const day = weekly?.day1;
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
      setWeekly(parseMealPlan(response.meal_plan));
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Meal plan generation failed.");
    } finally {
      setLoading("");
    }
  };

  const save = async () => {
    if (!user || !weekly) return;
    const { error } = await supabase.from("user_meal_history").upsert(
      {
        user_id: user.id,
        week_start_date: todayKey(),
        meal_plan_data: {
          plan_type: Object.keys(weekly).length > 1 ? "weekly" : "daily",
          culinary_preference: culinary,
          dietary_preference: diet,
          goal,
          plan: weekly,
          saved_at: new Date().toISOString(),
        },
      },
      { onConflict: "user_id,week_start_date" },
    );
    if (error) showToast(error.message);
    else showToast("Meal plan saved. You can find it in Meal History.");
  };

  return (
    <section className="screen-pad with-tabs">
      <ScreenHeader title="Meal Generator" subtitle="Meal plan catered to your calorie intake." onBack={() => navigate("home")} />
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
      <button className="secondary-button" onClick={save} disabled={!weekly}>Save Current Meal Plan</button>
      <button className="text-link centered" onClick={() => generate("weekly")} disabled={Boolean(loading)}>{loading === "weekly" ? "Generating 7-Day Plan..." : "Generate 7-Day Weekly Plan"}</button>
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
      <ScreenHeader title="Form Correction" subtitle="What are you training today?" onBack={() => navigate("home")} />
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
      <ScreenHeader title={group} subtitle="Choose an exercise to open live correction" onBack={() => navigate("formCorrection")} />
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
  const [cameraActive, setCameraActive] = useState(false);
  const [streaming, setStreaming] = useState(false);
  const [status, setStatus] = useState("Camera idle");
  const [stats, setStats] = useState({ correct: 0, incorrect: 0, angle: 0, feedback: "Open camera to begin." });
  const supportsInference = group === "Biceps" && exercise === "Bicep Curl";

  const stopLive = () => {
    if (frameTimerRef.current) window.clearInterval(frameTimerRef.current);
    socketRef.current?.close();
    streamRef.current?.getTracks().forEach((track) => track.stop());
    frameTimerRef.current = null;
    socketRef.current = null;
    streamRef.current = null;
    setStreaming(false);
    setCameraActive(false);
    setStatus("Camera stopped");
  };

  useEffect(() => stopLive, []);

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: { ideal: 720 }, height: { ideal: 960 } },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) videoRef.current.srcObject = stream;
      setCameraActive(true);
      setStatus(supportsInference ? "Camera ready. Start AI correction when ready." : "Camera ready. AI model is available for Bicep Curl.");
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Camera permission failed.");
    }
  };

  const captureFrame = () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    const socket = socketRef.current;
    if (!video || !canvas || socket?.readyState !== WebSocket.OPEN) return;
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
    if (!supportsInference) {
      showToast("Live AI correction is currently wired for Bicep Curl. This exercise opens camera preview only.");
      return;
    }
    if (!cameraActive) await startCamera();
    try {
      setStatus("Loading bicep curl model...");
      await loadBicepCurlModel();
      const url = `${MODEL_GATEWAY_API_BASE_URL.replace(/^http/, "ws")}/api/v1/bicep-curl/ws`;
      const socket = new WebSocket(url);
      socketRef.current = socket;
      socket.onopen = () => {
        setStreaming(true);
        setStatus("AI correction streaming");
        socket.send(JSON.stringify({ type: "start_session" }));
        frameTimerRef.current = window.setInterval(captureFrame, 220);
      };
      socket.onmessage = (event) => {
        const payload = JSON.parse(event.data);
        if (payload.type === "frame_result") {
          setStats({
            correct: Number(payload.correct_reps ?? payload.correct ?? 0),
            incorrect: Number(payload.incorrect_reps ?? payload.incorrect ?? 0),
            angle: Math.round(Number(payload.angle ?? 0)),
            feedback: String(payload.feedback ?? payload.prediction ?? "Keep moving."),
          });
        }
      };
      socket.onerror = () => showToast("Model gateway WebSocket is offline.");
      socket.onclose = () => setStreaming(false);
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Unable to start live correction.");
      setStatus("AI correction offline");
    }
  };

  return (
    <section className="screen-pad with-tabs">
      <ScreenHeader title={exercise} subtitle={`${group} form correction`} onBack={() => navigate("formExercises")} />
      <div className="live-camera">
        <video ref={videoRef} autoPlay muted playsInline />
        {!cameraActive && <div className="camera-placeholder"><Camera size={52} /><span>Camera preview</span></div>}
        <canvas ref={canvasRef} hidden />
      </div>
      <div className="live-stats">
        <Stat icon={CheckSquare} value={stats.correct} label="Correct" />
        <Stat icon={Trash2} value={stats.incorrect} label="Incorrect" />
        <Stat icon={Activity} value={stats.angle} label="Angle" />
      </div>
      <div className="feedback-card">
        <strong>{status}</strong>
        <p>{supportsInference ? stats.feedback : "This exercise is ready for camera preview. Add a model gateway endpoint for this exercise to enable AI scoring."}</p>
      </div>
      <div className="live-actions">
        <button className="secondary-button" onClick={cameraActive ? stopLive : startCamera}>
          {cameraActive ? <Square size={18} /> : <Camera size={18} />}
          {cameraActive ? "Stop Camera" : "Open Camera"}
        </button>
        <PrimaryButton onClick={streaming ? stopLive : startInference}>
          {streaming ? <Pause size={18} /> : <Play size={18} />}
          {streaming ? "Pause Correction" : "Start AI Correction"}
        </PrimaryButton>
      </div>
    </section>
  );
}

function LogsHistoryScreen({ user, navigate, showToast }: { user: User | null; navigate: (screen: AppScreen) => void; showToast: (message: string) => void }) {
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
      <ScreenHeader title="Logs History" subtitle="Track your strength progress" onBack={() => navigate("history")} />
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

function MealHistoryScreen({ user, navigate, showToast }: { user: User | null; navigate: (screen: AppScreen) => void; showToast: (message: string) => void }) {
  const [rows, setRows] = useState<any[]>([]);
  useEffect(() => {
    if (!user) return;
    supabase.from("user_meal_history").select("*").eq("user_id", user.id).order("week_start_date", { ascending: false }).then(({ data, error }) => {
      if (error) showToast(error.message);
      setRows(data ?? []);
    });
  }, [user?.id]);
  return <HistoryList title="Meal History" navigate={navigate} empty="No saved meal plans yet">{rows.map((row) => <article className="list-card" key={row.id}><strong>{row.meal_plan_data?.plan_type === "daily" ? "Saved Daily Plan" : `Week of ${row.week_start_date}`}</strong><small>{row.meal_plan_data?.culinary_preference}</small><p>{row.meal_plan_data?.goal}</p></article>)}</HistoryList>;
}

function StepsHistoryScreen({ user, navigate, showToast }: { user: User | null; navigate: (screen: AppScreen) => void; showToast: (message: string) => void }) {
  const [rows, setRows] = useState<any[]>([]);
  useEffect(() => {
    if (!user) return;
    supabase.from("step_tracking").select("*").eq("user_id", user.id).gte("date", `${monthKey()}-01`).order("date").then(({ data, error }) => {
      if (error) showToast(error.message);
      setRows(data ?? []);
    });
  }, [user?.id]);
  const totals = rows.reduce((sum, row) => ({ steps: sum.steps + Number(row.steps ?? 0), km: sum.km + Number(row.distance_km ?? 0), kcal: sum.kcal + Number(row.kcal ?? 0) }), { steps: 0, km: 0, kcal: 0 });
  return <HistoryList title="Steps History" navigate={navigate} empty="No step history yet"><div className="summary-card"><Stat icon={Footprints} value={totals.steps.toLocaleString()} label="Total Steps" /><Stat icon={Activity} value={totals.km.toFixed(1)} label="Kilometers" /><Stat icon={Flame} value={Math.round(totals.kcal)} label="Calories" /></div>{rows.map((row) => <article className="list-card" key={row.id}><strong>{row.date}</strong><p>{Number(row.steps).toLocaleString()} / {Number(row.goal).toLocaleString()} steps</p></article>)}</HistoryList>;
}

function HistoryList({ title, navigate, empty, children }: { title: string; navigate: (screen: AppScreen) => void; empty: string; children: React.ReactNode }) {
  const hasItems = Array.isArray(children) ? children.length > 0 : Boolean(children);
  return <section className="screen-pad with-tabs"><ScreenHeader title={title} onBack={() => navigate("history")} />{hasItems ? <div className="list-stack">{children}</div> : <EmptyState title={empty} />}</section>;
}

function BlogsScreen({ navigate }: { navigate: (screen: AppScreen) => void }) {
  return <section className="screen-pad with-tabs"><ScreenHeader title="Blogs" subtitle="Stay updated with trends" onBack={() => navigate("home")} /><div className="list-stack">{["Progressive overload basics", "Protein timing for muscle growth", "Walking and fat loss"].map((title) => <article className="list-card" key={title}><strong>{title}</strong><small>5 min read</small><p>Expert fitness guidance in the same Zentra content area.</p></article>)}</div></section>;
}

function EmptyState({ title, body }: { title: string; body?: string }) {
  return <div className="empty-state"><strong>{title}</strong>{body && <p>{body}</p>}</div>;
}
