import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Award, ChevronLeft, CheckSquare, Loader2, TrendingUp } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { Protected } from "@/components/Protected";
import { useAuth } from "@/hooks/useAuth";
import { supabase, hasSupabaseConfig } from "@/integrations/supabase/client";
import { monthKey, todayKey } from "@/lib/format";
import type { WorkoutSet } from "@/lib/types";
import { cn } from "@/lib/utils";

type WorkoutsHistorySearch = { from?: "workouts" };

export const Route = createFileRoute("/workouts/history")({
  head: () => ({ meta: [{ title: "Logs History — Zentra" }] }),
  validateSearch: (search: Record<string, unknown>): WorkoutsHistorySearch => ({
    from: search.from === "workouts" ? "workouts" : undefined,
  }),
  component: () => (
    <Protected>
      <LogsHistoryPage />
    </Protected>
  ),
});

type Tab = "summary" | "byExercise" | "calendar";
type LoggedSet = WorkoutSet & { exerciseName: string; muscleGroup: string; dateKey: string };

function LogsHistoryPage() {
  const { from } = Route.useSearch();
  const backTo = from === "workouts" ? "/workouts" : "/history";
  const { user } = useAuth();
  const [tab, setTab] = useState<Tab>("summary");
  const [selectedExercise, setSelectedExercise] = useState("");
  const [selectedDate, setSelectedDate] = useState(todayKey());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [loggedSets, setLoggedSets] = useState<LoggedSet[]>([]);

  useEffect(() => {
    if (!user || !hasSupabaseConfig) {
      setLoading(false);
      return;
    }
    let active = true;
    supabase
      .from("user_logs_history")
      .select("*")
      .eq("user_id", user.id)
      .eq("month", monthKey())
      .then(({ data, error: queryError }) => {
        if (!active) return;
        if (queryError) setError(queryError.message);
        const flat: LoggedSet[] = (data ?? []).flatMap((row) =>
          (Array.isArray(row.sets) ? (row.sets as unknown as WorkoutSet[]) : [])
            .filter((set) => set.logged)
            .map((set) => ({
              ...set,
              exerciseName: row.exercise_name as string,
              muscleGroup: row.muscle_group as string,
              dateKey: set.date ?? set.timestamp?.slice(0, 10) ?? todayKey(),
            })),
        );
        setLoggedSets(flat);
        setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [user?.id]);

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
    <AppShell>
      <div className="space-y-6 max-w-4xl">
        <div className="flex items-center gap-3">
          <Link to={backTo}
            className="h-10 w-10 grid place-items-center rounded-xl bg-surface border border-border hover:border-primary/40 transition">
            <ChevronLeft className="h-4 w-4" />
          </Link>
          <div>
            <p className="text-sm text-muted-foreground">Track your strength progress</p>
            <h1 className="text-3xl font-bold">Logs History</h1>
          </div>
        </div>

        {error && (
          <div className="rounded-xl border border-destructive/40 bg-destructive/10 px-4 py-2.5 text-sm text-destructive">{error}</div>
        )}

        <div className="grid grid-cols-3 rounded-xl bg-surface border border-border p-1 text-sm">
          {(["summary", "byExercise", "calendar"] as const).map((t) => (
            <button key={t} onClick={() => setTab(t)}
              className={cn("h-10 rounded-lg transition", tab === t ? "bg-gradient-primary text-white shadow-[0_8px_24px_-8px_var(--glow)]" : "text-muted-foreground hover:text-foreground")}>
              {t === "byExercise" ? "By Exercise" : t[0].toUpperCase() + t.slice(1)}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="grid place-items-center py-10">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : loggedSets.length === 0 ? (
          <div className="card-elevated p-8 text-center">
            <p className="font-semibold">No workout logs yet</p>
            <p className="text-sm text-muted-foreground mt-1">Logged sets will appear here with summaries and calendar intensity.</p>
          </div>
        ) : tab === "summary" ? (
          <>
            <div className="grid grid-cols-3 gap-3">
              <Stat icon={TrendingUp} value={totalVolume.toLocaleString()} label="Volume kg" />
              <Stat icon={Award} value={String(maxWeight)} label="Max kg" />
              <Stat icon={CheckSquare} value={String(loggedSets.length)} label="Sets" />
            </div>
            <div className="card-elevated p-6">
              <div className="flex items-center justify-between mb-4">
                <p className="text-sm font-semibold">Weekly volume (last 7 days)</p>
                <p className="text-xs text-muted-foreground">peak {maxChartVolume.toLocaleString()} kg</p>
              </div>
              <div className="grid grid-cols-7 gap-3 h-52">
                {chartDays.map((day) => {
                  const pct = (day.volume / maxChartVolume) * 100;
                  const isToday = day.key === todayKey();
                  return (
                    <div key={day.key} className="flex flex-col items-center min-w-0">
                      <span className="text-[10px] text-muted-foreground h-4">
                        {day.volume > 0 ? `${(day.volume / 1000).toFixed(day.volume >= 10000 ? 0 : 1)}k` : ""}
                      </span>
                      <div className="flex-1 w-full flex items-end justify-center mt-1">
                        <div
                          className={`w-full max-w-10 rounded-t-lg transition-all ${day.volume > 0 ? "bg-gradient-primary opacity-90" : "bg-surface-elevated border border-border"}`}
                          style={{ height: `${day.volume > 0 ? Math.max(6, pct) : 4}%` }}
                        />
                      </div>
                      <span className={`text-xs mt-2 ${isToday ? "text-primary font-semibold" : "text-muted-foreground"}`}>{day.label}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </>
        ) : tab === "byExercise" ? (
          <>
            <select value={activeExercise} onChange={(e) => setSelectedExercise(e.target.value)}
              className="h-11 px-4 rounded-xl bg-surface-elevated border border-border text-sm focus:outline-none focus:border-primary/40">
              {exerciseNames.map((name) => <option key={name}>{name}</option>)}
            </select>
            <div className="card-elevated p-5">
              <div className="grid grid-cols-3 text-xs uppercase tracking-wider text-muted-foreground pb-3 border-b border-border">
                <span>Date</span><span>Weight</span><span>Reps</span>
              </div>
              {exerciseRows.map((set) => (
                <div key={set.id} className="grid grid-cols-3 py-2.5 text-sm border-b border-border last:border-0">
                  <span>{set.dateKey}</span>
                  <span>{set.weight} kg</span>
                  <span>{set.reps}</span>
                </div>
              ))}
            </div>
          </>
        ) : (
          <>
            <div className="card-elevated p-5">
              <div className="grid grid-cols-7 gap-1.5">
                {calendarDays.map((day) => (
                  <button key={day.key} onClick={() => setSelectedDate(day.key)}
                    className={cn(
                      "aspect-square rounded-lg text-xs font-semibold transition",
                      selectedDate === day.key ? "ring-2 ring-primary" : "",
                      day.count === 0 ? "bg-surface-elevated border border-border text-muted-foreground" :
                      day.count === 1 ? "bg-primary/20 text-primary" :
                      day.count === 2 ? "bg-primary/40 text-white" :
                      "bg-gradient-primary text-white",
                    )}>
                    {day.day}
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-3">
              {selectedLogs.length === 0 ? (
                <div className="card-elevated p-6 text-center text-sm text-muted-foreground">No sets logged on this day.</div>
              ) : selectedLogs.map((set) => (
                <article key={set.id} className="card-elevated p-4">
                  <strong>{set.exerciseName}</strong>
                  <p className="text-xs text-muted-foreground mt-0.5">{set.muscleGroup}</p>
                  <p className="text-sm mt-2">{set.weight} kg × {set.reps} reps</p>
                </article>
              ))}
            </div>
          </>
        )}
      </div>
    </AppShell>
  );
}

function Stat({ icon: Icon, value, label }: { icon: typeof Award; value: string; label: string }) {
  return (
    <div className="card-elevated p-4 text-center">
      <Icon className="h-5 w-5 mx-auto text-primary" />
      <p className="text-xl font-semibold mt-2">{value}</p>
      <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
    </div>
  );
}
