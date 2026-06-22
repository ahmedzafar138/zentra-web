import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { Protected } from "@/components/Protected";
import { exercisesByGroup, getModelConfig } from "@/lib/formCorrection";

export const Route = createFileRoute("/form-correction/$group/")({
  head: () => ({ meta: [{ title: "Choose Exercise — Zentra" }] }),
  component: () => (
    <Protected>
      <ExercisesPage />
    </Protected>
  ),
});

function ExercisesPage() {
  const { group } = useParams({ from: "/form-correction/$group/" });
  const exercises = exercisesByGroup[group] ?? [];

  return (
    <AppShell>
      <div className="space-y-6 max-w-3xl">
        <div className="flex items-center gap-3">
          <Link to="/form-correction"
            className="h-10 w-10 grid place-items-center rounded-xl bg-surface border border-border hover:border-primary/40 transition">
            <ChevronLeft className="h-4 w-4" />
          </Link>
          <div>
            <p className="text-sm text-muted-foreground">Choose an exercise to open live correction</p>
            <h1 className="text-3xl font-bold">{group}</h1>
          </div>
        </div>

        {exercises.length === 0 ? (
          <p className="text-sm text-muted-foreground">No exercises configured for {group}.</p>
        ) : (
          <div className="space-y-2">
            {exercises.map((exercise, index) => {
              const supported = Boolean(getModelConfig(group, exercise));
              return (
                <Link key={exercise} to="/form-correction/$group/$exercise" params={{ group, exercise }}
                  className="flex items-center gap-4 card-elevated p-4 group hover:border-primary/40 transition">
                  <span className="h-10 w-10 grid place-items-center rounded-xl bg-surface-elevated border border-border text-muted-foreground text-sm font-semibold">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <div className="flex-1">
                    <p className="font-medium group-hover:text-primary transition-colors">{exercise}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {supported ? "Live AI correction available" : "Webcam preview only"}
                    </p>
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </AppShell>
  );
}
