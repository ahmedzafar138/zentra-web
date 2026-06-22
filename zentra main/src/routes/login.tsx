import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { Eye, EyeOff, Flame, Loader2 } from "lucide-react";
import { supabase, hasSupabaseConfig, describeAuthError } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export const Route = createFileRoute("/login")({
  head: () => ({ meta: [{ title: "Sign in — Zentra" }] }),
  component: LoginPage,
});

type Mode = "login" | "forgot";

function LoginPage() {
  const navigate = useNavigate();
  const { session, profile, loading } = useAuth();
  const [mode, setMode] = useState<Mode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");

  useEffect(() => {
    if (loading) return;
    if (session) {
      const onboarded = profile?.onboarding_completed && profile?.height_cm && profile?.weight_kg;
      navigate({ to: onboarded ? "/dashboard" : "/onboarding" });
    }
  }, [session, profile, loading, navigate]);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError("");
    setInfo("");
    if (!hasSupabaseConfig) {
      setError("Supabase is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.");
      return;
    }
    setBusy(true);
    try {
      if (mode === "forgot") {
        const redirectTo = `${window.location.origin}/reset-password`;
        const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, { redirectTo });
        if (resetError) throw resetError;
        setInfo("Password reset email sent. Check your inbox.");
        setMode("login");
        return;
      }
      const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
      if (signInError) throw signInError;
    } catch (err) {
      setError(describeAuthError(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthShell title={mode === "forgot" ? "Reset password" : "Welcome back"} subtitle={mode === "forgot" ? "Enter your email and we'll send a reset link." : "Sign in to continue your training."}>
      <form onSubmit={submit} className="space-y-4">
        {error && (
          <div className="rounded-xl border border-destructive/40 bg-destructive/10 px-4 py-2.5 text-sm text-destructive">{error}</div>
        )}
        {info && (
          <div className="rounded-xl border border-primary/30 bg-primary/10 px-4 py-2.5 text-sm text-primary">{info}</div>
        )}
        <Field label="Email" type="email" value={email} onChange={setEmail} placeholder="you@example.com" required />
        {mode === "login" && (
          <PasswordField label="Password" value={password} onChange={setPassword} show={showPassword} toggle={() => setShowPassword(!showPassword)} />
        )}
        <button type="submit" disabled={busy}
          className="w-full h-12 rounded-xl bg-gradient-primary text-white font-semibold shadow-[0_10px_30px_-10px_var(--glow)] hover:brightness-110 transition inline-flex items-center justify-center gap-2 disabled:opacity-60">
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : mode === "forgot" ? "Send reset link" : "Sign in"}
        </button>
      </form>
      <button type="button" onClick={() => { setMode(mode === "forgot" ? "login" : "forgot"); setError(""); setInfo(""); }}
        className="mt-4 text-sm text-primary hover:underline w-full text-center">
        {mode === "forgot" ? "Remembered your password?" : "Forgot password?"}
      </button>
      <p className="text-sm text-center text-muted-foreground mt-6">
        No account? <Link to="/signup" className="text-primary hover:underline font-medium">Create one</Link>
      </p>
    </AuthShell>
  );
}

export function AuthShell({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <div className="min-h-screen grid place-items-center px-4 py-10 relative z-10">
      <div className="w-full max-w-md">
        <Link to="/" className="flex items-center justify-center gap-2.5 mb-8">
          <div className="h-11 w-11 rounded-xl bg-gradient-primary grid place-items-center shadow-[0_10px_30px_-10px_var(--glow)]">
            <Flame className="h-6 w-6 text-white" />
          </div>
          <span className="text-2xl font-bold">Zentra</span>
        </Link>
        <div className="card-elevated p-7">
          <h1 className="text-2xl font-bold">{title}</h1>
          <p className="text-sm text-muted-foreground mt-1.5 mb-6">{subtitle}</p>
          {children}
        </div>
      </div>
    </div>
  );
}

export function Field({ label, type = "text", value, onChange, placeholder, required }: {
  label: string; type?: string; value: string; onChange: (v: string) => void; placeholder?: string; required?: boolean;
}) {
  return (
    <label className="block">
      <span className="text-xs uppercase tracking-wider text-muted-foreground">{label}</span>
      <input type={type} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} required={required}
        className="mt-1.5 w-full h-12 px-4 rounded-xl bg-surface-elevated border border-border text-sm focus:outline-none focus:border-primary/40 focus:ring-2 focus:ring-primary/20" />
    </label>
  );
}

export function PasswordField({ label, value, onChange, show, toggle, minLength = 8 }: {
  label: string; value: string; onChange: (v: string) => void; show: boolean; toggle: () => void; minLength?: number;
}) {
  return (
    <label className="block">
      <span className="text-xs uppercase tracking-wider text-muted-foreground">{label}</span>
      <div className="mt-1.5 relative">
        <input type={show ? "text" : "password"} value={value} onChange={(e) => onChange(e.target.value)} required minLength={minLength}
          className="w-full h-12 pl-4 pr-12 rounded-xl bg-surface-elevated border border-border text-sm focus:outline-none focus:border-primary/40 focus:ring-2 focus:ring-primary/20" />
        <button type="button" onClick={toggle} aria-label="Toggle password visibility"
          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
          {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      </div>
    </label>
  );
}
