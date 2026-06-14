import { useNavigate } from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";

type Props = {
  children: ReactNode;
  /** When true, allow access even if onboarding is not complete (for /onboarding itself). */
  allowIncomplete?: boolean;
};

export function Protected({ children, allowIncomplete = false }: Props) {
  const navigate = useNavigate();
  const { session, profile, loading, loadingProfile, hasSupabaseConfig } = useAuth();

  useEffect(() => {
    if (loading) return;
    if (!hasSupabaseConfig) return;
    if (!session) {
      navigate({ to: "/login" });
      return;
    }
    if (allowIncomplete) return;
    if (loadingProfile) return;
    if (!profile?.onboarding_completed || !profile?.height_cm || !profile?.weight_kg) {
      navigate({ to: "/onboarding" });
    }
  }, [session, profile, loading, loadingProfile, hasSupabaseConfig, allowIncomplete, navigate]);

  if (loading || (session && loadingProfile && !profile)) {
    return (
      <div className="min-h-screen grid place-items-center">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }
  if (!session && hasSupabaseConfig) return null;
  if (!allowIncomplete && (!profile?.onboarding_completed || !profile?.height_cm || !profile?.weight_kg)) {
    return null;
  }
  return <>{children}</>;
}
