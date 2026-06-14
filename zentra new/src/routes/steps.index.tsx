import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { Activity, Flame, Footprints, Loader2, Pause, Play, Plus, Minus, ArrowRight } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { Protected } from "@/components/Protected";
import { useAuth } from "@/hooks/useAuth";
import { supabase, hasSupabaseConfig } from "@/integrations/supabase/client";
import { todayKey } from "@/lib/format";

export const Route = createFileRoute("/steps/")({
  head: () => ({ meta: [{ title: "Step Counter — Zentra" }] }),
  component: () => (
    <Protected>
      <StepsPage />
    </Protected>
  ),
});

function StepsPage() {
  const { user, profile } = useAuth();
  const [steps, setSteps] = useState(0);
  const [tracking, setTracking] = useState(false);
  const [motionStatus, setMotionStatus] = useState("Browser motion tracking is idle.");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const lastPeakRef = useRef(0);
  const filteredMagnitudeRef = useRef(9.8);
  const belowThresholdRef = useRef(true);

  const goal = profile?.steps_goal ?? 8000;
  const kcal = steps * 0.04;
  const distance = Number((steps * 0.0008).toFixed(3));
  const minutes = Math.floor(steps / 120);
  const progress = goal > 0 ? Math.min((steps / goal) * 100, 100) : 0;

  const save = useCallback(
    async (nextSteps: number) => {
      if (!user || !hasSupabaseConfig) return;
      const payload = {
        user_id: user.id,
        date: todayKey(),
        steps: nextSteps,
        goal,
        kcal: nextSteps * 0.04,
        distance_km: Number((nextSteps * 0.0008).toFixed(3)),
        active_minutes: Math.floor(nextSteps / 120),
      };
      const { error: saveError } = await supabase
        .from("step_tracking")
        .upsert(payload, { onConflict: "user_id,date" });
      if (saveError) setError(saveError.message);
    },
    [user, goal],
  );

  useEffect(() => {
    if (!user || !hasSupabaseConfig) {
      setLoading(false);
      return;
    }
    let active = true;
    supabase
      .from("step_tracking")
      .select("steps")
      .eq("user_id", user.id)
      .eq("date", todayKey())
      .maybeSingle()
      .then(({ data }) => {
        if (active) {
          setSteps(Number(data?.steps ?? 0));
          setLoading(false);
        }
      });
    return () => {
      active = false;
    };
  }, [user]);

  const addSteps = (amount: number) => {
    const next = Math.max(0, steps + amount);
    setSteps(next);
    void save(next);
  };

  const handleMotion = useCallback(
    (event: DeviceMotionEvent) => {
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
    },
    [save],
  );

  const startMotionTracking = async () => {
    setError("");
    if (!("DeviceMotionEvent" in window)) {
      setError("This browser does not expose motion sensors.");
      return;
    }
    try {
      const motionEvent = DeviceMotionEvent as typeof DeviceMotionEvent & {
        requestPermission?: () => Promise<"granted" | "denied">;
      };
      if (typeof motionEvent.requestPermission === "function") {
        const permission = await motionEvent.requestPermission();
        if (permission !== "granted") {
          setError("Motion permission was not granted.");
          return;
        }
      }
      window.addEventListener("devicemotion", handleMotion);
      setTracking(true);
      setMotionStatus("Listening to phone motion. Keep this page open while walking.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not start motion tracking.");
    }
  };

  const stopMotionTracking = useCallback(() => {
    window.removeEventListener("devicemotion", handleMotion);
    setTracking(false);
    setMotionStatus("Motion tracking paused.");
  }, [handleMotion]);

  useEffect(() => {
    return () => window.removeEventListener("devicemotion", handleMotion);
  }, [handleMotion]);

  const dashOffset = 97.4 - (97.4 * progress) / 100;

  return (
    <AppShell>
      <div className="space-y-8 max-w-4xl">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-sm text-muted-foreground">{new Date().toLocaleDateString()}</p>
            <h1 className="text-3xl md:text-4xl font-bold mt-1">Step Counter</h1>
          </div>
          <Link to="/steps/history"
            className="inline-flex items-center gap-2 h-11 px-4 rounded-xl bg-surface border border-border text-sm hover:border-primary/40 transition">
            History <ArrowRight className="h-4 w-4" />
          </Link>
        </div>

        {error && (
          <div className="rounded-xl border border-destructive/40 bg-destructive/10 px-4 py-2.5 text-sm text-destructive">{error}</div>
        )}

        <div className="card-elevated p-8 grid place-items-center">
          <div className="relative h-64 w-64">
            <svg viewBox="0 0 36 36" className="h-64 w-64 -rotate-90">
              <circle cx="18" cy="18" r="15.5" className="fill-none stroke-border" strokeWidth="2" />
              <circle cx="18" cy="18" r="15.5" className="fill-none stroke-primary" strokeWidth="2.5"
                strokeDasharray="97.4" strokeDashoffset={dashOffset} strokeLinecap="round"
                style={{ filter: "drop-shadow(0 0 12px var(--glow))" }} />
            </svg>
            <div className="absolute inset-0 grid place-items-center text-center">
              {loading ? (
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              ) : (
                <div>
                  <p className="text-5xl font-bold">{steps.toLocaleString()}</p>
                  <p className="text-sm text-muted-foreground mt-1">of {goal.toLocaleString()}</p>
                  <p className="text-xs text-primary mt-2">{Math.round(progress)}%</p>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3">
          {[
            { icon: Flame, value: kcal.toFixed(1), label: "Kcal" },
            { icon: Footprints, value: distance.toFixed(2), label: "Kilometers" },
            { icon: Activity, value: String(minutes), label: "Active min" },
          ].map((s) => (
            <div key={s.label} className="card-elevated p-4 text-center">
              <s.icon className="h-5 w-5 mx-auto text-primary" />
              <p className="text-xl font-semibold mt-2">{s.value}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{s.label}</p>
            </div>
          ))}
        </div>

        <div className="card-elevated p-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <p className="font-semibold">{tracking ? "Motion tracking active" : "Browser step detection"}</p>
            <p className="text-sm text-muted-foreground mt-1">{motionStatus}</p>
          </div>
          <button onClick={tracking ? stopMotionTracking : startMotionTracking}
            className="inline-flex items-center gap-2 h-11 px-5 rounded-xl bg-gradient-primary text-white font-semibold shadow-[0_10px_30px_-10px_var(--glow)] hover:brightness-110 transition">
            {tracking ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
            {tracking ? "Pause" : "Start"}
          </button>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <button onClick={() => addSteps(100)}
            className="h-12 rounded-xl bg-surface border border-border text-sm font-semibold hover:border-primary/40 transition inline-flex items-center justify-center gap-2">
            <Plus className="h-4 w-4" /> 100
          </button>
          <button onClick={() => addSteps(1000)}
            className="h-12 rounded-xl bg-surface border border-border text-sm font-semibold hover:border-primary/40 transition inline-flex items-center justify-center gap-2">
            <Plus className="h-4 w-4" /> 1,000
          </button>
          <button onClick={() => addSteps(-100)}
            className="h-12 rounded-xl bg-surface border border-border text-sm font-semibold hover:border-primary/40 transition inline-flex items-center justify-center gap-2">
            <Minus className="h-4 w-4" /> 100
          </button>
        </div>
      </div>
    </AppShell>
  );
}
