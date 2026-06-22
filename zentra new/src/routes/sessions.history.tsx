import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Award, ChevronLeft, Dumbbell, History as HistoryIcon, Loader2, CheckSquare, Trash2 } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { Protected } from "@/components/Protected";
import { useAuth } from "@/hooks/useAuth";
import { supabase, hasSupabaseConfig } from "@/integrations/supabase/client";
import { mapFormSessionRow, readSessionHistory, writeSessionHistory } from "@/lib/formCorrection";
import { formatDuration } from "@/lib/format";
import type { FormSessionSummary } from "@/lib/types";

export const Route = createFileRoute("/sessions/history")({
  head: () => ({ meta: [{ title: "Session History — Zentra" }] }),
  component: () => (
    <Protected>
      <SessionHistoryPage />
    </Protected>
  ),
});

function SessionHistoryPage() {
  const { user } = useAuth();
  const [rows, setRows] = useState<FormSessionSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadRows = async () => {
    setLoading(true);
    const localRows = readSessionHistory(user?.id);
    if (!user || !hasSupabaseConfig) {
      setRows(localRows);
      setLoading(false);
      return;
    }
    const { data, error: queryError } = await supabase
      .from("user_form_sessions")
      .select("*")
      .eq("user_id", user.id)
      .order("started_at", { ascending: false });
    if (queryError) {
      setRows(localRows);
      setError(queryError.message);
      setLoading(false);
      return;
    }
    const remoteRows = (data ?? []).map(mapFormSessionRow);
    setRows(remoteRows.length ? remoteRows : localRows);
    setLoading(false);
  };

  useEffect(() => {
    void loadRows();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const clearHistory = async () => {
    if (user && hasSupabaseConfig) {
      const { error: deleteError } = await supabase
        .from("user_form_sessions")
        .delete()
        .eq("user_id", user.id);
      if (deleteError) {
        setError(deleteError.message);
        return;
      }
    }
    writeSessionHistory(user?.id, []);
    setRows([]);
  };

  const totals = rows.reduce(
    (sum, row) => ({
      sessions: sum.sessions + 1,
      reps: sum.reps + row.total_reps,
      correct: sum.correct + row.correct_reps,
      incorrect: sum.incorrect + row.incorrect_reps,
      seconds: sum.seconds + row.duration_seconds,
    }),
    { sessions: 0, reps: 0, correct: 0, incorrect: 0, seconds: 0 },
  );
  const accuracy = totals.reps ? Math.round((totals.correct / totals.reps) * 100) : 0;

  return (
    <AppShell>
      <div className="space-y-6 max-w-4xl">
        <div className="flex items-center gap-3">
          <Link to="/history"
            className="h-10 w-10 grid place-items-center rounded-xl bg-surface border border-border hover:border-primary/40 transition">
            <ChevronLeft className="h-4 w-4" />
          </Link>
          <div className="flex-1">
            <p className="text-sm text-muted-foreground">Live correction summaries</p>
            <h1 className="text-3xl font-bold">Session History</h1>
          </div>
          {rows.length > 0 && (
            <button onClick={clearHistory}
              className="h-11 px-4 rounded-xl bg-surface border border-border text-sm hover:border-destructive/40 hover:text-destructive transition">
              Clear
            </button>
          )}
        </div>

        {error && (
          <div className="rounded-xl border border-destructive/40 bg-destructive/10 px-4 py-2.5 text-sm text-destructive">{error}</div>
        )}

        {loading ? (
          <div className="grid place-items-center py-10">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : rows.length === 0 ? (
          <div className="card-elevated p-8 text-center">
            <HistoryIcon className="h-8 w-8 mx-auto text-primary" />
            <p className="font-semibold mt-3">No live sessions yet</p>
            <p className="text-sm text-muted-foreground mt-1">Start a form correction recording and stop it to save a summary here.</p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-3 gap-3">
              <Stat icon={HistoryIcon} value={totals.sessions} label="Sessions" />
              <Stat icon={CheckSquare} value={totals.reps} label="Total Reps" />
              <Stat icon={Award} value={`${accuracy}%`} label="Accuracy" />
            </div>
            <div className="space-y-3">
              {rows.map((row) => {
                const started = new Date(row.started_at);
                const isRepSession = row.total_reps > 0 || row.exercise !== "Plank";
                return (
                  <article key={row.id} className="card-elevated p-5">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="font-semibold">{row.exercise}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">{row.group} · {started.toLocaleString()}</p>
                      </div>
                      <span className="text-xs text-primary font-semibold">{formatDuration(row.duration_seconds)}</span>
                    </div>
                    <div className="grid grid-cols-3 gap-3 mt-4">
                      <Stat icon={Dumbbell} value={isRepSession ? row.total_reps : "—"} label="Reps" />
                      <Stat icon={CheckSquare} value={row.correct_reps} label="Correct" />
                      <Stat icon={Trash2} value={row.incorrect_reps} label="Incorrect" />
                    </div>
                    {row.feedback ? <p className="mt-3 text-xs text-muted-foreground">{row.feedback}</p> : null}
                  </article>
                );
              })}
            </div>
          </>
        )}
      </div>
    </AppShell>
  );
}

function Stat({ icon: Icon, value, label }: { icon: typeof Award; value: React.ReactNode; label: string }) {
  return (
    <div className="card-elevated p-4 text-center">
      <Icon className="h-5 w-5 mx-auto text-primary" />
      <p className="text-xl font-semibold mt-2">{value}</p>
      <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
    </div>
  );
}
