import { FormEvent, useEffect, useMemo, useRef, useState, type Dispatch, type SetStateAction } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { Activity, Award, BarChart3, BicepsFlexed, BotMessageSquare, Camera, Check, CheckCircle, CheckSquare, ChefHat, ChevronRight, Clock, Copy, Dumbbell, Eye, EyeOff, Flame, Footprints, History as HistoryIcon, Home, Loader2, LogOut, MessageCircle, Newspaper, Pause, Play, RefreshCw, RotateCcw, Send, Shirt, Sparkles, Square, TrendingUp, Trash2, User as UserIcon, UtensilsCrossed } from "lucide-react";
import { DayMealPlan, WeeklyMealPlan, askZentra, checkAllServices, generateDailyMealPlan, generateDailyRecipes, generateShoppingList, generateWeeklyMealPlan, loadBicepCurlModel, MODEL_GATEWAY_API_BASE_URL, parseMealPlan, type RecipeResponse, type ServiceCheck, type ShoppingList } from "@/lib/api";
import { supabase, hasSupabaseConfig } from "@/lib/supabase";
import { PrimaryButton, ScreenHeader, EmptyState, Stat } from "@/components/ui";
import type { AppScreen, BlogPost, MealMeta, MetricPickerState, Message, Profile, SelectedMealRecipe, ExerciseLog } from "@/app/types";
import { bmiCategory, calculateBmi, formatDuration, formatHeightValue, formatWeightValue, monthKey, todayKey } from "@/app/utils";
export function SplashScreen() {
  return (
    <section className="splash">
      <div className="splash-content">
        <h1>Zentra</h1>
        <p>AI Fitness Trainer</p>
      </div>
    </section>
  );
}

export function OnboardingScreen({ navigate }: { navigate: (screen: AppScreen) => void }) {
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

export function AuthScreen({
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

export function BodyMetricsScreen({
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


