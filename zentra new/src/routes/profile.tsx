import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, type ChangeEvent } from "react";
import { Camera, Loader2, LogOut, Mail, Minus, Plus, Save, User as UserIcon } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { Protected } from "@/components/Protected";
import { useAuth } from "@/hooks/useAuth";
import { supabase, hasSupabaseConfig } from "@/integrations/supabase/client";
import { bmiCategory, calculateBmi, formatHeightValue, formatWeightValue } from "@/lib/format";
import type { Profile } from "@/lib/types";

export const Route = createFileRoute("/profile")({
  head: () => ({ meta: [{ title: "Profile — Zentra" }] }),
  component: () => (
    <Protected>
      <ProfilePage />
    </Protected>
  ),
});

function ProfilePage() {
  const navigate = useNavigate();
  const { user, profile, refreshProfile, signOut } = useAuth();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");

  const [height, setHeight] = useState<number>(profile?.height_cm ?? 173);
  const [heightUnit, setHeightUnit] = useState<string>(profile?.height_unit ?? "cm");
  const [weight, setWeight] = useState<number>(profile?.weight_kg ?? 70);
  const [weightUnit, setWeightUnit] = useState<string>(profile?.weight_unit ?? "kg");
  const [stepsGoal, setStepsGoal] = useState<number>(profile?.steps_goal ?? 8000);

  const bmi = profile?.bmi ?? calculateBmi(profile?.height_cm, profile?.weight_kg);
  const initial = (profile?.first_name?.[0] ?? user?.email?.[0] ?? "Z").toUpperCase();
  const fullName = [profile?.first_name, profile?.last_name].filter(Boolean).join(" ") || "Your profile";

  const updateProfile = async (patch: Partial<Profile>) => {
    if (!user || !hasSupabaseConfig) return;
    setError("");
    setInfo("");
    setSaving(true);
    try {
      const nextHeight = patch.height_cm ?? profile?.height_cm;
      const nextWeight = patch.weight_kg ?? profile?.weight_kg;
      const nextPatch = { ...patch, bmi: calculateBmi(nextHeight, nextWeight), onboarding_completed: true };
      const { error: updateError } = await supabase
        .from("user_profiles")
        .update(nextPatch)
        .eq("id", user.id);
      if (updateError) throw updateError;
      await refreshProfile();
      setInfo("Profile updated.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update profile.");
    } finally {
      setSaving(false);
    }
  };

  const uploadAvatar = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !user || !hasSupabaseConfig) return;
    setSaving(true);
    setError("");
    setInfo("");
    try {
      const path = `${user.id}/avatar-${Date.now()}-${file.name}`;
      const { error: uploadError } = await supabase.storage.from("avatars").upload(path, file, {
        upsert: true,
        cacheControl: "3600",
        contentType: file.type || "image/jpeg",
      });
      if (uploadError) throw uploadError;
      const { data } = supabase.storage.from("avatars").getPublicUrl(path);
      await updateProfile({ avatar_url: data.publicUrl });
      setInfo("Avatar uploaded.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not upload avatar.");
    } finally {
      setSaving(false);
    }
  };

  const handleSignOut = async () => {
    await signOut();
    navigate({ to: "/login" });
  };

  return (
    <AppShell>
      <div className="space-y-6 max-w-4xl">
        <div className="card-elevated p-6 sm:p-8 flex flex-col sm:flex-row gap-6 items-start">
          <label className="relative h-24 w-24 rounded-3xl bg-gradient-primary grid place-items-center text-3xl font-bold text-white shadow-[0_15px_40px_-10px_var(--glow)] cursor-pointer overflow-hidden">
            {profile?.avatar_url ? (
              <img src={profile.avatar_url} alt="" className="h-full w-full object-cover" />
            ) : (
              <span>{initial}</span>
            )}
            <span className="absolute bottom-1 right-1 h-7 w-7 rounded-full bg-surface-elevated border border-border grid place-items-center text-foreground">
              <Camera className="h-3.5 w-3.5" />
            </span>
            <input type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={uploadAvatar} />
          </label>
          <div className="flex-1">
            <h1 className="text-3xl font-bold">{fullName}</h1>
            {user?.email && (
              <p className="text-sm text-muted-foreground inline-flex items-center gap-1.5 mt-1.5">
                <Mail className="h-3.5 w-3.5" /> {user.email}
              </p>
            )}
            <div className="grid grid-cols-3 gap-3 mt-5">
              <Stat label="Height" value={profile?.height_cm ? formatHeightValue(profile.height_cm, profile.height_unit ?? "cm") : "—"} />
              <Stat label="Weight" value={profile?.weight_kg ? formatWeightValue(profile.weight_kg, profile.weight_unit ?? "kg") : "—"} />
              <Stat label="BMI" value={bmi ? `${bmi} · ${bmiCategory(bmi)}` : "—"} />
            </div>
          </div>
        </div>

        {(error || info) && (
          <div className={`rounded-xl border px-4 py-2.5 text-sm ${error ? "border-destructive/40 bg-destructive/10 text-destructive" : "border-primary/30 bg-primary/10 text-primary"}`}>
            {error || info}
          </div>
        )}

        <div className="card-elevated p-6 sm:p-8 space-y-6">
          <h2 className="text-xl font-semibold">Body metrics</h2>
          <div className="grid sm:grid-cols-2 gap-5">
            <MetricEditor
              label="Height"
              value={height}
              setValue={setHeight}
              unit={heightUnit}
              setUnit={setHeightUnit}
              units={["cm", "ft-in"]}
              min={120}
              max={220}
              format={formatHeightValue}
              onSave={() => updateProfile({ height_cm: height, height_unit: heightUnit })}
              saving={saving}
            />
            <MetricEditor
              label="Weight"
              value={weight}
              setValue={setWeight}
              unit={weightUnit}
              setUnit={setWeightUnit}
              units={["kg", "lb"]}
              min={35}
              max={220}
              format={formatWeightValue}
              onSave={() => updateProfile({ weight_kg: weight, weight_unit: weightUnit })}
              saving={saving}
            />
          </div>
        </div>

        <div className="card-elevated p-6 sm:p-8 space-y-4">
          <h2 className="text-xl font-semibold">Daily steps goal</h2>
          <div className="flex items-center gap-3">
            <input type="number" min={500} max={50000} step={500} value={stepsGoal} onChange={(e) => setStepsGoal(Number(e.target.value) || 8000)}
              className="w-40 h-12 px-4 rounded-xl bg-surface-elevated border border-border text-sm focus:outline-none focus:border-primary/40" />
            <button onClick={() => updateProfile({ steps_goal: stepsGoal })} disabled={saving}
              className="inline-flex items-center gap-2 h-12 px-5 rounded-xl bg-gradient-primary text-white font-semibold shadow-[0_10px_30px_-10px_var(--glow)] hover:brightness-110 transition disabled:opacity-60">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Save
            </button>
          </div>
        </div>

        <button onClick={handleSignOut}
          className="inline-flex items-center gap-2 h-12 px-5 rounded-xl bg-surface border border-border hover:border-destructive/40 hover:text-destructive transition text-sm">
          <LogOut className="h-4 w-4" /> Sign out
        </button>
      </div>
    </AppShell>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-surface-elevated border border-border p-3">
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="font-semibold mt-0.5">{value}</p>
    </div>
  );
}

function MetricEditor({ label, value, setValue, unit, setUnit, units, min, max, format, onSave, saving }: {
  label: string;
  value: number;
  setValue: (v: number) => void;
  unit: string;
  setUnit: (u: string) => void;
  units: string[];
  min: number;
  max: number;
  format: (v: number, u: string) => string;
  onSave: () => void | Promise<void>;
  saving: boolean;
}) {
  const clamp = (n: number) => Math.min(max, Math.max(min, n));
  return (
    <div className="rounded-2xl bg-surface-elevated border border-border p-5 space-y-4">
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold flex items-center gap-2"><UserIcon className="h-4 w-4 text-primary" /> {label}</span>
        <span className="text-xl font-bold text-gradient-primary">{format(value, unit)}</span>
      </div>
      <div className="grid grid-cols-2 gap-2">
        {units.map((u) => (
          <button type="button" key={u} onClick={() => setUnit(u)}
            className={`h-9 rounded-lg border text-sm transition ${unit === u ? "border-primary bg-primary/10 text-primary" : "border-border bg-surface hover:border-primary/30"}`}>
            {u}
          </button>
        ))}
      </div>
      <div className="flex items-center gap-3">
        <button type="button" aria-label={`Decrease ${label.toLowerCase()}`} onClick={() => setValue(clamp(value - 1))}
          className="h-10 w-10 grid place-items-center rounded-xl bg-surface border border-border hover:border-primary/40 hover:text-primary transition shrink-0">
          <Minus className="h-4 w-4" />
        </button>
        <input type="range" min={min} max={max} value={value} onChange={(e) => setValue(Number(e.target.value))}
          className="flex-1 accent-primary" />
        <button type="button" aria-label={`Increase ${label.toLowerCase()}`} onClick={() => setValue(clamp(value + 1))}
          className="h-10 w-10 grid place-items-center rounded-xl bg-surface border border-border hover:border-primary/40 hover:text-primary transition shrink-0">
          <Plus className="h-4 w-4" />
        </button>
      </div>
      <div className="flex items-center gap-2">
        <input type="number" min={min} max={max} value={value} onChange={(e) => setValue(clamp(Number(e.target.value) || min))}
          className="flex-1 h-10 px-3 rounded-xl bg-surface border border-border text-sm focus:outline-none focus:border-primary/40" />
        <button onClick={onSave} disabled={saving}
          className="inline-flex items-center gap-2 h-10 px-4 rounded-xl bg-gradient-primary text-white text-sm font-semibold shadow-[0_8px_24px_-8px_var(--glow)] hover:brightness-110 transition disabled:opacity-60">
          {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />} Save
        </button>
      </div>
    </div>
  );
}
