import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { Loader2 } from "lucide-react";
import { AuthShell, PasswordField } from "./login";
import { supabase, hasSupabaseConfig } from "@/integrations/supabase/client";

export const Route = createFileRoute("/reset-password")({
  head: () => ({ meta: [{ title: "Reset password — Zentra" }] }),
  component: ResetPasswordPage,
});

function ResetPasswordPage() {
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (!hasSupabaseConfig) return;
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_OUT" && success) navigate({ to: "/login" });
    });
    return () => sub.subscription.unsubscribe();
  }, [navigate, success]);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError("");
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }
    setBusy(true);
    try {
      const { error: updateError } = await supabase.auth.updateUser({ password });
      if (updateError) throw updateError;
      setSuccess(true);
      await supabase.auth.signOut();
      navigate({ to: "/login" });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update password.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthShell title="Reset password" subtitle="Enter a new password for your Zentra account.">
      <form onSubmit={submit} className="space-y-4">
        {error && (
          <div className="rounded-xl border border-destructive/40 bg-destructive/10 px-4 py-2.5 text-sm text-destructive">{error}</div>
        )}
        <PasswordField label="New password" value={password} onChange={setPassword} show={showPassword} toggle={() => setShowPassword(!showPassword)} />
        <PasswordField label="Confirm password" value={confirm} onChange={setConfirm} show={showConfirm} toggle={() => setShowConfirm(!showConfirm)} />
        <button type="submit" disabled={busy}
          className="w-full h-12 rounded-xl bg-gradient-primary text-white font-semibold shadow-[0_10px_30px_-10px_var(--glow)] hover:brightness-110 transition inline-flex items-center justify-center gap-2 disabled:opacity-60">
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Update password"}
        </button>
      </form>
      <button type="button" onClick={() => navigate({ to: "/login" })}
        className="mt-4 text-sm text-primary hover:underline w-full text-center">
        Back to login
      </button>
    </AuthShell>
  );
}
