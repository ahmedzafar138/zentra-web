import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Check, ChevronLeft, Flame, Loader2, Minus, Plus, Ruler, Scale } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { supabase, hasSupabaseConfig } from "@/integrations/supabase/client";
import { calculateBmi, formatHeightValue, formatWeightValue } from "@/lib/format";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/onboarding")({
  head: () => ({ meta: [{ title: "Set up profile — Zentra" }] }),
  component: OnboardingPage,
});

type Step = "height" | "weight" | "goal" | "activity" | "done";
const stepOrder: Step[] = ["height", "weight", "goal", "activity", "done"];
const goals = ["Lose fat", "Build muscle", "Improve endurance", "Maintain"] as const;
const activities = ["Sedentary", "Lightly active", "Active", "Very active"] as const;

function OnboardingPage() {
  const navigate = useNavigate();
  const { session, user, profile, loading, refreshProfile } = useAuth();

  const [step, setStep] = useState<Step>("height");
  const [height, setHeight] = useState(173);
  const [heightUnit, setHeightUnit] = useState<"cm" | "ft-in">("cm");
  const [weight, setWeight] = useState(70);
  const [weightUnit, setWeightUnit] = useState<"kg" | "lb">("kg");
  const [goal, setGoal] = useState<(typeof goals)[number]>("Build muscle");
  const [activity, setActivity] = useState<(typeof activities)[number]>("Active");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (loading) return;
    if (hasSupabaseConfig && !session) navigate({ to: "/login" });
  }, [session, loading, navigate]);

  useEffect(() => {
    if (profile?.onboarding_completed && profile.height_cm && profile.weight_kg) {
      navigate({ to: "/dashboard" });
    } else {
      if (profile?.height_cm) setHeight(profile.height_cm);
      if (profile?.weight_kg) setWeight(profile.weight_kg);
      if (profile?.height_unit === "ft-in") setHeightUnit("ft-in");
      if (profile?.weight_unit === "lb") setWeightUnit("lb");
    }
  }, [profile, navigate]);

  const back = () => {
    const idx = stepOrder.indexOf(step);
    if (idx > 0) setStep(stepOrder[idx - 1]);
  };
  const next = () => {
    const idx = stepOrder.indexOf(step);
    if (idx < stepOrder.length - 1) setStep(stepOrder[idx + 1]);
  };

  const save = async () => {
    if (!user) {
      setError("You must be signed in.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const bmi = calculateBmi(height, weight);
      const { error: updateError } = await supabase
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
      if (updateError) throw updateError;
      await refreshProfile();
      navigate({ to: "/dashboard" });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save body metrics.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen grid place-items-center">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen grid place-items-center px-4 py-10 relative z-10">
      <div className="w-full max-w-2xl space-y-6">
        <div className="flex items-center justify-center gap-2.5">
          <div className="h-11 w-11 rounded-xl bg-gradient-primary grid place-items-center shadow-[0_10px_30px_-10px_var(--glow)]">
            <Flame className="h-6 w-6 text-white" />
          </div>
          <span className="text-2xl font-bold">Zentra</span>
        </div>
        <div className="text-center">
          <h1 className="text-3xl font-bold">Let's build your plan</h1>
          <p className="text-sm text-muted-foreground mt-1.5">A few quick answers. One step at a time.</p>
        </div>
        <div className="flex items-center justify-center gap-2">
          {stepOrder.map((s, i) => (
            <span key={s}
              className={cn(
                "h-1.5 rounded-full transition-all",
                step === s ? "w-10 bg-gradient-primary" : i < stepOrder.indexOf(step) ? "w-6 bg-primary/60" : "w-6 bg-border",
              )}
            />
          ))}
        </div>

        <div className="card-elevated p-7 sm:p-9">
          {error && (
            <div className="mb-4 rounded-xl border border-destructive/40 bg-destructive/10 px-4 py-2.5 text-sm text-destructive">{error}</div>
          )}
          {step === "height" && (
            <MetricStep
              icon={<Ruler className="h-5 w-5 text-white" />}
              title="What's your height?"
              subtitle="We use this to calculate your daily targets."
              value={height}
              setValue={setHeight}
              unit={heightUnit}
              setUnit={(u) => setHeightUnit(u as "cm" | "ft-in")}
              units={["cm", "ft-in"]}
              min={120}
              max={220}
              format={formatHeightValue}
              onNext={next}
              showBack={false}
            />
          )}
          {step === "weight" && (
            <MetricStep
              icon={<Scale className="h-5 w-5 text-white" />}
              title="Almost there!"
              subtitle="Updated weekly to keep your plan accurate."
              value={weight}
              setValue={setWeight}
              unit={weightUnit}
              setUnit={(u) => setWeightUnit(u as "kg" | "lb")}
              units={["kg", "lb"]}
              min={35}
              max={220}
              format={formatWeightValue}
              onNext={next}
              onBack={back}
            />
          )}
          {step === "goal" && (
            <ChoiceStep
              title="Your fitness goal"
              subtitle="Pick the one that matters most right now."
              options={[...goals]}
              value={goal}
              setValue={(v) => setGoal(v as (typeof goals)[number])}
              onNext={next}
              onBack={back}
            />
          )}
          {step === "activity" && (
            <ChoiceStep
              title="Activity level"
              subtitle="How active is your typical week?"
              options={[...activities]}
              value={activity}
              setValue={(v) => setActivity(v as (typeof activities)[number])}
              onNext={next}
              onBack={back}
            />
          )}
          {step === "done" && (
            <div className="flex flex-col items-center text-center space-y-5 py-4">
              <div className="h-16 w-16 rounded-2xl bg-gradient-primary grid place-items-center shadow-[0_15px_40px_-10px_var(--glow)]">
                <Check className="h-8 w-8 text-white" />
              </div>
              <div>
                <h2 className="text-2xl font-bold">You're all set</h2>
                <p className="text-sm text-muted-foreground mt-1.5">Your personalized plan is ready. Let's go.</p>
              </div>
              <div className="grid grid-cols-2 gap-3 w-full max-w-sm">
                <div className="rounded-xl bg-surface-elevated border border-border p-3 text-center">
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Height</p>
                  <p className="font-semibold mt-1">{formatHeightValue(height, heightUnit)}</p>
                </div>
                <div className="rounded-xl bg-surface-elevated border border-border p-3 text-center">
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Weight</p>
                  <p className="font-semibold mt-1">{formatWeightValue(weight, weightUnit)}</p>
                </div>
              </div>
              <div className="flex items-center gap-3 w-full">
                <button onClick={back} type="button"
                  className="h-12 px-4 rounded-xl bg-surface border border-border text-sm hover:border-primary/40 transition inline-flex items-center gap-2">
                  <ChevronLeft className="h-4 w-4" /> Back
                </button>
                <button onClick={save} disabled={saving} type="button"
                  className="flex-1 h-12 rounded-xl bg-gradient-primary text-white font-semibold shadow-[0_10px_30px_-10px_var(--glow)] hover:brightness-110 transition inline-flex items-center justify-center gap-2 disabled:opacity-60">
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Enter Zentra"}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function MetricStep({ icon, title, subtitle, value, setValue, unit, setUnit, units, min, max, format, onNext, onBack, showBack = true }: {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  value: number;
  setValue: (v: number) => void;
  unit: string;
  setUnit: (u: string) => void;
  units: string[];
  min: number;
  max: number;
  format: (v: number, u: string) => string;
  onNext: () => void;
  onBack?: () => void;
  showBack?: boolean;
}) {
  return (
    <div className="space-y-6">
      <div className="flex items-start gap-4">
        <div className="h-11 w-11 rounded-xl bg-gradient-primary grid place-items-center shrink-0 shadow-[0_8px_24px_-8px_var(--glow)]">{icon}</div>
        <div className="flex-1">
          <h2 className="text-xl font-semibold">{title}</h2>
          <p className="text-sm text-muted-foreground mt-1">{subtitle}</p>
        </div>
      </div>
      <div className="rounded-2xl bg-surface-elevated border border-border p-6 text-center space-y-5">
        <div className="text-4xl font-bold text-gradient-primary">{format(value, unit)}</div>
        <div className="grid grid-cols-2 gap-2 max-w-xs mx-auto">
          {units.map((u) => (
            <button type="button" key={u} onClick={() => setUnit(u)}
              className={cn(
                "h-10 rounded-xl border text-sm transition",
                unit === u ? "border-primary bg-primary/10 text-primary" : "border-border bg-surface hover:border-primary/30",
              )}>
              {u}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-3">
          <button type="button" aria-label="Decrease" onClick={() => setValue(Math.max(min, value - 1))}
            className="h-11 w-11 grid place-items-center rounded-xl bg-surface border border-border hover:border-primary/40 hover:text-primary transition shrink-0">
            <Minus className="h-4 w-4" />
          </button>
          <input type="range" min={min} max={max} value={value} onChange={(e) => setValue(Number(e.target.value))}
            className="flex-1 accent-primary" />
          <button type="button" aria-label="Increase" onClick={() => setValue(Math.min(max, value + 1))}
            className="h-11 w-11 grid place-items-center rounded-xl bg-surface border border-border hover:border-primary/40 hover:text-primary transition shrink-0">
            <Plus className="h-4 w-4" />
          </button>
        </div>
        <input type="number" min={min} max={max} value={value} onChange={(e) => setValue(Math.min(max, Math.max(min, Number(e.target.value) || min)))}
          className="w-32 mx-auto h-11 px-3 rounded-xl bg-surface border border-border text-sm text-center focus:outline-none focus:border-primary/40" />
      </div>
      <div className="flex items-center gap-3">
        {showBack && onBack && (
          <button onClick={onBack} type="button"
            className="h-12 px-4 rounded-xl bg-surface border border-border text-sm hover:border-primary/40 transition inline-flex items-center gap-2">
            <ChevronLeft className="h-4 w-4" /> Back
          </button>
        )}
        <button onClick={onNext} type="button"
          className="flex-1 h-12 rounded-xl bg-gradient-primary text-white font-semibold shadow-[0_10px_30px_-10px_var(--glow)] hover:brightness-110 transition">
          Continue
        </button>
      </div>
    </div>
  );
}

function ChoiceStep({ title, subtitle, options, value, setValue, onNext, onBack }: {
  title: string;
  subtitle: string;
  options: string[];
  value: string;
  setValue: (v: string) => void;
  onNext: () => void;
  onBack: () => void;
}) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold">{title}</h2>
        <p className="text-sm text-muted-foreground mt-1">{subtitle}</p>
      </div>
      <div className="grid sm:grid-cols-2 gap-3">
        {options.map((o) => (
          <button type="button" key={o} onClick={() => setValue(o)}
            className={cn(
              "rounded-xl border p-4 text-left text-sm transition",
              value === o ? "border-primary bg-primary/10 text-primary" : "border-border bg-surface hover:border-primary/30",
            )}>
            {o}
          </button>
        ))}
      </div>
      <div className="flex items-center gap-3">
        <button onClick={onBack} type="button"
          className="h-12 px-4 rounded-xl bg-surface border border-border text-sm hover:border-primary/40 transition inline-flex items-center gap-2">
          <ChevronLeft className="h-4 w-4" /> Back
        </button>
        <button onClick={onNext} type="button"
          className="flex-1 h-12 rounded-xl bg-gradient-primary text-white font-semibold shadow-[0_10px_30px_-10px_var(--glow)] hover:brightness-110 transition">
          Continue
        </button>
      </div>
    </div>
  );
}
