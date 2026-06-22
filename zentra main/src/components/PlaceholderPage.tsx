import { AppShell } from "./AppShell";
import { Sparkles } from "lucide-react";

export function PlaceholderPage({ title, description }: { title: string; description: string }) {
  return (
    <AppShell>
      <div className="space-y-2 mb-8">
        <h1 className="text-3xl md:text-4xl font-bold">{title}</h1>
        <p className="text-muted-foreground max-w-2xl">{description}</p>
      </div>
      <div className="card-elevated p-12 grid place-items-center text-center">
        <div className="h-14 w-14 rounded-2xl bg-gradient-primary grid place-items-center mb-5 shadow-[0_8px_24px_-8px_var(--glow)] animate-glow-pulse">
          <Sparkles className="h-6 w-6 text-white" />
        </div>
        <h2 className="text-xl font-semibold">Coming soon</h2>
        <p className="text-sm text-muted-foreground mt-2 max-w-md">
          This module is part of the Zentra roadmap. Tell the assistant what you'd like to build here next.
        </p>
      </div>
    </AppShell>
  );
}
