import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Flame, Sparkles, Activity, Apple, Dumbbell, Brain, ArrowRight, Check, BookOpen } from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Zentra — Your AI Fitness Trainer" },
      { name: "description", content: "Zentra is the AI-powered fitness platform with form correction, smart meal plans, workout tracking and an AI coach." },
      { property: "og:title", content: "Zentra — Your AI Fitness Trainer" },
      { property: "og:description", content: "AI form correction, meal plans, and a personal coach in one premium dashboard." },
    ],
  }),
  component: Landing,
});

function Landing() {
  return (
    <div className="relative z-10 min-h-screen">
      {/* Nav */}
      <header className="sticky top-0 z-40 glass">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2.5">
            <div className="h-9 w-9 rounded-xl bg-gradient-primary grid place-items-center shadow-[0_8px_24px_-8px_var(--glow)]">
              <Flame className="h-5 w-5 text-white" />
            </div>
            <span className="text-lg font-bold tracking-tight">Zentra</span>
          </Link>
          <nav className="hidden md:flex items-center gap-8 text-sm text-muted-foreground">
            <a href="#features" className="hover:text-foreground transition-colors">Features</a>
            <a href="#how" className="hover:text-foreground transition-colors">How it works</a>
            <a href="#pricing" className="hover:text-foreground transition-colors">Pricing</a>
          </nav>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" asChild><Link to="/login">Sign in</Link></Button>
            <Button variant="hero" size="sm" asChild><Link to="/signup">Get started</Link></Button>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="max-w-7xl mx-auto px-6 pt-16 md:pt-24 pb-20 grid lg:grid-cols-2 gap-12 items-center">
        <div className="space-y-7 animate-fade-up">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full glass text-xs text-muted-foreground">
            <Sparkles className="h-3.5 w-3.5 text-primary" />
            Powered by Zentra AI
          </div>
          <h1 className="text-5xl md:text-6xl lg:text-7xl font-bold leading-[1.05] tracking-tight">
            <span className="text-gradient-primary">Zentra AI</span>
            <span className="block mt-2 text-foreground">Your AI Fitness Trainer.</span>
          </h1>
          <p className="text-lg text-muted-foreground max-w-xl leading-relaxed">
            Real-time form correction, intelligent meal plans, workout tracking and a coach
            that knows you — all in one premium dashboard.
          </p>
          <div className="flex flex-wrap gap-3">
            <Button variant="hero" size="lg" asChild>
              <Link to="/signup">Get Started <ArrowRight /></Link>
            </Button>
            <Button variant="glass" size="lg" asChild>
              <Link to="/login">Sign In</Link>
            </Button>
          </div>
          <div className="flex items-center gap-6 pt-4 text-sm text-muted-foreground">
            {["No credit card", "Free 14-day trial", "Cancel anytime"].map((t) => (
              <div key={t} className="flex items-center gap-1.5">
                <Check className="h-4 w-4 text-primary" /> {t}
              </div>
            ))}
          </div>
        </div>

        {/* Visual */}
        <div className="relative animate-fade-up">
          <div className="absolute -inset-10 bg-gradient-primary opacity-20 blur-3xl rounded-full" />
          <div className="relative card-elevated p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Today's Activity</p>
                <p className="text-2xl font-bold mt-1">8,420 <span className="text-sm font-normal text-muted-foreground">steps</span></p>
              </div>
              <div className="h-14 w-14 rounded-full grid place-items-center relative">
                <svg viewBox="0 0 36 36" className="h-14 w-14 -rotate-90">
                  <circle cx="18" cy="18" r="15" className="fill-none stroke-border" strokeWidth="3" />
                  <circle cx="18" cy="18" r="15" className="fill-none stroke-primary" strokeWidth="3" strokeDasharray="94" strokeDashoffset="20" strokeLinecap="round" />
                </svg>
                <span className="absolute text-xs font-semibold">84%</span>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {[
                { l: "Calories", v: "612" },
                { l: "Active min", v: "47" },
                { l: "Distance", v: "5.2 km" },
              ].map((s) => (
                <div key={s.l} className="rounded-xl bg-surface-elevated border border-border p-3">
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{s.l}</p>
                  <p className="text-base font-semibold mt-1">{s.v}</p>
                </div>
              ))}
            </div>
            <div className="rounded-xl bg-surface-elevated border border-border p-4">
              <div className="flex items-center gap-2 mb-3">
                <div className="h-7 w-7 rounded-lg bg-gradient-primary grid place-items-center">
                  <Sparkles className="h-3.5 w-3.5 text-white" />
                </div>
                <p className="text-sm font-medium">Zentra AI</p>
              </div>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Great pace today! Add 15 min of mobility tonight to recover before tomorrow's leg session. 💪
              </p>
            </div>
            <div className="flex items-end gap-1.5 h-16 pt-2">
              {[40, 65, 35, 80, 55, 95, 70].map((h, i) => (
                <div key={i} className="flex-1 rounded-t-md bg-gradient-primary opacity-80" style={{ height: `${h}%` }} />
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="max-w-7xl mx-auto px-6 py-20">
        <div className="text-center max-w-2xl mx-auto mb-12">
          <h2 className="text-3xl md:text-4xl font-bold">Built to make you stronger.</h2>
          <p className="mt-3 text-muted-foreground">Six tools, one platform — designed to feel effortless.</p>
        </div>
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
          {[
            { icon: Activity, title: "Form Correction", desc: "Live pose detection coaches you on every rep through your webcam." },
            { icon: Apple, title: "Smart Meal Plans", desc: "Personalized weekly plans with shopping lists matched to your goal." },
            { icon: Brain, title: "Zentra AI Coach", desc: "Conversational AI that understands your training, recovery and nutrition." },
            { icon: Dumbbell, title: "Workout Logs", desc: "Effortless set-by-set tracking with progressive-overload insights." },
            { icon: Activity, title: "Step Counter", desc: "Beautiful daily and weekly analytics to keep you moving." },
            { icon: BookOpen, title: "Fitness Blogs", desc: "Editorial reads from coaches and nutritionists you can trust." },
          ].map((f) => (
            <div key={f.title} className="card-elevated p-6">
              <div className="h-11 w-11 rounded-xl bg-gradient-primary grid place-items-center mb-4 shadow-[0_8px_24px_-8px_var(--glow)]">
                <f.icon className="h-5 w-5 text-white" />
              </div>
              <h3 className="text-lg font-semibold">{f.title}</h3>
              <p className="text-sm text-muted-foreground mt-2 leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="max-w-7xl mx-auto px-6 pb-24">
        <div className="relative overflow-hidden card-elevated p-10 md:p-16 text-center">
          <div className="absolute inset-0 bg-gradient-primary opacity-20" />
          <div className="relative">
            <h2 className="text-3xl md:text-5xl font-bold">Train smarter. Starting today.</h2>
            <p className="mt-4 text-muted-foreground max-w-xl mx-auto">
              Join thousands using Zentra to lift better, eat smarter and stay consistent.
            </p>
            <div className="mt-7">
              <Button variant="hero" size="lg" asChild>
                <Link to="/dashboard">Open Dashboard <ArrowRight /></Link>
              </Button>
            </div>
          </div>
        </div>
      </section>

      <footer className="border-t border-border">
        <div className="max-w-7xl mx-auto px-6 py-8 flex flex-col md:flex-row items-center justify-between gap-4 text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <Flame className="h-4 w-4 text-primary" /> © 2026 Zentra
          </div>
          <div className="flex items-center gap-6">
            <a href="#" className="hover:text-foreground">Privacy</a>
            <a href="#" className="hover:text-foreground">Terms</a>
            <a href="#" className="hover:text-foreground">Contact</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
