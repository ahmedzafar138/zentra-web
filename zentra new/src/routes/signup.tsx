import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { Loader2 } from "lucide-react";
import { AuthShell, Field, PasswordField } from "./login";
import { supabase, hasSupabaseConfig, describeAuthError } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export const Route = createFileRoute("/signup")({
  head: () => ({ meta: [{ title: "Create account — Zentra" }] }),
  component: SignupPage,
});

function SignupPage() {
  const navigate = useNavigate();
  const { session, ensureProfile, loading } = useAuth();
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!loading && session) navigate({ to: "/onboarding" });
  }, [session, loading, navigate]);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError("");
    if (!hasSupabaseConfig) {
      setError("Supabase is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.");
      return;
    }
    if (!firstName || !lastName) {
      setError("Please enter your first and last name.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    setBusy(true);
    try {
      const { data, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { first_name: firstName, last_name: lastName } },
      });
      if (signUpError) throw signUpError;
      if (data.user) await ensureProfile(data.user, { first_name: firstName, last_name: lastName });
      navigate({ to: "/onboarding" });
    } catch (err) {
      setError(describeAuthError(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthShell title="Create your account" subtitle="Start your AI-guided fitness journey.">
      <form onSubmit={submit} className="space-y-4">
        {error && (
          <div className="rounded-xl border border-destructive/40 bg-destructive/10 px-4 py-2.5 text-sm text-destructive">{error}</div>
        )}
        <div className="grid grid-cols-2 gap-3">
          <Field label="First name" value={firstName} onChange={setFirstName} placeholder="Alex" required />
          <Field label="Last name" value={lastName} onChange={setLastName} placeholder="Doe" required />
        </div>
        <Field label="Email" type="email" value={email} onChange={setEmail} placeholder="you@example.com" required />
        <PasswordField label="Password" value={password} onChange={setPassword} show={showPassword} toggle={() => setShowPassword(!showPassword)} />
        <PasswordField label="Confirm password" value={confirmPassword} onChange={setConfirmPassword} show={showConfirm} toggle={() => setShowConfirm(!showConfirm)} />
        <button type="submit" disabled={busy}
          className="w-full h-12 rounded-xl bg-gradient-primary text-white font-semibold shadow-[0_10px_30px_-10px_var(--glow)] hover:brightness-110 transition inline-flex items-center justify-center gap-2 disabled:opacity-60">
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Create account"}
        </button>
      </form>
      <p className="text-sm text-center text-muted-foreground mt-6">
        Already have an account? <Link to="/login" className="text-primary hover:underline font-medium">Sign in</Link>
      </p>
    </AuthShell>
  );
}
