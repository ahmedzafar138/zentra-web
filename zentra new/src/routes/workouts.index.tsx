import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowRight, Check, CheckSquare, ChevronDown, ChevronUp, Dumbbell, Loader2, Plus, Trash2, TrendingUp, X } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { Protected } from "@/components/Protected";
import { useAuth } from "@/hooks/useAuth";
import { supabase, hasSupabaseConfig } from "@/integrations/supabase/client";
import { todayKey } from "@/lib/format";
import type { ExerciseLog, WorkoutSet } from "@/lib/types";
import type { Json } from "@/integrations/supabase/types";

export const Route = createFileRoute("/workouts/")({
  head: () => ({ meta: [{ title: "Workout Logs — Zentra" }] }),
  component: () => (
    <Protected>
      <WorkoutsPage />
    </Protected>
  ),
});

const equipmentOptions = ["Dumbbell", "Barbell", "Cable", "Machine", "Bodyweight"];

function WorkoutsPage() {
  const { user } = useAuth();
  const [selectedDate, setSelectedDate] = useState(todayKey());
  const [exercises, setExercises] = useState<ExerciseLog[]>([]);
  const [draft, setDraft] = useState({ name: "", weight: "", reps: "", sets: "1", equipment: "Dumbbell" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [addOpen, setAddOpen] = useState(false);

  const plannedSets = exercises.reduce((sum, exercise) => sum + exercise.sets.length, 0);
  const completedSets = exercises.reduce((sum, exercise) => sum + exercise.sets.filter((set) => set.logged).length, 0);
  const volume = exercises.reduce(
    (sum, exercise) =>
      sum + exercise.sets
        .filter((set) => set.logged)
        .reduce((setSum, set) => setSum + Number(set.weight) * Number(set.reps), 0),
    0,
  );

  const load = async () => {
    if (!user || !hasSupabaseConfig) return;
    setLoading(true);
    setError("");
    const { data, error: queryError } = await supabase
      .from("user_logs_history")
      .select("*")
      .eq("user_id", user.id)
      .eq("month", selectedDate.slice(0, 7));
    if (queryError) setError(queryError.message);
    const next: ExerciseLog[] = (data ?? [])
      .map((row) => {
        const sets = Array.isArray(row.sets)
          ? (row.sets as unknown as WorkoutSet[]).filter((set) => (set.date ?? set.timestamp?.slice(0, 10)) === selectedDate)
          : [];
        return { id: row.id as string, name: row.exercise_name as string, equipment: row.muscle_group as string, sets };
      })
      .filter((item) => item.sets.length);
    setExercises(next);
    setLoading(false);
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, selectedDate]);

  const persist = async (exercise: ExerciseLog) => {
    if (!user || !hasSupabaseConfig) return;
    const { data: existing } = await supabase
      .from("user_logs_history")
      .select("sets")
      .eq("user_id", user.id)
      .eq("month", selectedDate.slice(0, 7))
      .eq("exercise_name", exercise.name)
      .maybeSingle();
    const oldSets = (Array.isArray(existing?.sets) ? (existing.sets as unknown as WorkoutSet[]) : []);
    const otherSets = oldSets.filter((set) => (set.date ?? set.timestamp?.slice(0, 10)) !== selectedDate);
    const { error: upsertError } = await supabase.from("user_logs_history").upsert(
      {
        user_id: user.id,
        month: selectedDate.slice(0, 7),
        exercise_name: exercise.name,
        muscle_group: exercise.equipment ?? "Other",
        sets: [...otherSets, ...exercise.sets] as unknown as Json,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id,month,exercise_name" },
    );
    if (upsertError) throw upsertError;
  };

  const addWorkout = async () => {
    setError("");
    if (!draft.name || !draft.weight || !draft.reps) {
      setError("Please fill in all workout fields.");
      return;
    }
    const count = Math.max(1, Number(draft.sets) || 1);
    const newSets: WorkoutSet[] = Array.from({ length: count }).map(() => ({
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
    setExercises((prev) => existing ? prev.map((item) => (item.name === existing.name ? updated : item)) : [...prev, updated]);
    try {
      await persist(updated);
      setDraft({ name: "", weight: "", reps: "", sets: "1", equipment: "Dumbbell" });
      setAddOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save workout.");
    }
  };

  const toggleSet = async (exercise: ExerciseLog, setId: string) => {
    const updated = {
      ...exercise,
      sets: exercise.sets.map((set) => (set.id === setId ? { ...set, logged: !set.logged } : set)),
    };
    setExercises((prev) => prev.map((item) => (item.name === exercise.name ? updated : item)));
    try {
      await persist(updated);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save set.");
    }
  };

  const deleteExercise = async (exercise: ExerciseLog) => {
    if (!user || !hasSupabaseConfig) return;
    const { data: existing } = await supabase
      .from("user_logs_history")
      .select("sets")
      .eq("user_id", user.id)
      .eq("month", selectedDate.slice(0, 7))
      .eq("exercise_name", exercise.name)
      .maybeSingle();
    const oldSets = Array.isArray(existing?.sets) ? (existing.sets as unknown as WorkoutSet[]) : [];
    const remainingSets = oldSets.filter((set) => (set.date ?? set.timestamp?.slice(0, 10)) !== selectedDate);
    const request = remainingSets.length
      ? supabase.from("user_logs_history").update({ sets: remainingSets as unknown as Json, updated_at: new Date().toISOString() })
          .eq("user_id", user.id).eq("month", selectedDate.slice(0, 7)).eq("exercise_name", exercise.name)
      : supabase.from("user_logs_history").delete()
          .eq("user_id", user.id).eq("month", selectedDate.slice(0, 7)).eq("exercise_name", exercise.name);
    const { error: requestError } = await request;
    if (requestError) {
      setError(requestError.message);
      return;
    }
    setExercises((prev) => prev.filter((item) => item.name !== exercise.name));
  };

  return (
    <AppShell>
      <div className="space-y-6 max-w-4xl">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-3xl md:text-4xl font-bold">Workout Log</h1>
            <p className="text-sm text-muted-foreground mt-1.5">Log your weights to keep progressing!</p>
          </div>
          <Link to="/workouts/history"
            className="inline-flex items-center gap-2 h-11 px-4 rounded-xl bg-surface border border-border text-sm hover:border-primary/40 transition">
            History <ArrowRight className="h-4 w-4" />
          </Link>
        </div>

        {error && (
          <div className="rounded-xl border border-destructive/40 bg-destructive/10 px-4 py-2.5 text-sm text-destructive">{error}</div>
        )}

        <div className="card-elevated p-5 flex flex-wrap items-center gap-4">
          <input type="date" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)}
            className="h-11 px-4 rounded-xl bg-surface-elevated border border-border text-sm focus:outline-none focus:border-primary/40" />
          <div className="grid grid-cols-3 gap-3 flex-1 min-w-[260px]">
            <Stat icon={CheckSquare} value={`${completedSets}/${plannedSets}`} label="Sets" />
            <Stat icon={TrendingUp} value={volume.toLocaleString()} label="Volume" />
            <Stat icon={Dumbbell} value={String(exercises.length)} label="Exercises" />
          </div>
        </div>

        <div className="card-elevated overflow-hidden">
          <button type="button" onClick={() => setAddOpen((v) => !v)}
            aria-expanded={addOpen}
            className="w-full flex items-center justify-between gap-3 px-5 py-4 hover:bg-surface-elevated transition text-left">
            <span className="flex items-center gap-3">
              <span className="h-9 w-9 rounded-xl bg-gradient-primary grid place-items-center shadow-[0_8px_24px_-8px_var(--glow)]">
                <Plus className="h-4 w-4 text-white" />
              </span>
              <span>
                <span className="block font-semibold">Add Workout</span>
                <span className="block text-xs text-muted-foreground mt-0.5">Log a new exercise for {selectedDate}</span>
              </span>
            </span>
            {addOpen ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
          </button>
          {addOpen && (
            <div className="px-5 pb-5 pt-2 space-y-3 border-t border-border">
              <input placeholder="Exercise name" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                className="w-full h-11 px-4 rounded-xl bg-surface-elevated border border-border text-sm focus:outline-none focus:border-primary/40" />
              <div className="grid sm:grid-cols-2 gap-3">
                <input placeholder="Weight (kg)" type="number" value={draft.weight} onChange={(e) => setDraft({ ...draft, weight: e.target.value })}
                  className="h-11 px-4 rounded-xl bg-surface-elevated border border-border text-sm focus:outline-none focus:border-primary/40" />
                <input placeholder="Reps" type="number" value={draft.reps} onChange={(e) => setDraft({ ...draft, reps: e.target.value })}
                  className="h-11 px-4 rounded-xl bg-surface-elevated border border-border text-sm focus:outline-none focus:border-primary/40" />
              </div>
              <div className="grid sm:grid-cols-2 gap-3">
                <input placeholder="Sets" type="number" min="1" value={draft.sets} onChange={(e) => setDraft({ ...draft, sets: e.target.value })}
                  className="h-11 px-4 rounded-xl bg-surface-elevated border border-border text-sm focus:outline-none focus:border-primary/40" />
                <select value={draft.equipment} onChange={(e) => setDraft({ ...draft, equipment: e.target.value })}
                  className="h-11 px-4 rounded-xl bg-surface-elevated border border-border text-sm focus:outline-none focus:border-primary/40">
                  {equipmentOptions.map((item) => <option key={item}>{item}</option>)}
                </select>
              </div>
              <div className="flex flex-col-reverse sm:flex-row gap-2 pt-1">
                <button type="button" onClick={() => setAddOpen(false)}
                  className="h-11 px-4 rounded-xl bg-surface border border-border text-sm hover:border-primary/40 transition inline-flex items-center justify-center gap-2">
                  <X className="h-4 w-4" /> Cancel
                </button>
                <button onClick={addWorkout}
                  className="flex-1 h-11 rounded-xl bg-gradient-primary text-white text-sm font-semibold shadow-[0_10px_30px_-10px_var(--glow)] hover:brightness-110 transition inline-flex items-center justify-center gap-2">
                  <Plus className="h-4 w-4" /> Add a workout
                </button>
              </div>
            </div>
          )}
        </div>

        {loading ? (
          <div className="grid place-items-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : exercises.length === 0 ? (
          <div className="card-elevated p-8 text-center">
            <p className="font-semibold">No workout logs for this day</p>
            <p className="text-sm text-muted-foreground mt-1">Add a workout to log your first set.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {exercises.map((exercise) => (
              <article key={exercise.name} className="card-elevated p-5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="font-semibold">{exercise.name}</h3>
                    <p className="text-xs text-muted-foreground mt-0.5">{exercise.equipment}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-primary font-semibold">
                      {exercise.sets.filter((set) => set.logged).length}/{exercise.sets.length} sets
                    </span>
                    <button onClick={() => deleteExercise(exercise)} aria-label="Delete exercise"
                      className="h-9 w-9 grid place-items-center rounded-xl bg-surface border border-border hover:border-destructive/40 hover:text-destructive transition">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
                <div className="mt-4 divide-y divide-border">
                  <div className="grid grid-cols-3 text-xs uppercase tracking-wider text-muted-foreground py-2">
                    <span>Weight</span><span>Reps</span><span className="text-right">Log</span>
                  </div>
                  {exercise.sets.map((set) => (
                    <div key={set.id} className="grid grid-cols-3 items-center py-3 text-sm">
                      <span>{set.weight} kg</span>
                      <span>{set.reps}</span>
                      <button onClick={() => toggleSet(exercise, set.id)}
                        className={`ml-auto h-9 w-9 grid place-items-center rounded-xl border transition ${set.logged ? "border-primary bg-primary/10 text-primary" : "border-border bg-surface hover:border-primary/40"}`}>
                        {set.logged && <Check className="h-4 w-4" />}
                      </button>
                    </div>
                  ))}
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
    </AppShell>
  );
}

function Stat({ icon: Icon, value, label }: { icon: typeof Dumbbell; value: string; label: string }) {
  return (
    <div className="rounded-xl bg-surface-elevated border border-border p-3 text-center">
      <Icon className="h-4 w-4 mx-auto text-primary" />
      <p className="font-semibold mt-1">{value}</p>
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
    </div>
  );
}
