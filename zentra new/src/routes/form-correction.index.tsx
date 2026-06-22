import { createFileRoute, Link } from "@tanstack/react-router";
import { CheckCircle } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { Protected } from "@/components/Protected";
import { useAuth } from "@/hooks/useAuth";
import { muscleGroups } from "@/lib/formCorrection";

export const Route = createFileRoute("/form-correction/")({
  head: () => ({ meta: [{ title: "Form Correction — Zentra" }] }),
  component: () => (
    <Protected>
      <FormCorrectionPage />
    </Protected>
  ),
});

function FormCorrectionPage() {
  const { profile } = useAuth();

  return (
    <AppShell>
      <div className="space-y-8 max-w-5xl">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-3xl md:text-4xl font-bold">Form Correction</h1>
            <p className="text-sm text-muted-foreground mt-1.5">What are you training today?</p>
            {profile?.first_name && <p className="text-xs text-muted-foreground mt-1">Welcome back, {profile.first_name}</p>}
          </div>
          <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs glass">
            <CheckCircle className="h-3.5 w-3.5 text-primary" /> AI
          </span>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {muscleGroups.map((group) => {
            const Icon = group.icon;
            return (
              <Link key={group.name} to="/form-correction/$group" params={{ group: group.name }}
                className="card-elevated p-5 group flex flex-col items-start gap-2">
                <div className="h-11 w-11 rounded-xl bg-gradient-primary grid place-items-center shadow-[0_8px_24px_-8px_var(--glow)]">
                  <Icon className="h-5 w-5 text-white" />
                </div>
                <strong className="font-semibold mt-3 group-hover:text-primary transition-colors">{group.name}</strong>
                <small className="text-xs text-muted-foreground">{group.exercises} exercises</small>
              </Link>
            );
          })}
        </div>

        <div className="card-elevated p-5">
          <p className="text-xs text-muted-foreground">
            Live AI correction is wired for: <b>Bicep Curl</b>, <b>Push-ups</b>, <b>Dumbbell Flyes</b>, <b>Deadlift</b>, <b>Plank</b>, <b>Squats</b>. Other exercises open webcam preview only.
          </p>
        </div>
      </div>
    </AppShell>
  );
}
