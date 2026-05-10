import { FormEvent, useEffect, useMemo, useRef, useState, type Dispatch, type SetStateAction } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { Activity, Award, BarChart3, BicepsFlexed, BotMessageSquare, Camera, Check, CheckCircle, CheckSquare, ChefHat, ChevronRight, Clock, Copy, Dumbbell, Eye, EyeOff, Flame, Footprints, History as HistoryIcon, Home, Loader2, LogOut, MessageCircle, Newspaper, Pause, Play, RefreshCw, RotateCcw, Send, Shirt, Sparkles, Square, TrendingUp, Trash2, User as UserIcon, UtensilsCrossed } from "lucide-react";
import { DayMealPlan, WeeklyMealPlan, askZentra, checkAllServices, generateDailyMealPlan, generateDailyRecipes, generateShoppingList, generateWeeklyMealPlan, loadBicepCurlModel, MODEL_GATEWAY_API_BASE_URL, parseMealPlan, type RecipeResponse, type ServiceCheck, type ShoppingList } from "@/lib/api";
import { supabase, hasSupabaseConfig } from "@/lib/supabase";
import { PrimaryButton, ScreenHeader, EmptyState, Stat } from "@/components/ui";
import type { AppScreen, BlogPost, MealMeta, MetricPickerState, Message, Profile, SelectedMealRecipe, ExerciseLog, WorkoutSet } from "@/app/types";
import zentraLogo from "../../assets/images/icon.jpg";
import { bmiCategory, calculateBmi, formatDuration, formatHeightValue, formatWeightValue, monthKey, todayKey } from "@/app/utils";
export function HomeScreen({
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
            <small>BMI {profile?.bmi ?? calculateBmi(profile?.height_cm, profile?.weight_kg)} Â· {bmiCategory(profile?.bmi ?? calculateBmi(profile?.height_cm, profile?.weight_kg))}</small>
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
          <HistoryIcon size={28} />
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

export function LogsScreen({
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

export function AiScreen({ navigate, profile }: { navigate: (screen: AppScreen) => void; profile: Profile | null }) {
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
              {["Suggest some good excercises for Biceps", "I want to train shoulders biceps, suggest 6 excercises", "How much Creatine should I take?"].map((chip) => (
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

export function HistoryScreen({
  navigate,
  openLogsHistory,
  openStepsHistory,
  openMealHistory,
  openSessionHistory,
}: {
  navigate: (screen: AppScreen) => void;
  openLogsHistory: (backTo: AppScreen) => void;
  openStepsHistory: (backTo: AppScreen) => void;
  openMealHistory: (backTo: AppScreen) => void;
  openSessionHistory: (backTo: AppScreen) => void;
}) {
  const options = [
    { icon: BarChart3, title: "Logs History", subtitle: "View your workout history", screen: "logsHistory" as AppScreen },
    { icon: HistoryIcon, title: "Session History", subtitle: "View live form correction summaries", screen: "sessionHistory" as AppScreen },
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
                  : option.screen === "sessionHistory"
                    ? openSessionHistory("history")
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

export function ProfileScreen({
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

export function StepsScreen({
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
        <button onClick={() => addSteps(-100)}>âˆ’100</button>
      </div>
      <PrimaryButton onClick={() => openStepsHistory("steps")}>Steps History</PrimaryButton>
    </section>
  );
}






